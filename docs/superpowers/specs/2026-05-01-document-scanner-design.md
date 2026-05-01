# In-App Document Scanner — Design

**Date:** 2026-05-01
**Owner:** jalexander
**Status:** Draft — pending user approval

## 1. Problem & Goal

Users currently upload compliance documents to client and caregiver records via a plain `<input type="file" accept=".pdf,.jpg,.jpeg">` ([ClientCompliance.jsx:586](../../../fca-web/src/components/client/ClientCompliance.jsx#L586), [CaregiverCompliance.jsx:754](../../../fca-web/src/components/caregiver/CaregiverCompliance.jsx#L754)). On mobile, this means tapping the input, opening the OS camera, snapping one JPEG, returning, and uploading. Multi-page documents must either be (a) pre-assembled outside the app or (b) uploaded as separate JPEGs that lose their grouping.

**Goal:** add an in-app scanner that lets a user capture multiple pages with their device camera, auto-cropped and de-skewed, assembled into a single PDF, and uploaded to the same storage location the existing file picker uses. The existing file picker remains available unchanged.

## 2. Scope

**In scope (v1):**

- New scanner UI accessible from each compliance category row in `ClientCompliance.jsx` and `CaregiverCompliance.jsx`.
- Web-based capture via `getUserMedia` — works on phone (iOS Safari, Android Chrome) and on laptop/desktop with a webcam.
- DIY open-source pipeline: `jscanify` (OpenCV.js) for edge detection + perspective correction; `pdf-lib` for PDF assembly. No commercial SDK.
- Standard compression: each page resized to max 2000px on long edge, JPEG quality 80, embedded in the output PDF.
- Multi-page capture with thumbnail strip, retake-per-page, delete-per-page. No reorder.
- Confirm-before-replace when a category already has a document.
- Explicit error modal for permission denial, unsupported browser, no HTTPS, no camera, etc.
- Lazy-loaded scanner library (OpenCV.js + jscanify only download on first scan of a session).
- Output is **always** a PDF, even for single-page captures.

**Out of scope (v1):**

- OCR / searchable PDFs.
- Manual crop adjustment, rotate, brightness/contrast.
- Page reorder.
- Auto-capture (snap when document is steady).
- Glare / blur quality detection.
- Custom filename input at scan time (auto-generated from category + date).
- Scanner availability outside Client/Caregiver Compliance (intake forms, profile photos, etc. keep their current uploaders).
- Desktop document scanners attached via TWAIN/WIA (browsers cannot reach those; users keep using the file picker for already-scanned files).

## 3. Architecture

A new self-contained module under `fca-web/src/components/scanner/`. The scanner knows nothing about clients, caregivers, or compliance — its only job is `open camera → capture pages → emit a PDF File`. Its only contract is the `onComplete(pdfFile)` callback.

```
fca-web/src/components/scanner/
├── DocumentScanner.jsx          # Top-level modal; orchestrates lifecycle
├── CameraView.jsx               # Live <video> + shutter + init loader
├── PageThumbnailStrip.jsx       # Bottom strip; tap → retake or delete
├── ScannerErrorModal.jsx        # Per-cause guidance modal
├── hooks/
│   └── useScannerState.js       # Reducer-backed page/mode state
└── lib/
    ├── jscanifyLoader.js        # Promise-cached dynamic import
    ├── pageProcessor.js         # processFrame(bitmap) → { processedBlob, thumbnailBlob }
    ├── pdfBuilder.js            # buildPdf(pages) → File
    └── filename.js              # buildFilename(category, date) → string
```

**Reusability:** the module takes only `{ isOpen, onClose, onComplete, categoryName }` as props — it can be dropped into any future feature that needs a document scanner without modification.

## 4. Integration Points

The compliance pages don't change shape. Each page adds:

1. A **📷 Scan** button next to the existing **📁 Upload File** button on each compliance category row.
2. A `<DocumentScanner>` modal mount.
3. A `handleScanComplete(pdfFile)` handler that:
   - If a doc already exists for that category, shows the **replace-confirm** modal: *"This will replace your existing &lt;Category Name&gt; — continue?"*
   - On confirm (or if no existing doc), calls **the same upload function the file picker already uses** ([ClientCompliance.jsx:83](../../../fca-web/src/components/client/ClientCompliance.jsx#L83) `handleFileChange` logic, refactored into a shared helper).

**Storage path** — unchanged from today: `client-documents/{clientId}/compliance/{side}/{itemId}.pdf` (mirrored for caregivers in `caregiver-documents`). The existing code already uses `upsert: true`, so the underlying overwrite mechanic already works; we are only adding the user-facing confirm step.

## 5. Data Flow (happy path)

1. User taps **📷 Scan** on a category row → `<DocumentScanner isOpen categoryName="Driver's License" onComplete={handleScanComplete} />`.
2. `DocumentScanner` calls `jscanifyLoader.load()`. First call of the session → fetches OpenCV.js + jscanify (~3–5 sec on broadband, longer on cellular) with an "Initializing scanner…" UI. Subsequent calls resolve instantly via cached promise.
3. `CameraView` calls `getUserMedia({ video: { facingMode: 'environment' } })`. On laptops the browser's native picker selects the available webcam. On failure → unmount the camera, render `ScannerErrorModal` with cause-specific copy.
4. User taps the **shutter** → grab the current video frame as `ImageBitmap` → `pageProcessor.processFrame(bitmap)` → `{ processedBlob, thumbnailBlob }`.
5. `useScannerState` dispatches `addPage(processedBlob, thumbnailBlob)`. New page appears in the thumbnail strip.
6. Repeat 4–5. If running total `processedBlob` size crosses **50 MB**, fire a one-time soft toast: *"This document is getting large (X MB). Consider finishing now and starting a second scan if needed."*
7. Tap a thumbnail → `mode = 'reviewing-page'`. Choices: **Retake** (delete page + return to camera) or **Delete** (remove page, stay in capture mode).
8. Tap **Done** → `mode = 'building-pdf'` → `pdfBuilder.buildPdf(pages)` returns a `File` named `<category-slug>-<YYYY-MM-DD>.pdf` (e.g. `drivers-license-2026-05-01.pdf`).
9. `onComplete(pdfFile)` then `onClose()`.
10. The compliance page's `handleScanComplete` runs the replace-confirm flow if needed, then uploads via the shared upload helper.

**Cleanup:** modal unmount stops every `MediaStreamTrack` (`track.stop()`) and revokes any `URL.createObjectURL` thumbnails. No leaked camera handle.

## 6. State Shape

```js
{
  mode: 'capturing' | 'reviewing-page' | 'building-pdf' | 'error',
  pages: [{ id, processedBlob, thumbnailBlob, sizeBytes }],
  reviewingPageId: string | null,
  totalSizeBytes: number,
  warned50MB: boolean,
  error: { kind, message } | null
}
```

Reducer actions: `addPage`, `deletePage`, `retakePage`, `setReviewingPage`, `clearReviewing`, `setMode`, `setError`, `clearError`, `reset`.

## 7. Error Handling

`ScannerErrorModal` covers each failure cause with explicit copy and two buttons (**Try Again**, **Use Upload File Instead**):

| Cause | Detection | Modal copy |
|---|---|---|
| Browser unsupported | `!navigator.mediaDevices?.getUserMedia` | "This browser doesn't support camera scanning. Please use the **Upload File** button instead, or try a modern browser like Chrome, Safari, or Firefox." |
| Plain HTTP | `location.protocol !== 'https:' && hostname !== 'localhost'` | "Camera scanning requires a secure (HTTPS) connection. Please reload the page from a secure URL, or use the **Upload File** button." |
| Permission denied | `NotAllowedError` / `PermissionDeniedError` | "Camera access was blocked. Tap **How to enable** for browser-specific instructions, or use the **Upload File** button instead." Includes an expandable section with iOS Safari, Android Chrome, and desktop steps. |
| No camera hardware | `NotFoundError` / `OverconstrainedError` | "No camera was found on this device. Please use the **Upload File** button instead." |
| Camera busy | `NotReadableError` / `TrackStartError` | "Your camera is being used by another app. Close it and try again, or use the **Upload File** button." |
| Unknown / generic | Anything else | "Something went wrong starting the scanner. Please try again, or use the **Upload File** button." |
| OpenCV.js download failed | Loader rejection | "Couldn't load the scanner. Check your connection and try again." Loader promise is **not cached on failure** — retry works. |

**Other edge cases:**

- **Edge detection fails on a page** (low contrast / weird angle): page is captured *without* auto-crop (full frame). Inline warning under the thumbnail: *"Couldn't auto-crop this page."* User may retake or accept.
- **App backgrounded mid-scan** (phone lock, tab switch): on return, if `videoTrack.readyState === 'ended'`, silently re-request `getUserMedia`. Captured pages stay in state.
- **Done with zero pages**: the **Done** button is disabled until at least one page exists.
- **Cancel with pages captured**: confirm modal *"Discard X scanned pages?"*.
- **Replace-confirm dismissed**: assembled PDF is discarded; scanner closes; user may re-scan.
- **Upload failure after PDF assembly**: handled by the existing upload code path (we're reusing it as-is). No new error UX at this layer.

**Explicitly not handled in v1:** mid-upload network loss (existing behavior), concurrent scanner modals (we just unmount one), memory exhaustion on ancient devices (the 50 MB soft cap is the only guardrail).

## 8. Compression & Sizing

- **Per-page processing** (in `pageProcessor`): jscanify finds the document quad, applies a perspective transform that maps it to a rectangular page, resizes so the long edge is ≤ 2000px, and encodes as JPEG quality 0.8.
- **PDF assembly** (in `pdfBuilder`): `pdf-lib` with `embedJpg` for each page. Page dimensions computed from each image's aspect ratio (no enforced letter-size).
- **Realistic sizes:** ~150–400 KB per page → ~2–4 MB for a 10-page doc, ~5–10 MB for 25 pages.
- **No hard page cap.** Soft warning at 50 MB total (one-time toast).

## 9. Bundle / Performance

- OpenCV.js + jscanify are **lazy-loaded** via dynamic `import()` only when the user first taps **Scan** in a session. Loaded chunk is cached by the browser and by the loader's promise for the rest of the session.
- ~8–11 MB minified, ~3–4 MB gzipped over the wire.
- "Initializing scanner…" UI shown during the first load, with progress if the fetch supports it.
- Subsequent scans in the same session: instant.

## 10. Filename Convention

`buildFilename(categoryName, date) → <slug>-<YYYY-MM-DD>.pdf`

- Slug: lowercase, ASCII-only, non-alphanumeric → single hyphen, trim leading/trailing hyphens.
- Examples: `"Driver's License"` + `2026-05-01` → `drivers-license-2026-05-01.pdf`. `"TB / PPD Test"` → `tb-ppd-test-2026-05-01.pdf`.

## 11. Testing

**Unit tests (Vitest, matching the existing `fca-web` setup):**

- `pdfBuilder.test.js` — given N image blobs, produces a parseable PDF with N pages, MIME `application/pdf`, expected filename, JPEG-embedded pages.
- `pageProcessor.test.js` — fixture image with a document in frame returns a smaller JPEG blob; failure path returns the original frame blob with `autoCropped: false`.
- `useScannerState.test.js` — reducer tests for every action; one-time 50 MB warning; `totalSizeBytes` math; reset.
- `filename.test.js` — slug edge cases (apostrophes, slashes, accented chars, leading/trailing whitespace).
- `scannerErrorModal.test.jsx` — renders the right copy + buttons for each `error.kind`.

**No automated tests for:** live `getUserMedia`, OpenCV.js loading, full DocumentScanner integration. These are validated manually.

**Manual test plan:**

1. Mac webcam, localhost — 1-page scan, 3-page scan, retake page 2, delete page 1, cancel mid-scan, scan with no doc in frame (failed-edge-detection inline warning), cross 50 MB threshold (toast fires once).
2. Mac webcam, permission denied — verify the right modal + retry button.
3. iOS Safari, Vercel preview — same scan flows on iPhone. Verify native camera prompt, real-world page quality, multi-page PDF opens correctly in iOS Files / Preview.
4. Android Chrome, Vercel preview — same scan flows on Android.
5. Replace-confirm — scan into a category that already has a doc; verify confirm modal; verify Cancel preserves existing doc.
6. Upload File still works — verify existing file picker is unaffected for JPEG and existing PDFs.

## 12. Delivery Sequence

1. Build the scanner module + unit tests on a feature branch.
2. Refactor existing `handleFileChange` upload logic in both compliance pages into a shared helper (so the scanner and file picker share the upload path).
3. Wire the scanner into `ClientCompliance.jsx` and `CaregiverCompliance.jsx`.
4. Manual pass on localhost (Mac webcam).
5. Open PR → Vercel preview deploy generates an HTTPS URL.
6. Manual pass on iOS Safari + Android Chrome via the preview URL.
7. Merge to `main`.

## 13. Dependencies (new)

- `jscanify` — MIT, OpenCV.js-based document edge detection + perspective correction.
- `pdf-lib` — MIT, pure-JS PDF construction.
- (OpenCV.js is loaded transitively via jscanify; no separate package install.)

## 14. Open Questions / Risks

- **OpenCV.js bundle size on cellular**: 3–4 MB gzipped is a real cost. If user testing shows the first-scan wait feels too long on cellular, we revisit by either (a) preloading after login or (b) trimming OpenCV.js to only the modules jscanify needs.
- **iOS Safari camera quirks**: in-app webviews (Facebook, Instagram, etc.) sometimes block `getUserMedia` even when "real" Safari allows it. The unsupported-browser modal handles it, but real-device testing on the preview deploy will validate.
- **Edge detection quality**: jscanify is good but not Scanbot-good. If quality complaints arrive, the swap-in path to a commercial SDK is open because the scanner module hides the implementation behind `pageProcessor`.

# In-App Document Scanner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app multi-page document scanner to Client and Caregiver Compliance that captures pages with the device camera, auto-crops/de-skews via jscanify, assembles them into a single compressed PDF, and uploads to the existing Supabase Storage path.

**Architecture:** A self-contained `fca-web/src/components/scanner/` module exposing `<DocumentScanner isOpen onClose onComplete categoryName />`. The scanner knows nothing about clients/caregivers/compliance — its only contract is `onComplete(pdfFile)`. Compliance pages add a 📷 Scan button next to their existing 📁 Upload File button and route both flows through a shared upload helper. OpenCV.js + jscanify lazy-loaded on first scan.

**Tech Stack:** React 19, Vite 7, Vitest (new), Supabase Storage, jscanify (MIT, OpenCV.js), pdf-lib (MIT), existing Tailwind + lucide-react + project UI primitives.

**Spec:** [docs/superpowers/specs/2026-05-01-document-scanner-design.md](../specs/2026-05-01-document-scanner-design.md)

---

## File Structure

**New files:**

- `fca-web/src/components/scanner/DocumentScanner.jsx` — top-level modal, orchestrates lifecycle
- `fca-web/src/components/scanner/CameraView.jsx` — `<video>` stream + shutter + init loader
- `fca-web/src/components/scanner/PageThumbnailStrip.jsx` — bottom strip; tap to retake/delete
- `fca-web/src/components/scanner/ScannerErrorModal.jsx` — per-cause guidance modal
- `fca-web/src/components/scanner/hooks/useScannerState.js` — reducer + hook for page/mode state
- `fca-web/src/components/scanner/lib/filename.js` — `buildFilename(category, date)`
- `fca-web/src/components/scanner/lib/pdfBuilder.js` — `buildPdf(pages)` → File
- `fca-web/src/components/scanner/lib/pageProcessor.js` — `processFrame(bitmap)` → blobs
- `fca-web/src/components/scanner/lib/jscanifyLoader.js` — promise-cached dynamic import
- `fca-web/src/lib/uploadComplianceDoc.js` — shared upload helper
- Test files mirror the above under each `__tests__/` neighbor

**Modified files:**

- `fca-web/package.json` — add vitest + jsdom + pdf-lib + jscanify + opencv.js (transitive)
- `fca-web/vite.config.js` — add vitest config (or new `vitest.config.js`)
- `fca-web/src/components/client/ClientCompliance.jsx` — add Scan button, mount DocumentScanner, route through shared helper
- `fca-web/src/components/caregiver/CaregiverCompliance.jsx` — same as above

---

## Task 1: Set up Vitest

**Why:** The project has no test runner yet. We need one before we can do TDD on the scanner pieces.

**Files:**
- Modify: `fca-web/package.json`
- Create: `fca-web/vitest.config.js`
- Create: `fca-web/src/test/setup.js`

- [ ] **Step 1: Install vitest + testing libs**

```bash
cd fca-web && npm install -D vitest@^2.1.0 jsdom@^25.0.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.6.0 @testing-library/user-event@^14.5.0
```

Expected: packages added to devDependencies, no errors.

- [ ] **Step 2: Add test script to package.json**

In `fca-web/package.json`, add to `scripts`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 3: Create vitest config**

Create `fca-web/vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `fca-web/src/test/setup.js`:

```js
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 5: Create a sanity test to confirm it runs**

Create `fca-web/src/test/sanity.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('vitest setup', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run the sanity test**

```bash
cd fca-web && npm run test:run
```

Expected: 1 test passed. If it fails, fix config before proceeding.

- [ ] **Step 7: Commit**

```bash
git add fca-web/package.json fca-web/package-lock.json fca-web/vitest.config.js fca-web/src/test/setup.js fca-web/src/test/sanity.test.js
git commit -m "chore: add vitest + jsdom + testing-library setup"
```

---

## Task 2: Filename helper

**Files:**
- Create: `fca-web/src/components/scanner/lib/filename.js`
- Test: `fca-web/src/components/scanner/lib/__tests__/filename.test.js`

- [ ] **Step 1: Write the failing tests**

Create `fca-web/src/components/scanner/lib/__tests__/filename.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildFilename } from '../filename.js'

const date = new Date('2026-05-01T12:00:00Z')

describe('buildFilename', () => {
  it('formats simple category names', () => {
    expect(buildFilename('Driver License', date)).toBe('driver-license-2026-05-01.pdf')
  })

  it('strips apostrophes', () => {
    expect(buildFilename("Driver's License", date)).toBe('drivers-license-2026-05-01.pdf')
  })

  it('collapses multiple non-alphanumeric chars to single hyphen', () => {
    expect(buildFilename('TB / PPD Test', date)).toBe('tb-ppd-test-2026-05-01.pdf')
  })

  it('trims leading and trailing hyphens', () => {
    expect(buildFilename('  Hello  ', date)).toBe('hello-2026-05-01.pdf')
    expect(buildFilename('!!! Title !!!', date)).toBe('title-2026-05-01.pdf')
  })

  it('lowercases', () => {
    expect(buildFilename('APPENDIX L', date)).toBe('appendix-l-2026-05-01.pdf')
  })

  it('falls back to "document" for empty/all-symbol input', () => {
    expect(buildFilename('!!!', date)).toBe('document-2026-05-01.pdf')
    expect(buildFilename('', date)).toBe('document-2026-05-01.pdf')
  })

  it('formats date as YYYY-MM-DD using local time', () => {
    const d = new Date(2026, 0, 5) // Jan 5 2026, local
    expect(buildFilename('Doc', d)).toBe('doc-2026-01-05.pdf')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/filename.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement filename helper**

Create `fca-web/src/components/scanner/lib/filename.js`:

```js
export function buildFilename(categoryName, date = new Date()) {
  const slug = String(categoryName ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const safeSlug = slug || 'document'
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${safeSlug}-${yyyy}-${mm}-${dd}.pdf`
}
```

- [ ] **Step 4: Run tests**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/filename.test.js
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/components/scanner/lib/filename.js fca-web/src/components/scanner/lib/__tests__/filename.test.js
git commit -m "feat(scanner): add filename slug helper"
```

---

## Task 3: PDF builder

**Files:**
- Create: `fca-web/src/components/scanner/lib/pdfBuilder.js`
- Test: `fca-web/src/components/scanner/lib/__tests__/pdfBuilder.test.js`

- [ ] **Step 1: Install pdf-lib**

```bash
cd fca-web && npm install pdf-lib@^1.17.1
```

- [ ] **Step 2: Write the failing tests**

Create `fca-web/src/components/scanner/lib/__tests__/pdfBuilder.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../pdfBuilder.js'

// 1x1 red JPEG (smallest valid JPEG), base64-decoded to bytes
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z'

function makeJpegBlob() {
  const bin = atob(TINY_JPEG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

describe('buildPdf', () => {
  it('returns a File with application/pdf MIME and given filename', async () => {
    const file = await buildPdf([makeJpegBlob()], { filename: 'test.pdf' })
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('test.pdf')
  })

  it('produces a parseable PDF with N pages for N input blobs', async () => {
    const file = await buildPdf([makeJpegBlob(), makeJpegBlob(), makeJpegBlob()], { filename: 'three.pdf' })
    const buf = await file.arrayBuffer()
    const doc = await PDFDocument.load(buf)
    expect(doc.getPageCount()).toBe(3)
  })

  it('throws on empty input', async () => {
    await expect(buildPdf([], { filename: 'x.pdf' })).rejects.toThrow(/at least one page/i)
  })
})
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/pdfBuilder.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement pdfBuilder**

Create `fca-web/src/components/scanner/lib/pdfBuilder.js`:

```js
import { PDFDocument } from 'pdf-lib'

export async function buildPdf(pages, { filename }) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error('buildPdf requires at least one page')
  }

  const pdf = await PDFDocument.create()

  for (const blob of pages) {
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const image = await pdf.embedJpg(bytes)
    const page = pdf.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }

  const pdfBytes = await pdf.save()
  return new File([pdfBytes], filename, { type: 'application/pdf' })
}
```

- [ ] **Step 5: Run tests**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/pdfBuilder.test.js
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add fca-web/package.json fca-web/package-lock.json fca-web/src/components/scanner/lib/pdfBuilder.js fca-web/src/components/scanner/lib/__tests__/pdfBuilder.test.js
git commit -m "feat(scanner): add PDF builder using pdf-lib"
```

---

## Task 4: Scanner state reducer + hook

**Files:**
- Create: `fca-web/src/components/scanner/hooks/useScannerState.js`
- Test: `fca-web/src/components/scanner/hooks/__tests__/useScannerState.test.js`

- [ ] **Step 1: Write failing tests**

Create `fca-web/src/components/scanner/hooks/__tests__/useScannerState.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { reducer, initialState, WARN_BYTES } from '../useScannerState.js'

function blob(size) {
  return { size, type: 'image/jpeg' }
}

describe('scanner reducer', () => {
  it('starts in capturing mode with no pages', () => {
    expect(initialState.mode).toBe('capturing')
    expect(initialState.pages).toEqual([])
    expect(initialState.totalSizeBytes).toBe(0)
    expect(initialState.warned50MB).toBe(false)
  })

  it('addPage appends a page and updates totalSizeBytes', () => {
    const s1 = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
    })
    expect(s1.pages).toHaveLength(1)
    expect(s1.pages[0].sizeBytes).toBe(1000)
    expect(s1.pages[0].id).toBeTruthy()
    expect(s1.totalSizeBytes).toBe(1000)
  })

  it('addPage flags autoCropped: false when passed', () => {
    const s = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
      autoCropped: false,
    })
    expect(s.pages[0].autoCropped).toBe(false)
  })

  it('addPage defaults autoCropped to true', () => {
    const s = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
    })
    expect(s.pages[0].autoCropped).toBe(true)
  })

  it('deletePage removes by id and updates totalSizeBytes', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    s = reducer(s, { type: 'addPage', processedBlob: blob(2000), thumbnailBlob: blob(200) })
    const target = s.pages[0].id
    s = reducer(s, { type: 'deletePage', id: target })
    expect(s.pages).toHaveLength(1)
    expect(s.pages[0].sizeBytes).toBe(2000)
    expect(s.totalSizeBytes).toBe(2000)
  })

  it('warned50MB flips to true once total crosses WARN_BYTES, stays true afterward', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(WARN_BYTES - 10), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(false)
    s = reducer(s, { type: 'addPage', processedBlob: blob(100), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(true)
    s = reducer(s, { type: 'addPage', processedBlob: blob(100), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(true) // still true
  })

  it('setMode updates mode', () => {
    const s = reducer(initialState, { type: 'setMode', mode: 'building-pdf' })
    expect(s.mode).toBe('building-pdf')
  })

  it('setReviewingPage and clearReviewing toggle review state', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    const id = s.pages[0].id
    s = reducer(s, { type: 'setReviewingPage', id })
    expect(s.mode).toBe('reviewing-page')
    expect(s.reviewingPageId).toBe(id)
    s = reducer(s, { type: 'clearReviewing' })
    expect(s.mode).toBe('capturing')
    expect(s.reviewingPageId).toBe(null)
  })

  it('setError moves to error mode', () => {
    const s = reducer(initialState, {
      type: 'setError',
      error: { kind: 'permission', message: 'blocked' },
    })
    expect(s.mode).toBe('error')
    expect(s.error.kind).toBe('permission')
  })

  it('clearError returns to capturing', () => {
    let s = reducer(initialState, { type: 'setError', error: { kind: 'permission', message: 'x' } })
    s = reducer(s, { type: 'clearError' })
    expect(s.mode).toBe('capturing')
    expect(s.error).toBe(null)
  })

  it('reset returns to initialState', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    s = reducer(s, { type: 'reset' })
    expect(s).toEqual(initialState)
  })
})
```

- [ ] **Step 2: Run, verify failure**

```bash
cd fca-web && npm run test:run -- src/components/scanner/hooks/__tests__/useScannerState.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement reducer + hook**

Create `fca-web/src/components/scanner/hooks/useScannerState.js`:

```js
import { useReducer, useCallback } from 'react'

export const WARN_BYTES = 50 * 1024 * 1024 // 50 MB

export const initialState = {
  mode: 'capturing', // 'capturing' | 'reviewing-page' | 'building-pdf' | 'error'
  pages: [],
  reviewingPageId: null,
  totalSizeBytes: 0,
  warned50MB: false,
  error: null,
}

let nextId = 0
function makeId() {
  nextId += 1
  return `p_${Date.now()}_${nextId}`
}

export function reducer(state, action) {
  switch (action.type) {
    case 'addPage': {
      const page = {
        id: makeId(),
        processedBlob: action.processedBlob,
        thumbnailBlob: action.thumbnailBlob,
        sizeBytes: action.processedBlob.size,
        autoCropped: action.autoCropped !== false,
      }
      const totalSizeBytes = state.totalSizeBytes + page.sizeBytes
      const warned50MB = state.warned50MB || totalSizeBytes >= WARN_BYTES
      return { ...state, pages: [...state.pages, page], totalSizeBytes, warned50MB }
    }
    case 'deletePage': {
      const pages = state.pages.filter((p) => p.id !== action.id)
      const totalSizeBytes = pages.reduce((sum, p) => sum + p.sizeBytes, 0)
      return { ...state, pages, totalSizeBytes, reviewingPageId: null, mode: 'capturing' }
    }
    case 'setReviewingPage':
      return { ...state, reviewingPageId: action.id, mode: 'reviewing-page' }
    case 'clearReviewing':
      return { ...state, reviewingPageId: null, mode: 'capturing' }
    case 'setMode':
      return { ...state, mode: action.mode }
    case 'setError':
      return { ...state, mode: 'error', error: action.error }
    case 'clearError':
      return { ...state, mode: 'capturing', error: null }
    case 'reset':
      return initialState
    default:
      return state
  }
}

export function useScannerState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addPage = useCallback((processedBlob, thumbnailBlob, autoCropped = true) => {
    dispatch({ type: 'addPage', processedBlob, thumbnailBlob, autoCropped })
  }, [])
  const deletePage = useCallback((id) => dispatch({ type: 'deletePage', id }), [])
  const setReviewingPage = useCallback((id) => dispatch({ type: 'setReviewingPage', id }), [])
  const clearReviewing = useCallback(() => dispatch({ type: 'clearReviewing' }), [])
  const setMode = useCallback((mode) => dispatch({ type: 'setMode', mode }), [])
  const setError = useCallback((error) => dispatch({ type: 'setError', error }), [])
  const clearError = useCallback(() => dispatch({ type: 'clearError' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, addPage, deletePage, setReviewingPage, clearReviewing, setMode, setError, clearError, reset }
}
```

- [ ] **Step 4: Run tests**

```bash
cd fca-web && npm run test:run -- src/components/scanner/hooks/__tests__/useScannerState.test.js
```

Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/components/scanner/hooks
git commit -m "feat(scanner): add scanner state reducer + hook"
```

---

## Task 5: jscanify lazy loader

**Why:** OpenCV.js is ~3-4 MB gzipped. We only load it on first scan and cache the loaded promise.

**Files:**
- Create: `fca-web/src/components/scanner/lib/jscanifyLoader.js`

- [ ] **Step 1: Install jscanify**

```bash
cd fca-web && npm install jscanify@^1.3.0
```

(Note: jscanify lists OpenCV.js as a peer; we load OpenCV.js dynamically from a CDN in the loader since the npm package is large and not always tree-shake-friendly.)

- [ ] **Step 2: Implement the loader**

Create `fca-web/src/components/scanner/lib/jscanifyLoader.js`:

```js
import jscanify from 'jscanify'

const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js'

let promise = null

function loadOpenCv() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.imread) {
      resolve(window.cv)
      return
    }

    // Some builds expose a cv.onRuntimeInitialized callback
    window.Module = window.Module || {}

    const existing = document.querySelector(`script[data-opencv]`)
    const script = existing || document.createElement('script')
    if (!existing) {
      script.async = true
      script.src = OPENCV_URL
      script.dataset.opencv = '1'
    }

    const onReady = () => {
      if (window.cv && typeof window.cv.then === 'function') {
        // emscripten promise pattern
        window.cv.then((cv) => resolve(cv)).catch(reject)
      } else if (window.cv && window.cv.imread) {
        resolve(window.cv)
      } else if (window.cv) {
        window.cv.onRuntimeInitialized = () => resolve(window.cv)
      } else {
        reject(new Error('OpenCV.js loaded but window.cv is undefined'))
      }
    }

    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => reject(new Error('Failed to load OpenCV.js')), { once: true })

    if (!existing) document.head.appendChild(script)
    else if (window.cv) onReady()
  })
}

export function loadScanner() {
  if (!promise) {
    promise = (async () => {
      try {
        const cv = await loadOpenCv()
        const scanner = new jscanify()
        scanner.loadOpenCV?.(cv)
        return { cv, scanner }
      } catch (err) {
        promise = null // allow retry on failure
        throw err
      }
    })()
  }
  return promise
}

export function _resetForTests() {
  promise = null
}
```

- [ ] **Step 3: Commit (no unit tests — covered by manual testing)**

```bash
git add fca-web/package.json fca-web/package-lock.json fca-web/src/components/scanner/lib/jscanifyLoader.js
git commit -m "feat(scanner): add lazy loader for OpenCV.js + jscanify"
```

---

## Task 6: Page processor

**Why:** Encapsulates jscanify edge detection + perspective correction + JPEG compression behind a simple `processFrame(bitmap)` interface.

**Files:**
- Create: `fca-web/src/components/scanner/lib/pageProcessor.js`
- Test: `fca-web/src/components/scanner/lib/__tests__/pageProcessor.test.js`

- [ ] **Step 1: Write tests against the failure path (the only path testable in jsdom)**

The full pipeline depends on real OpenCV + a real image, which we test manually. The unit-testable behavior is the **fallback** when jscanify can't find a document quad — it returns the original frame with `autoCropped: false`.

Create `fca-web/src/components/scanner/lib/__tests__/pageProcessor.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../jscanifyLoader.js', () => ({
  loadScanner: vi.fn(),
}))

import { loadScanner } from '../jscanifyLoader.js'
import { processFrame } from '../pageProcessor.js'

describe('processFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns autoCropped: false when jscanify cannot find a quad', async () => {
    const fakeCanvas = {
      width: 100,
      height: 100,
      toBlob: (cb) => cb(new Blob(['x'], { type: 'image/jpeg' })),
    }
    loadScanner.mockResolvedValue({
      cv: {},
      scanner: {
        extractPaper: () => { throw new Error('no quad') },
      },
    })

    // mock document.createElement for OffscreenCanvas-less path
    const origCreate = document.createElement
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return fakeCanvas
      return origCreate.call(document, tag)
    })

    const fakeBitmap = { width: 1000, height: 1000, close: () => {} }
    const result = await processFrame(fakeBitmap)

    expect(result.autoCropped).toBe(false)
    expect(result.processedBlob).toBeInstanceOf(Blob)

    document.createElement = origCreate
  })
})
```

- [ ] **Step 2: Run, verify failure**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/pageProcessor.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement processFrame**

Create `fca-web/src/components/scanner/lib/pageProcessor.js`:

```js
import { loadScanner } from './jscanifyLoader.js'

const MAX_LONG_EDGE = 2000
const JPEG_QUALITY = 0.8
const THUMB_LONG_EDGE = 200

function fitDims(w, h, maxEdge) {
  const long = Math.max(w, h)
  if (long <= maxEdge) return { width: w, height: h }
  const scale = maxEdge / long
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

function canvasToJpegBlob(canvas, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      quality,
    )
  })
}

function drawBitmapToCanvas(bitmap, width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

export async function processFrame(bitmap) {
  const { scanner } = await loadScanner()

  // Source canvas at native resolution for jscanify
  const srcCanvas = drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height)

  let croppedCanvas = null
  let autoCropped = true
  try {
    croppedCanvas = scanner.extractPaper(srcCanvas, srcCanvas.width, srcCanvas.height)
    if (!croppedCanvas) {
      autoCropped = false
      croppedCanvas = srcCanvas
    }
  } catch (_) {
    autoCropped = false
    croppedCanvas = srcCanvas
  }

  // Resize to MAX_LONG_EDGE
  const { width, height } = fitDims(croppedCanvas.width, croppedCanvas.height, MAX_LONG_EDGE)
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = width
  finalCanvas.height = height
  finalCanvas.getContext('2d').drawImage(croppedCanvas, 0, 0, width, height)

  const processedBlob = await canvasToJpegBlob(finalCanvas, JPEG_QUALITY)

  // Thumbnail
  const td = fitDims(width, height, THUMB_LONG_EDGE)
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = td.width
  thumbCanvas.height = td.height
  thumbCanvas.getContext('2d').drawImage(finalCanvas, 0, 0, td.width, td.height)
  const thumbnailBlob = await canvasToJpegBlob(thumbCanvas, 0.7)

  return { processedBlob, thumbnailBlob, autoCropped }
}
```

- [ ] **Step 4: Run tests**

```bash
cd fca-web && npm run test:run -- src/components/scanner/lib/__tests__/pageProcessor.test.js
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/components/scanner/lib/pageProcessor.js fca-web/src/components/scanner/lib/__tests__/pageProcessor.test.js
git commit -m "feat(scanner): add page processor (crop, resize, JPEG-compress)"
```

---

## Task 7: ScannerErrorModal

**Files:**
- Create: `fca-web/src/components/scanner/ScannerErrorModal.jsx`
- Test: `fca-web/src/components/scanner/__tests__/ScannerErrorModal.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `fca-web/src/components/scanner/__tests__/ScannerErrorModal.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScannerErrorModal from '../ScannerErrorModal.jsx'

describe('ScannerErrorModal', () => {
  it('renders permission-denied copy', () => {
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/Camera access was blocked/i)).toBeInTheDocument()
  })

  it('renders unsupported-browser copy', () => {
    render(<ScannerErrorModal error={{ kind: 'unsupported' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/doesn't support camera scanning/i)).toBeInTheDocument()
  })

  it('renders http-required copy', () => {
    render(<ScannerErrorModal error={{ kind: 'http' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/secure \(HTTPS\) connection/i)).toBeInTheDocument()
  })

  it('renders no-camera copy', () => {
    render(<ScannerErrorModal error={{ kind: 'no-camera' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/No camera was found/i)).toBeInTheDocument()
  })

  it('renders camera-busy copy', () => {
    render(<ScannerErrorModal error={{ kind: 'camera-busy' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/being used by another app/i)).toBeInTheDocument()
  })

  it('renders generic copy as fallback', () => {
    render(<ScannerErrorModal error={{ kind: 'unknown' }} onRetry={() => {}} onUseFilePicker={() => {}} />)
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
  })

  it('calls onRetry when Try Again is clicked', async () => {
    const onRetry = vi.fn()
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={onRetry} onUseFilePicker={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /Try Again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls onUseFilePicker when Use Upload File Instead is clicked', async () => {
    const onUseFilePicker = vi.fn()
    render(<ScannerErrorModal error={{ kind: 'permission' }} onRetry={() => {}} onUseFilePicker={onUseFilePicker} />)
    await userEvent.click(screen.getByRole('button', { name: /Use Upload File Instead/i }))
    expect(onUseFilePicker).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run, verify failure**

```bash
cd fca-web && npm run test:run -- src/components/scanner/__tests__/ScannerErrorModal.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ScannerErrorModal**

Create `fca-web/src/components/scanner/ScannerErrorModal.jsx`:

```jsx
import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

const COPY = {
  unsupported: {
    title: "Camera scanning isn't available",
    body: "This browser doesn't support camera scanning. Please use the Upload File button instead, or try a modern browser like Chrome, Safari, or Firefox.",
  },
  http: {
    title: "Secure connection required",
    body: "Camera scanning requires a secure (HTTPS) connection. Please reload the page from a secure URL, or use the Upload File button.",
  },
  permission: {
    title: "Camera access blocked",
    body: "Camera access was blocked. Tap How to enable for browser-specific instructions, or use the Upload File button instead.",
    expandable: {
      label: 'How to enable',
      content:
        'iOS Safari: Settings → Safari → Camera → Allow.\nAndroid Chrome: tap the lock icon in the address bar → Permissions → Camera → Allow.\nDesktop: click the camera/lock icon in the address bar and allow camera access for this site.',
    },
  },
  'no-camera': {
    title: "No camera detected",
    body: "No camera was found on this device. Please use the Upload File button instead.",
  },
  'camera-busy': {
    title: "Camera in use",
    body: "Your camera is being used by another app. Close it and try again, or use the Upload File button.",
  },
  'load-failed': {
    title: "Couldn't load the scanner",
    body: "Couldn't load the scanner. Check your connection and try again.",
  },
  unknown: {
    title: "Scanner error",
    body: "Something went wrong starting the scanner. Please try again, or use the Upload File button.",
  },
}

export default function ScannerErrorModal({ error, onRetry, onUseFilePicker }) {
  const [expanded, setExpanded] = useState(false)
  const copy = COPY[error?.kind] || COPY.unknown

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          <div className="p-5 border-b border-white/5">
            <div className="text-heading-primary font-semibold">{copy.title}</div>
            <div className="text-sm text-heading-subdued mt-2 whitespace-pre-line">{copy.body}</div>
            {copy.expandable && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-sm text-blue-300 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {copy.expandable.label}
                </button>
                {expanded && (
                  <div className="text-xs text-heading-subdued mt-2 whitespace-pre-line">
                    {copy.expandable.content}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 flex justify-end gap-2 flex-wrap">
            <Button variant="outline" onClick={onUseFilePicker}>Use Upload File Instead</Button>
            <Button onClick={onRetry}>Try Again</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 4: Run tests**

```bash
cd fca-web && npm run test:run -- src/components/scanner/__tests__/ScannerErrorModal.test.jsx
```

Expected: 8 passing.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/components/scanner/ScannerErrorModal.jsx fca-web/src/components/scanner/__tests__/ScannerErrorModal.test.jsx
git commit -m "feat(scanner): add ScannerErrorModal with cause-specific copy"
```

---

## Task 8: PageThumbnailStrip

**Files:**
- Create: `fca-web/src/components/scanner/PageThumbnailStrip.jsx`

(Visual component — manual testing only.)

- [ ] **Step 1: Implement**

Create `fca-web/src/components/scanner/PageThumbnailStrip.jsx`:

```jsx
import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function ThumbnailItem({ page, onClick }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    const url = URL.createObjectURL(page.thumbnailBlob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [page.thumbnailBlob])

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 h-16 w-12 rounded-md overflow-hidden border border-white/15 bg-black/40 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
      aria-label="Review page"
    >
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      {page.autoCropped === false && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-[10px] text-black font-medium flex items-center justify-center gap-1 py-0.5" title="Couldn't auto-crop this page">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
    </button>
  )
}

export default function PageThumbnailStrip({ pages, onSelectPage }) {
  if (!pages || pages.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto p-2 bg-black/60 border-t border-white/10">
      {pages.map((page, i) => (
        <div key={page.id} className="flex flex-col items-center gap-1">
          <ThumbnailItem page={page} onClick={() => onSelectPage(page.id)} />
          <span className="text-[10px] text-white/70">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add fca-web/src/components/scanner/PageThumbnailStrip.jsx
git commit -m "feat(scanner): add PageThumbnailStrip component"
```

---

## Task 9: CameraView

**Files:**
- Create: `fca-web/src/components/scanner/CameraView.jsx`

(Camera-driven — validated in manual test.)

- [ ] **Step 1: Implement**

Create `fca-web/src/components/scanner/CameraView.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { loadScanner } from './lib/jscanifyLoader.js'

function classifyError(err) {
  const name = err?.name || ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-camera'
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'camera-busy'
  return 'unknown'
}

export default function CameraView({ onCapture, onError }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [phase, setPhase] = useState('initializing') // 'initializing' | 'ready' | 'capturing'

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        await loadScanner()
        if (cancelled) return
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setPhase('ready')
      } catch (err) {
        if (cancelled) return
        const kind = err?.message?.includes('OpenCV') ? 'load-failed' : classifyError(err)
        onError({ kind, message: err?.message || String(err) })
      }
    }
    start()
    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [onError])

  async function handleShutter() {
    if (phase !== 'ready' || !videoRef.current) return
    setPhase('capturing')
    try {
      const video = videoRef.current
      const w = video.videoWidth
      const h = video.videoHeight
      // Some browsers don't have ImageBitmap from a video; fall back to a canvas
      let bitmap
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(video)
      } else {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d').drawImage(video, 0, 0, w, h)
        bitmap = c // processFrame will draw it again — works because drawImage accepts canvas too
      }
      await onCapture(bitmap)
    } finally {
      setPhase('ready')
    }
  }

  return (
    <div className="relative w-full h-full bg-black">
      {phase === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Initializing scanner…</span>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-0 p-4 flex justify-center">
        <Button
          onClick={handleShutter}
          disabled={phase !== 'ready'}
          className="rounded-full w-16 h-16 p-0"
          aria-label="Capture page"
        >
          {phase === 'capturing' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add fca-web/src/components/scanner/CameraView.jsx
git commit -m "feat(scanner): add CameraView with getUserMedia + shutter"
```

---

## Task 10: DocumentScanner top-level component

**Files:**
- Create: `fca-web/src/components/scanner/DocumentScanner.jsx`

- [ ] **Step 1: Implement**

Create `fca-web/src/components/scanner/DocumentScanner.jsx`:

```jsx
import React, { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { confirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { X, Trash2, RefreshCcw, Loader2 } from 'lucide-react'
import CameraView from './CameraView.jsx'
import PageThumbnailStrip from './PageThumbnailStrip.jsx'
import ScannerErrorModal from './ScannerErrorModal.jsx'
import { useScannerState } from './hooks/useScannerState.js'
import { processFrame } from './lib/pageProcessor.js'
import { buildPdf } from './lib/pdfBuilder.js'
import { buildFilename } from './lib/filename.js'

function checkEnvironment() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { kind: 'unsupported' }
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { kind: 'http' }
  }
  return null
}

export default function DocumentScanner({ isOpen, onClose, onComplete, categoryName }) {
  const { state, addPage, deletePage, setReviewingPage, clearReviewing, setMode, setError, clearError, reset } =
    useScannerState()
  const toast = useToast()

  // Environment precheck on open
  useEffect(() => {
    if (!isOpen) return
    const envError = checkEnvironment()
    if (envError) setError(envError)
    return () => reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 50 MB warning toast — fire once when state.warned50MB flips
  useEffect(() => {
    if (state.warned50MB) {
      const mb = (state.totalSizeBytes / (1024 * 1024)).toFixed(0)
      toast?.push?.({
        title: 'Document is getting large',
        description: `${mb} MB so far. Consider finishing now and starting a second scan if needed.`,
        duration: 6000,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.warned50MB])

  const handleCapture = useCallback(
    async (bitmap) => {
      try {
        const { processedBlob, thumbnailBlob, autoCropped } = await processFrame(bitmap)
        addPage(processedBlob, thumbnailBlob, autoCropped)
      } catch (err) {
        setError({ kind: 'unknown', message: err?.message || 'Capture failed' })
      } finally {
        if (bitmap?.close) bitmap.close()
      }
    },
    [addPage, setError],
  )

  const handleDone = useCallback(async () => {
    if (state.pages.length === 0) return
    setMode('building-pdf')
    try {
      const filename = buildFilename(categoryName, new Date())
      const pdfFile = await buildPdf(
        state.pages.map((p) => p.processedBlob),
        { filename },
      )
      onComplete(pdfFile)
      onClose()
    } catch (err) {
      setError({ kind: 'unknown', message: err?.message || 'PDF assembly failed' })
    }
  }, [state.pages, setMode, categoryName, onComplete, onClose, setError])

  const handleClose = useCallback(async () => {
    if (state.pages.length > 0) {
      const ok = await confirm({
        title: `Discard ${state.pages.length} scanned page${state.pages.length === 1 ? '' : 's'}?`,
        confirmText: 'Discard',
        cancelText: 'Keep scanning',
      })
      if (!ok) return
    }
    onClose()
  }, [state.pages.length, onClose])

  const handleRetake = useCallback(() => {
    if (state.reviewingPageId) deletePage(state.reviewingPageId)
  }, [state.reviewingPageId, deletePage])

  const handleDelete = useCallback(() => {
    if (state.reviewingPageId) deletePage(state.reviewingPageId)
  }, [state.reviewingPageId, deletePage])

  if (!isOpen) return null

  const reviewingPage = state.pages.find((p) => p.id === state.reviewingPageId)

  return createPortal(
    <div className="fixed inset-0 z-[1050] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/80">
        <div className="text-white font-medium truncate">{categoryName ? `Scan: ${categoryName}` : 'Scan Document'}</div>
        <button onClick={handleClose} aria-label="Close scanner" className="text-white/80 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 relative">
        {state.mode === 'capturing' && (
          <CameraView
            onCapture={handleCapture}
            onError={(err) => setError(err)}
          />
        )}

        {state.mode === 'reviewing-page' && reviewingPage && (
          <ReviewPagePanel
            page={reviewingPage}
            onRetake={handleRetake}
            onDelete={handleDelete}
            onCancel={clearReviewing}
          />
        )}

        {state.mode === 'building-pdf' && (
          <div className="absolute inset-0 flex items-center justify-center text-white/90">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Building PDF…</span>
            </div>
          </div>
        )}

        {state.mode === 'error' && state.error && (
          <ScannerErrorModal
            error={state.error}
            onRetry={() => clearError()}
            onUseFilePicker={() => onClose()}
          />
        )}
      </div>

      {/* Thumbnail strip + Done */}
      {state.mode !== 'error' && state.mode !== 'building-pdf' && (
        <>
          <PageThumbnailStrip pages={state.pages} onSelectPage={setReviewingPage} />
          <div className="flex justify-end p-3 bg-black/80 border-t border-white/10 gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleDone} disabled={state.pages.length === 0}>
              Done ({state.pages.length})
            </Button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

function ReviewPagePanel({ page, onRetake, onDelete, onCancel }) {
  const [src, setSrc] = React.useState(null)
  React.useEffect(() => {
    const url = URL.createObjectURL(page.processedBlob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [page.processedBlob])

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 flex items-center justify-center p-4">
        {src && <img src={src} alt="Page preview" className="max-h-full max-w-full object-contain" />}
      </div>
      {page.autoCropped === false && (
        <div className="text-amber-300 text-sm text-center pb-2">Couldn't auto-crop this page.</div>
      )}
      <div className="p-3 flex gap-2 justify-center bg-black/80 border-t border-white/10">
        <Button variant="outline" onClick={onCancel}>Back</Button>
        <Button variant="outline" onClick={onRetake}>
          <RefreshCcw className="w-4 h-4 mr-1" /> Retake
        </Button>
        <Button variant="outline" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add fca-web/src/components/scanner/DocumentScanner.jsx
git commit -m "feat(scanner): add DocumentScanner top-level orchestrator"
```

---

## Task 11: Shared upload helper

**Why:** Both compliance pages currently inline the same upload logic. We refactor it into one helper so both the file picker and the scanner upload through the same path.

**Files:**
- Create: `fca-web/src/lib/uploadComplianceDoc.js`
- Test: `fca-web/src/lib/__tests__/uploadComplianceDoc.test.js`

- [ ] **Step 1: Write failing tests**

Create `fca-web/src/lib/__tests__/uploadComplianceDoc.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { uploadComplianceDoc } from '../uploadComplianceDoc.js'

function fakeFile(name, type) {
  return new File(['x'], name, { type })
}

function fakeSupabase(uploadResult = { data: { path: 'ok' }, error: null }) {
  const upload = vi.fn().mockResolvedValue(uploadResult)
  return {
    storage: { from: vi.fn(() => ({ upload })) },
    _upload: upload,
  }
}

describe('uploadComplianceDoc', () => {
  it('uploads PDF to bucket using {ownerId}/compliance/{side}/{itemId}.pdf', async () => {
    const sb = fakeSupabase()
    const result = await uploadComplianceDoc(sb, {
      bucket: 'client-documents',
      ownerId: 'cli_1',
      side: 'left',
      itemId: 'care_plan',
      file: fakeFile('whatever.pdf', 'application/pdf'),
    })
    expect(sb.storage.from).toHaveBeenCalledWith('client-documents')
    expect(sb._upload).toHaveBeenCalledWith(
      'cli_1/compliance/left/care_plan.pdf',
      expect.any(File),
      { upsert: true, contentType: 'application/pdf' },
    )
    expect(result.filePath).toBe('cli_1/compliance/left/care_plan.pdf')
    expect(result.fileName).toBe('whatever.pdf')
  })

  it('uses jpg extension for image/jpeg', async () => {
    const sb = fakeSupabase()
    await uploadComplianceDoc(sb, {
      bucket: 'caregiver-documents',
      ownerId: 'cg_1',
      side: 'right',
      itemId: 'i9',
      file: fakeFile('p.jpg', 'image/jpeg'),
    })
    expect(sb._upload).toHaveBeenCalledWith(
      'cg_1/compliance/right/i9.jpg',
      expect.any(File),
      { upsert: true, contentType: 'image/jpeg' },
    )
  })

  it('rejects unsupported MIME types', async () => {
    const sb = fakeSupabase()
    await expect(
      uploadComplianceDoc(sb, {
        bucket: 'client-documents',
        ownerId: 'cli_1',
        side: 'left',
        itemId: 'care_plan',
        file: fakeFile('p.txt', 'text/plain'),
      }),
    ).rejects.toThrow(/Unsupported file type/i)
  })

  it('throws on supabase upload error', async () => {
    const sb = fakeSupabase({ data: null, error: { message: 'boom' } })
    await expect(
      uploadComplianceDoc(sb, {
        bucket: 'client-documents',
        ownerId: 'cli_1',
        side: 'left',
        itemId: 'care_plan',
        file: fakeFile('x.pdf', 'application/pdf'),
      }),
    ).rejects.toThrow(/boom/)
  })
})
```

- [ ] **Step 2: Run, verify failure**

```bash
cd fca-web && npm run test:run -- src/lib/__tests__/uploadComplianceDoc.test.js
```

- [ ] **Step 3: Implement helper**

Create `fca-web/src/lib/uploadComplianceDoc.js`:

```js
const MIME_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
}

export async function uploadComplianceDoc(supabase, { bucket, ownerId, side, itemId, file }) {
  const ext = MIME_EXT[file.type]
  if (!ext) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`)
  }
  const filePath = `${ownerId}/compliance/${side}/${itemId}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw error
  return {
    filePath,
    fileName: file.name,
    uploadedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd fca-web && npm run test:run -- src/lib/__tests__/uploadComplianceDoc.test.js
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/lib/uploadComplianceDoc.js fca-web/src/lib/__tests__/uploadComplianceDoc.test.js
git commit -m "feat: extract shared compliance upload helper"
```

---

## Task 12: Wire scanner into ClientCompliance

**Files:**
- Modify: `fca-web/src/components/client/ClientCompliance.jsx`

- [ ] **Step 1: Add imports + state**

Open [fca-web/src/components/client/ClientCompliance.jsx](fca-web/src/components/client/ClientCompliance.jsx).

In the imports section (top of file), replace:

```jsx
import { Loader2, Upload, FileText, Download, Printer, X, Check, Eye } from "lucide-react";
```

with:

```jsx
import { Loader2, Upload, FileText, Download, Printer, X, Check, Eye, Camera } from "lucide-react";
import DocumentScanner from "@/components/scanner/DocumentScanner";
import { uploadComplianceDoc } from "@/lib/uploadComplianceDoc";
import { confirm } from "@/components/ui/confirm-dialog";
```

In the component body (around line 36-45 where useState/useRef live), add:

```jsx
const [scannerCategory, setScannerCategory] = useState(null); // { itemId, side, label } | null
```

- [ ] **Step 2: Replace handleFileChange to use the shared helper**

Replace the existing `handleFileChange` (lines 83-135) with:

```jsx
const performUpload = async (file, itemId, side) => {
  setUploadingItem(itemId);
  try {
    const meta = await uploadComplianceDoc(supabase, {
      bucket: "client-documents",
      ownerId: client.id,
      side,
      itemId,
      file,
    });
    const newData = {
      ...complianceData,
      [itemId]: {
        ...complianceData[itemId],
        checked: true,
        ...meta,
      },
    };
    setComplianceData(newData);
    saveComplianceData(newData);
  } catch (error) {
    console.error("Error uploading file:", error);
    alert(error?.message || "Failed to upload file. Please try again.");
  }
  setUploadingItem(null);
};

const handleFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file || !currentUploadItem.current) return;
  const itemId = currentUploadItem.current;
  const side = currentUploadSide.current;
  if (!["application/pdf", "image/jpeg", "image/jpg"].includes(file.type)) {
    alert("Please upload a PDF or JPG file.");
    e.target.value = "";
    return;
  }
  await performUpload(file, itemId, side);
  currentUploadItem.current = null;
  currentUploadSide.current = null;
  e.target.value = "";
};

const triggerScan = (itemId, side, label) => {
  if (readOnly) return;
  setScannerCategory({ itemId, side, label });
};

const handleScanComplete = async (pdfFile) => {
  if (!scannerCategory) return;
  const { itemId, side, label } = scannerCategory;
  const existing = complianceData[itemId]?.filePath;
  if (existing) {
    const ok = await confirm({
      title: `Replace existing ${label}?`,
      description: "This will replace the document already on file.",
      confirmText: "Replace",
      cancelText: "Cancel",
    });
    if (!ok) {
      setScannerCategory(null);
      return;
    }
  }
  await performUpload(pdfFile, itemId, side);
  setScannerCategory(null);
};
```

- [ ] **Step 3: Add the Scan button next to Upload buttons**

Find every place that calls `triggerFileUpload(item.id, "left")` or `triggerFileUpload(item.id, "right")` and add a sibling Scan button. The existing "Upload" button looks like this:

```jsx
<Button
  variant="outline"
  size="sm"
  onClick={() => triggerFileUpload(item.id, "left")}
  disabled={readOnly || uploadingItem === item.id}
>
  <Upload className="w-3.5 h-3.5 mr-1" /> Upload
</Button>
```

Right next to each such button, add:

```jsx
<Button
  variant="outline"
  size="sm"
  onClick={() => triggerScan(item.id, "left", item.label)}
  disabled={readOnly || uploadingItem === item.id}
>
  <Camera className="w-3.5 h-3.5 mr-1" /> Scan
</Button>
```

(Use `"right"` for items on the right side. Use the surrounding `item` variable in scope.)

Use grep to find every Upload button to update:

```bash
grep -n "triggerFileUpload(item.id" fca-web/src/components/client/ClientCompliance.jsx
```

Update each one.

- [ ] **Step 4: Mount the scanner near FilePreviewModal**

Find the `<FilePreviewModal ...>` block (around line 591-598) and add immediately after it:

```jsx
{scannerCategory && (
  <DocumentScanner
    isOpen
    onClose={() => setScannerCategory(null)}
    onComplete={handleScanComplete}
    categoryName={scannerCategory.label}
  />
)}
```

- [ ] **Step 5: Smoke test the build**

```bash
cd fca-web && npm run build
```

Expected: clean build, no TypeScript / ESLint errors.

- [ ] **Step 6: Run all tests**

```bash
cd fca-web && npm run test:run
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add fca-web/src/components/client/ClientCompliance.jsx
git commit -m "feat: wire document scanner into client compliance"
```

---

## Task 13: Wire scanner into CaregiverCompliance

**Files:**
- Modify: `fca-web/src/components/caregiver/CaregiverCompliance.jsx`

Apply the same modifications as Task 12, except:
- Bucket is `"caregiver-documents"`
- Owner id is `caregiver.id` (not `client.id`)
- All `triggerFileUpload(item.id, "left|right")` callsites get a sibling Scan button

- [ ] **Step 1: Apply imports + state + handlers**

Mirror Task 12 Step 1 + Step 2 in [fca-web/src/components/caregiver/CaregiverCompliance.jsx](fca-web/src/components/caregiver/CaregiverCompliance.jsx). Replace `client.id` with `caregiver.id` and `client-documents` with `caregiver-documents`.

The full replacement for `handleFileChange` etc.:

```jsx
const performUpload = async (file, itemId, side) => {
  setUploadingItem(itemId);
  try {
    const meta = await uploadComplianceDoc(supabase, {
      bucket: "caregiver-documents",
      ownerId: caregiver.id,
      side,
      itemId,
      file,
    });
    const newData = {
      ...complianceData,
      [itemId]: {
        ...complianceData[itemId],
        checked: true,
        ...meta,
      },
    };
    setComplianceData(newData);
    saveComplianceData(newData);
  } catch (error) {
    console.error("Error uploading file:", error);
    alert(error?.message || "Failed to upload file. Please try again.");
  }
  setUploadingItem(null);
};

const handleFileChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file || !currentUploadItem.current) return;
  const itemId = currentUploadItem.current;
  const side = currentUploadSide.current;
  if (!["application/pdf", "image/jpeg", "image/jpg"].includes(file.type)) {
    alert("Please upload a PDF or JPG file.");
    e.target.value = "";
    return;
  }
  await performUpload(file, itemId, side);
  currentUploadItem.current = null;
  currentUploadSide.current = null;
  e.target.value = "";
};

const triggerScan = (itemId, side, label) => {
  if (readOnly) return;
  setScannerCategory({ itemId, side, label });
};

const handleScanComplete = async (pdfFile) => {
  if (!scannerCategory) return;
  const { itemId, side, label } = scannerCategory;
  const existing = complianceData[itemId]?.filePath;
  if (existing) {
    const ok = await confirm({
      title: `Replace existing ${label}?`,
      description: "This will replace the document already on file.",
      confirmText: "Replace",
      cancelText: "Cancel",
    });
    if (!ok) {
      setScannerCategory(null);
      return;
    }
  }
  await performUpload(pdfFile, itemId, side);
  setScannerCategory(null);
};
```

- [ ] **Step 2: Add Scan button next to every Upload button (mirror Task 12 Step 3)**

```bash
grep -n "triggerFileUpload(item.id" fca-web/src/components/caregiver/CaregiverCompliance.jsx
```

Add a sibling `<Button>` with the `Camera` icon at each location.

- [ ] **Step 3: Mount the scanner**

Add after the existing `<FilePreviewModal>`:

```jsx
{scannerCategory && (
  <DocumentScanner
    isOpen
    onClose={() => setScannerCategory(null)}
    onComplete={handleScanComplete}
    categoryName={scannerCategory.label}
  />
)}
```

- [ ] **Step 4: Build + tests**

```bash
cd fca-web && npm run build && npm run test:run
```

Expected: clean build, all tests green.

- [ ] **Step 5: Commit**

```bash
git add fca-web/src/components/caregiver/CaregiverCompliance.jsx
git commit -m "feat: wire document scanner into caregiver compliance"
```

---

## Task 14: Manual QA + Vercel preview

**Files:**
- None (validation only)

- [ ] **Step 1: Local dev pass on Mac webcam**

```bash
cd fca-web && npm run dev
```

Open http://localhost:5173 in Chrome. Navigate to a client → Compliance tab.

For one Left-side and one Right-side category:
- [ ] Tap Scan. First time: "Initializing scanner…" appears, then camera turns on.
- [ ] Capture 3 pages. Thumbnail strip shows all 3.
- [ ] Tap thumbnail #2 → Retake → camera comes back, capture replacement.
- [ ] Tap thumbnail #1 → Delete. 2 pages remain.
- [ ] Tap Done. PDF builds, replace-confirm modal does NOT appear (no existing doc).
- [ ] Verify the row now shows the uploaded file. Click the eye icon to preview the PDF — it opens with both pages.
- [ ] Tap Scan again on the same row. Capture 1 page → Done. Confirm modal appears: "Replace existing &lt;label&gt;?". Confirm.
- [ ] Tap Scan, capture 1 page, tap Cancel → confirm dialog "Discard 1 scanned page?". Confirm.

- [ ] **Step 2: Permission-denied path**

In Chrome, block camera permission for localhost (lock icon → Site settings → Camera → Block). Reload page. Tap Scan.

- [ ] Verify: ScannerErrorModal shows "Camera access blocked" with How-to-enable expandable.
- [ ] Tap "Use Upload File Instead" → modal closes. (Existing file picker is reachable from the regular Upload button.)

Re-allow camera permission before continuing.

- [ ] **Step 3: Edge-detection failure inline warning**

Point the camera at a blank wall (no document). Tap shutter. Verify:
- [ ] The page is still captured.
- [ ] Thumbnail shows a small amber warning indicator.
- [ ] If you tap the thumbnail, the review screen shows "Couldn't auto-crop this page."

- [ ] **Step 4: Push branch + open PR for Vercel preview**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: in-app document scanner for compliance" --body "$(cat <<'EOF'
## Summary
- Adds an in-app multi-page document scanner to Client and Caregiver Compliance.
- jscanify (OpenCV.js) edge detection + perspective correction; pdf-lib PDF assembly.
- Lazy-loaded; existing file picker unchanged.

## Test plan
- [ ] Mac webcam, localhost: 3-page scan, retake, delete, replace-confirm, cancel-with-pages
- [ ] Permission-denied modal copy + retry path
- [ ] Edge-detection-failure inline warning
- [ ] iOS Safari (Vercel preview): same scan flows, multi-page PDF opens in iOS Files
- [ ] Android Chrome (Vercel preview): same scan flows
- [ ] Existing file picker (PDF + JPEG) still works for both Client and Caregiver Compliance

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: Vercel posts a preview URL on the PR.

- [ ] **Step 5: iOS Safari pass via preview URL**

On iPhone (Safari):
- [ ] Open the Vercel preview URL, log in, navigate to a client → Compliance.
- [ ] Tap Scan on a category. iOS asks for camera permission → Allow.
- [ ] Capture 3 pages of a real document. Verify auto-crop quality.
- [ ] Done → file uploads → preview the PDF. Open it in Files / Quick Look — verify all 3 pages, legible.
- [ ] Verify replace-confirm flow.

- [ ] **Step 6: Android Chrome pass via preview URL**

Same checklist as Step 5, on Android Chrome.

- [ ] **Step 7: Existing file picker regression check**

On the same preview URL:
- [ ] On Client Compliance, use the regular Upload button to upload an existing PDF — confirm it lands in storage and previews correctly.
- [ ] Same on Caregiver Compliance.
- [ ] Same with a JPEG.

- [ ] **Step 8: Merge**

If all manual checks pass, merge the PR. Done.

---

## Self-Review Notes

- All spec sections (1–14) are covered: filename helper (T2), PDF builder (T3), state/reducer (T4), lazy loader (T5), page processor (T6), error modal (T7), thumbnails (T8), camera (T9), top-level scanner (T10), shared upload helper (T11), Client wiring (T12), Caregiver wiring (T13), manual QA + preview testing (T14).
- No "TBD" / "TODO" / "similar to Task N" placeholders.
- Type/method names consistent across tasks: `loadScanner` / `processFrame` / `buildPdf` / `buildFilename` / `useScannerState` / `uploadComplianceDoc` / `DocumentScanner` are referenced consistently between definition tasks and wiring tasks.
- The `confirm` import path (`@/components/ui/confirm-dialog`) matches the existing codebase.
- The `useToast` API matches the existing toast.jsx (`toast.push({ title, description, duration })`).
- jscanify's `extractPaper(canvas, w, h)` is the documented public API.

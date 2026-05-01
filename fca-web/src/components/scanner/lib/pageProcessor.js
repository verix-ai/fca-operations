import { loadScanner } from './jscanifyLoader.js'

const MAX_LONG_EDGE = 2400
const JPEG_QUALITY = 0.9
const THUMB_LONG_EDGE = 240
// After we pre-crop to the user's framing box, the document should fill most
// of what's left. Require the detected quad to cover at least half the
// pre-cropped area before we trust jscanify's perspective extraction.
export const MIN_QUAD_COVERAGE = 0.5
// Each side of the quad must be at least this long relative to the
// corresponding frame edge — guards against degenerate skinny quads.
export const MIN_QUAD_EDGE_FRACTION = 0.5

export function quadAreaFraction(corners, frameWidth, frameHeight) {
  if (!corners) return 0
  const tl = corners.topLeftCorner
  const tr = corners.topRightCorner
  const br = corners.bottomRightCorner
  const bl = corners.bottomLeftCorner
  if (!tl || !tr || !br || !bl) return 0
  const area =
    Math.abs(
      tl.x * tr.y - tr.x * tl.y +
        tr.x * br.y - br.x * tr.y +
        br.x * bl.y - bl.x * br.y +
        bl.x * tl.y - tl.x * bl.y,
    ) / 2
  const total = frameWidth * frameHeight
  return total > 0 ? area / total : 0
}

export function quadEdgesAreReasonable(corners, frameWidth, frameHeight) {
  if (!corners) return false
  const tl = corners.topLeftCorner
  const tr = corners.topRightCorner
  const br = corners.bottomRightCorner
  const bl = corners.bottomLeftCorner
  if (!tl || !tr || !br || !bl) return false
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
  const top = dist(tl, tr)
  const bottom = dist(bl, br)
  const left = dist(tl, bl)
  const right = dist(tr, br)
  const minHorizontal = Math.min(top, bottom)
  const minVertical = Math.min(left, right)
  return (
    minHorizontal >= frameWidth * MIN_QUAD_EDGE_FRACTION &&
    minVertical >= frameHeight * MIN_QUAD_EDGE_FRACTION
  )
}

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

export async function processFrame(bitmap, options = {}) {
  const { cropHint } = options
  const { cv, scanner } = await loadScanner()

  // Source canvas at native resolution
  const srcCanvas = drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height)

  // Step 1: pre-crop to the user's framing box (when provided). The user
  // already lined up the document inside the static guide, so the cropHint
  // narrows the search space dramatically — jscanify ends up looking for
  // paper edges in a frame that is *mostly* document, which is a much easier
  // problem than scanning the whole webcam scene with shirt + painting +
  // plant + hand.
  let workCanvas = srcCanvas
  let autoCropped = false
  if (cropHint) {
    const x = Math.max(0, Math.min(srcCanvas.width - 1, Math.round(cropHint.x)))
    const y = Math.max(0, Math.min(srcCanvas.height - 1, Math.round(cropHint.y)))
    const w = Math.max(1, Math.min(srcCanvas.width - x, Math.round(cropHint.width)))
    const h = Math.max(1, Math.min(srcCanvas.height - y, Math.round(cropHint.height)))
    // eslint-disable-next-line no-console
    console.log('[scanner] pre-cropping to framing-box hint:', { x, y, w, h })
    const cropped = document.createElement('canvas')
    cropped.width = w
    cropped.height = h
    cropped.getContext('2d').drawImage(srcCanvas, x, y, w, h, 0, 0, w, h)
    workCanvas = cropped
    autoCropped = true
  }

  // Step 2: try to find document edges within workCanvas and apply
  // perspective correction. Pre-cropping makes the doc fill most of the
  // search area; require ≥ MIN_QUAD_COVERAGE so we do not accept jscanify
  // locking onto an interior region.
  let croppedCanvas = workCanvas
  if (cv && scanner) {
    let workMat = null
    try {
      workMat = cv.imread(workCanvas)
      const contour = scanner.findPaperContour?.(workMat)
      if (contour) {
        const corners = scanner.getCornerPoints?.(contour, workMat)
        const coverage = quadAreaFraction(corners, workCanvas.width, workCanvas.height)
        const edgesOk = quadEdgesAreReasonable(corners, workCanvas.width, workCanvas.height)
        // eslint-disable-next-line no-console
        console.log(
          '[scanner] quad on work-canvas — coverage:',
          coverage.toFixed(3),
          'edges-ok:',
          edgesOk,
        )
        if (coverage >= MIN_QUAD_COVERAGE && edgesOk) {
          const extracted = scanner.extractPaper(
            workCanvas,
            workCanvas.width,
            workCanvas.height,
            corners,
          )
          if (extracted) {
            croppedCanvas = extracted
            autoCropped = true
          }
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('[scanner] quad detection threw, keeping working canvas:', err?.message)
    } finally {
      if (workMat) {
        try { workMat.delete() } catch (_) { /* */ }
      }
    }
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

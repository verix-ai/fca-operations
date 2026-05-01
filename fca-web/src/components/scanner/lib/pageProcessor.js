import { loadScanner } from './jscanifyLoader.js'

const MAX_LONG_EDGE = 2000
const JPEG_QUALITY = 0.8
const THUMB_LONG_EDGE = 200
// Minimum fraction of the source frame the detected document quad must cover
// for us to trust the auto-crop. Anything smaller is almost certainly a
// false-positive (jscanify locking onto a paragraph, logo, or sticker inside
// the document) and would produce a "super zoomed-in" crop. Below this
// threshold we discard the crop and keep the full frame instead.
export const MIN_QUAD_COVERAGE = 0.15
// Each side of the quad must be at least this long relative to the
// corresponding frame edge — guards against degenerate skinny quads.
export const MIN_QUAD_EDGE_FRACTION = 0.2

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

export async function processFrame(bitmap) {
  const { cv, scanner } = await loadScanner()

  // Source canvas at native resolution for jscanify
  const srcCanvas = drawBitmapToCanvas(bitmap, bitmap.width, bitmap.height)

  let croppedCanvas = srcCanvas
  let autoCropped = false

  // Try to detect a document quad and validate it before trusting the crop.
  // jscanify will happily extract a tiny interior region (a paragraph or logo)
  // and stretch it to fill the result canvas — that's the "super zoomed-in"
  // failure mode. Validate area + edge lengths before extracting.
  if (cv && scanner) {
    let srcMat = null
    try {
      srcMat = cv.imread(srcCanvas)
      const contour = scanner.findPaperContour?.(srcMat)
      if (contour) {
        const corners = scanner.getCornerPoints?.(contour, srcMat)
        const coverage = quadAreaFraction(corners, srcCanvas.width, srcCanvas.height)
        const edgesOk = quadEdgesAreReasonable(corners, srcCanvas.width, srcCanvas.height)
        // eslint-disable-next-line no-console
        console.log(
          '[scanner] quad detected — coverage:',
          coverage.toFixed(3),
          'edges-ok:',
          edgesOk,
        )
        if (coverage >= MIN_QUAD_COVERAGE && edgesOk) {
          const extracted = scanner.extractPaper(
            srcCanvas,
            srcCanvas.width,
            srcCanvas.height,
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
      console.log('[scanner] quad detection threw, falling back to full frame:', err?.message)
    } finally {
      if (srcMat) {
        try { srcMat.delete() } catch (_) { /* */ }
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

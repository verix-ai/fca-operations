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

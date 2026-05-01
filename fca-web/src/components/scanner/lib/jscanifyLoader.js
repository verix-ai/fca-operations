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

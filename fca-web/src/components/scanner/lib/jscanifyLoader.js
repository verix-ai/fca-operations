// jscanify's "." export points to a Node-only entrypoint (requires `canvas` + `jsdom`)
// and crashes when loaded in the browser. The package exposes a "./client" subpath
// for the browser UMD build — use that instead.
import jscanify from 'jscanify/client'

const OPENCV_URL = 'https://docs.opencv.org/4.10.0/opencv.js'

let promise = null

const READY_TIMEOUT_MS = 30000

// OpenCV.js 4.x ships three different ready conventions depending on the build:
//   1. window.cv is a factory function returning a Promise (current docs.opencv.org build)
//   2. window.cv is already a module with .imread (cached or pre-initialized)
//   3. window.cv is a thenable promise
//   4. window.cv is a Module-style object with onRuntimeInitialized (older builds)
// Detect each and resolve to the fully-initialized cv module.
async function awaitCvReady() {
  const cv = window.cv
  if (!cv) throw new Error('OpenCV.js loaded but window.cv is undefined')
  if (typeof cv === 'function') {
    const mod = await cv()
    window.cv = mod
    return mod
  }
  if (cv.imread) return cv
  if (typeof cv.then === 'function') {
    const mod = await cv
    window.cv = mod
    return mod
  }
  return new Promise((resolve) => {
    cv.onRuntimeInitialized = () => resolve(window.cv)
  })
}

function loadOpenCv() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.imread) {
      resolve(window.cv)
      return
    }

    window.Module = window.Module || {}

    const existing = document.querySelector(`script[data-opencv]`)
    const script = existing || document.createElement('script')
    if (!existing) {
      script.async = true
      script.src = OPENCV_URL
      script.dataset.opencv = '1'
    }

    let settled = false
    const settle = (fn) => (...args) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      fn(...args)
    }
    const onResolve = settle(resolve)
    const onReject = settle(reject)

    const timeoutId = setTimeout(
      () => onReject(new Error(`OpenCV.js did not initialize within ${READY_TIMEOUT_MS}ms`)),
      READY_TIMEOUT_MS,
    )

    const onReady = async () => {
      try {
        const mod = await awaitCvReady()
        onResolve(mod)
      } catch (err) {
        onReject(err)
      }
    }

    script.addEventListener('load', onReady, { once: true })
    script.addEventListener('error', () => onReject(new Error('Failed to load OpenCV.js')), { once: true })

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
        // jscanify reads cv from window.cv at call time, so just confirming it's there
        scanner.loadOpenCV?.(cv)
        return { cv, scanner }
      } catch (err) {
        promise = null // allow retry on failure
        // eslint-disable-next-line no-console
        console.error('[scanner] loadScanner failed:', err)
        throw err
      }
    })()
  }
  return promise
}

export function _resetForTests() {
  promise = null
}

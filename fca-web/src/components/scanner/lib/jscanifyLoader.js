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
  // eslint-disable-next-line no-console
  console.log('[scanner] awaitCvReady — window.cv typeof:', typeof cv, 'has imread:', !!cv?.imread, 'has then:', typeof cv?.then === 'function', 'has onRuntimeInitialized:', 'onRuntimeInitialized' in (cv || {}))
  if (!cv) throw new Error('OpenCV.js loaded but window.cv is undefined')

  // Factory function: call to get the Promise (modern emscripten MODULARIZE)
  if (typeof cv === 'function') {
    // eslint-disable-next-line no-console
    console.log('[scanner] calling window.cv() factory...')
    const mod = await cv()
    // eslint-disable-next-line no-console
    console.log('[scanner] factory resolved, has imread:', !!mod?.imread)
    window.cv = mod
    return mod
  }

  // Thenable: cv IS the Module promise (emscripten MODULARIZE on a pre-init object).
  // imread may exist as a stub even before WASM is ready, so .then takes priority.
  if (typeof cv.then === 'function') {
    // eslint-disable-next-line no-console
    console.log('[scanner] awaiting window.cv thenable...')
    const mod = await cv
    // eslint-disable-next-line no-console
    console.log('[scanner] thenable resolved, has imread:', !!mod?.imread)
    window.cv = mod
    return mod
  }

  // Already-initialized module
  if (cv.imread) {
    // eslint-disable-next-line no-console
    console.log('[scanner] cv already has imread, returning')
    return cv
  }

  // Older Module-style: hook onRuntimeInitialized
  // eslint-disable-next-line no-console
  console.log('[scanner] waiting on cv.onRuntimeInitialized...')
  return new Promise((resolve) => {
    cv.onRuntimeInitialized = () => resolve(window.cv)
  })
}

function loadOpenCv() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.imread) {
      // eslint-disable-next-line no-console
      console.log('[scanner] window.cv already initialized, skipping script load')
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
      // eslint-disable-next-line no-console
      console.log('[scanner] injecting OpenCV.js script tag from', OPENCV_URL)
    } else {
      // eslint-disable-next-line no-console
      console.log('[scanner] reusing existing OpenCV.js script tag')
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
      // eslint-disable-next-line no-console
      console.log('[scanner] script load event fired')
      try {
        const mod = await awaitCvReady()
        // eslint-disable-next-line no-console
        console.log('[scanner] OpenCV.js fully ready')
        onResolve(mod)
      } catch (err) {
        onReject(err)
      }
    }

    script.addEventListener('load', onReady, { once: true })
    script.addEventListener(
      'error',
      (e) => {
        // eslint-disable-next-line no-console
        console.error('[scanner] script error event:', e)
        onReject(new Error('Failed to load OpenCV.js'))
      },
      { once: true },
    )

    if (!existing) document.head.appendChild(script)
    else if (window.cv) onReady()
  })
}

export function loadScanner() {
  if (!promise) {
    // eslint-disable-next-line no-console
    console.log('[scanner] loadScanner: starting fresh load')
    promise = (async () => {
      try {
        const cv = await loadOpenCv()
        // eslint-disable-next-line no-console
        console.log('[scanner] OpenCV ready, constructing jscanify')
        const scanner = new jscanify()
        scanner.loadOpenCV?.(cv)
        // eslint-disable-next-line no-console
        console.log('[scanner] loadScanner: complete')
        return { cv, scanner }
      } catch (err) {
        promise = null // allow retry on failure
        // eslint-disable-next-line no-console
        console.error('[scanner] loadScanner failed:', err)
        throw err
      }
    })()
  } else {
    // eslint-disable-next-line no-console
    console.log('[scanner] loadScanner: returning cached promise')
  }
  return promise
}

export function _resetForTests() {
  promise = null
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { loadScanner } from './lib/jscanifyLoader.js'
import {
  quadAreaFraction,
  quadEdgesAreReasonable,
  MIN_QUAD_COVERAGE,
  MIN_QUAD_EDGE_FRACTION,
} from './lib/pageProcessor.js'

// Auto-capture: poll detection on the framing-box region, fire shutter when
// the document has been confidently detected for several consecutive frames.
const AUTO_DETECT_INTERVAL_MS = 333 // ~3 fps; cheap and human-perceptible
const AUTO_DETECT_LONG_EDGE = 480 // downscale before running OpenCV; plenty
const STABLE_THRESHOLD = 3 // consecutive successful detections to call it "stable"
const AUTO_FIRE_AT = 4 // fire one tick after stable to give the user a beat to settle
const AUTO_FIRE_COOLDOWN_MS = 2500 // don't immediately re-fire after a capture

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
  const frameBoxRef = useRef(null)
  const cvRef = useRef(null)
  const scannerRef = useRef(null)
  const detectIntervalRef = useRef(null)
  const stableCountRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const handleShutterRef = useRef(null)
  const [phase, setPhase] = useState('initializing') // 'initializing' | 'ready' | 'capturing'
  const [filter, setFilter] = useState('bw') // 'bw' | 'color'
  const [autoMode, setAutoMode] = useState(true)
  const [detectionState, setDetectionState] = useState('idle') // 'idle' | 'partial' | 'stable'

  // Map the on-screen framing box to natural video coordinates, accounting for
  // object-cover scaling. Returns null if anything isn't ready yet.
  const computeCropHint = useCallback(() => {
    const video = videoRef.current
    const box = frameBoxRef.current
    if (!video || !box) return null
    const naturalW = video.videoWidth
    const naturalH = video.videoHeight
    if (!naturalW || !naturalH) return null
    const videoRect = video.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    if (!videoRect.width || !videoRect.height) return null

    const scale = Math.max(videoRect.width / naturalW, videoRect.height / naturalH)
    const visibleNaturalW = videoRect.width / scale
    const visibleNaturalH = videoRect.height / scale
    const cropOffsetX = (naturalW - visibleNaturalW) / 2
    const cropOffsetY = (naturalH - visibleNaturalH) / 2

    const boxRelX = boxRect.left - videoRect.left
    const boxRelY = boxRect.top - videoRect.top

    return {
      x: cropOffsetX + boxRelX / scale,
      y: cropOffsetY + boxRelY / scale,
      width: boxRect.width / scale,
      height: boxRect.height / scale,
    }
  }, [])

  const handleShutter = useCallback(async () => {
    if (phase !== 'ready' || !videoRef.current) return
    setPhase('capturing')
    try {
      const video = videoRef.current
      const w = video.videoWidth
      const h = video.videoHeight
      const cropHint = computeCropHint()
      let bitmap
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(video)
      } else {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d').drawImage(video, 0, 0, w, h)
        bitmap = c
      }
      // Reset stability + cooldown so auto-fire doesn't immediately re-trigger
      stableCountRef.current = 0
      cooldownUntilRef.current = Date.now() + AUTO_FIRE_COOLDOWN_MS
      setDetectionState('idle')
      await onCapture(bitmap, { cropHint, filter })
    } finally {
      setPhase('ready')
    }
  }, [phase, computeCropHint, filter, onCapture])

  // Keep the ref in sync so the polling loop can fire shutter without being
  // re-created every render (which would restart the interval).
  useEffect(() => {
    handleShutterRef.current = handleShutter
  }, [handleShutter])

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const { cv, scanner } = await loadScanner()
        cvRef.current = cv
        scannerRef.current = scanner
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
        startDetectionLoop()
      } catch (err) {
        if (cancelled) return
        const kind = err?.message?.includes('OpenCV') ? 'load-failed' : classifyError(err)
        onError({ kind, message: err?.message || String(err) })
      }
    }

    function startDetectionLoop() {
      if (detectIntervalRef.current) return
      detectIntervalRef.current = setInterval(() => {
        if (cancelled) return
        runDetection()
      }, AUTO_DETECT_INTERVAL_MS)
    }

    function runDetection() {
      const video = videoRef.current
      const box = frameBoxRef.current
      const cv = cvRef.current
      const scanner = scannerRef.current
      if (!video || !box || !cv || !scanner) return
      if (video.readyState < 2 || video.videoWidth === 0) return

      // Pre-crop to the framing-box region (in natural coords) before running
      // detection. Same crop the capture path will use, so what we see is
      // what we get.
      const naturalW = video.videoWidth
      const naturalH = video.videoHeight
      const videoRect = video.getBoundingClientRect()
      const boxRect = box.getBoundingClientRect()
      if (!videoRect.width) return
      const scale = Math.max(videoRect.width / naturalW, videoRect.height / naturalH)
      const visibleNaturalW = videoRect.width / scale
      const visibleNaturalH = videoRect.height / scale
      const cropOffsetX = (naturalW - visibleNaturalW) / 2
      const cropOffsetY = (naturalH - visibleNaturalH) / 2
      const boxRelX = boxRect.left - videoRect.left
      const boxRelY = boxRect.top - videoRect.top
      const cropX = Math.max(0, cropOffsetX + boxRelX / scale)
      const cropY = Math.max(0, cropOffsetY + boxRelY / scale)
      const cropW = Math.min(naturalW - cropX, boxRect.width / scale)
      const cropH = Math.min(naturalH - cropY, boxRect.height / scale)
      if (cropW < 50 || cropH < 50) return

      const longEdge = Math.max(cropW, cropH)
      const downScale = longEdge > AUTO_DETECT_LONG_EDGE ? AUTO_DETECT_LONG_EDGE / longEdge : 1
      const dw = Math.round(cropW * downScale)
      const dh = Math.round(cropH * downScale)
      const tmp = document.createElement('canvas')
      tmp.width = dw
      tmp.height = dh
      tmp.getContext('2d').drawImage(video, cropX, cropY, cropW, cropH, 0, 0, dw, dh)

      let mat = null
      let valid = false
      try {
        mat = cv.imread(tmp)
        const contour = scanner.findPaperContour?.(mat)
        if (contour) {
          const corners = scanner.getCornerPoints?.(contour, mat)
          const coverage = quadAreaFraction(corners, dw, dh)
          const edgesOk = quadEdgesAreReasonable(corners, dw, dh)
          valid =
            !!corners &&
            coverage >= MIN_QUAD_COVERAGE &&
            coverage >= MIN_QUAD_EDGE_FRACTION &&
            edgesOk
        }
      } catch (_) {
        valid = false
      } finally {
        if (mat) {
          try { mat.delete() } catch (_) { /* */ }
        }
      }

      if (valid) stableCountRef.current += 1
      else stableCountRef.current = 0
      const c = stableCountRef.current
      const next = c === 0 ? 'idle' : c < STABLE_THRESHOLD ? 'partial' : 'stable'
      setDetectionState((prev) => (prev === next ? prev : next))

      // Auto-fire one beat after stable, with cooldown after each capture.
      if (
        autoMode &&
        c >= AUTO_FIRE_AT &&
        Date.now() >= cooldownUntilRef.current &&
        handleShutterRef.current
      ) {
        handleShutterRef.current()
      }
    }

    async function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!streamRef.current?.getVideoTracks().some((t) => t.readyState === 'ended')) return
      streamRef.current.getTracks().forEach((t) => t.stop())
      try {
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
      } catch (err) {
        if (cancelled) return
        onError({ kind: classifyError(err), message: err?.message || String(err) })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    start()
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current)
        detectIntervalRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [onError, autoMode])

  // Border / ring color reflects detection state. NO movement, just a static
  // color change so the UI doesn't feel jumpy.
  const boxBorderClass =
    detectionState === 'stable'
      ? 'border-emerald-400 border-solid'
      : detectionState === 'partial'
      ? 'border-amber-300 border-dashed'
      : 'border-white/85 border-dashed'

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {phase === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 z-20">
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
        className="absolute inset-0 w-full h-full object-cover"
      />

      {phase === 'ready' && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              ref={frameBoxRef}
              className={`rounded-lg border-2 transition-colors duration-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] ${boxBorderClass}`}
              style={{ aspectRatio: '5 / 6', height: '90%', maxWidth: '94%' }}
            />
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/70 text-white shadow-md whitespace-nowrap">
              {detectionState === 'stable' && autoMode
                ? 'Hold steady — capturing…'
                : 'Frame your document inside the box'}
            </div>
            <div className="pointer-events-auto flex gap-2">
              <div className="inline-flex p-0.5 rounded-full bg-black/70 shadow-md text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setFilter('bw')}
                  className={`px-3 py-1 rounded-full transition ${
                    filter === 'bw' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                  aria-pressed={filter === 'bw'}
                >
                  B&amp;W
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('color')}
                  className={`px-3 py-1 rounded-full transition ${
                    filter === 'color' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                  aria-pressed={filter === 'color'}
                >
                  Color
                </button>
              </div>
              <div className="inline-flex p-0.5 rounded-full bg-black/70 shadow-md text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAutoMode(true)}
                  className={`px-3 py-1 rounded-full transition ${
                    autoMode ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                  aria-pressed={autoMode}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => setAutoMode(false)}
                  className={`px-3 py-1 rounded-full transition ${
                    !autoMode ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                  }`}
                  aria-pressed={!autoMode}
                >
                  Manual
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="absolute inset-x-0 bottom-0 p-6 flex justify-center pointer-events-none z-10">
        <button
          type="button"
          onClick={handleShutter}
          disabled={phase !== 'ready'}
          aria-label="Capture page"
          className={`pointer-events-auto rounded-full w-20 h-20 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition ring-4 ${
            detectionState === 'stable' ? 'ring-emerald-400' : 'ring-white/30'
          }`}
        >
          {phase === 'capturing' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
        </button>
      </div>
    </div>
  )
}

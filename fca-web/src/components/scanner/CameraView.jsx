import React, { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { loadScanner } from './lib/jscanifyLoader.js'
import {
  quadAreaFraction,
  quadEdgesAreReasonable,
  MIN_QUAD_COVERAGE,
  MIN_QUAD_EDGE_FRACTION,
} from './lib/pageProcessor.js'

// How often to run quad detection on the live preview. Each detection runs
// jscanify on a downscaled frame — fast, but not free. ~4 fps is plenty for a
// guidance overlay.
const PREVIEW_DETECT_INTERVAL_MS = 250
// Detection runs on a downscaled frame for performance. 640px on the long edge
// is enough resolution for jscanify to find the document edges.
const PREVIEW_DETECT_LONG_EDGE = 640

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
  const overlayRef = useRef(null)
  const detectIntervalRef = useRef(null)
  const cvRef = useRef(null)
  const scannerRef = useRef(null)
  const [phase, setPhase] = useState('initializing') // 'initializing' | 'ready' | 'capturing'
  const [quadValid, setQuadValid] = useState(false)

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
      }, PREVIEW_DETECT_INTERVAL_MS)
    }

    function runDetection() {
      const video = videoRef.current
      const overlay = overlayRef.current
      const cv = cvRef.current
      const scanner = scannerRef.current
      if (!video || !overlay || !cv || !scanner) return
      if (video.readyState < 2 || video.videoWidth === 0) return

      const vw = video.videoWidth
      const vh = video.videoHeight
      const longEdge = Math.max(vw, vh)
      const scale = longEdge > PREVIEW_DETECT_LONG_EDGE ? PREVIEW_DETECT_LONG_EDGE / longEdge : 1
      const dw = Math.round(vw * scale)
      const dh = Math.round(vh * scale)

      // Draw current frame to a small canvas
      const tmp = document.createElement('canvas')
      tmp.width = dw
      tmp.height = dh
      tmp.getContext('2d').drawImage(video, 0, 0, dw, dh)

      let mat = null
      let detected = null
      try {
        mat = cv.imread(tmp)
        const contour = scanner.findPaperContour?.(mat)
        if (contour) {
          detected = scanner.getCornerPoints?.(contour, mat) || null
        }
      } catch (_) {
        detected = null
      } finally {
        if (mat) {
          try { mat.delete() } catch (_) { /* */ }
        }
      }

      const coverage = detected ? quadAreaFraction(detected, dw, dh) : 0
      const edgesOk = detected ? quadEdgesAreReasonable(detected, dw, dh) : false
      const valid = !!detected && coverage >= MIN_QUAD_COVERAGE && edgesOk
      setQuadValid(valid)

      // Match overlay canvas to the rendered video size, then draw the quad
      // using overlay-pixel coordinates derived from the detection-frame size.
      const rect = video.getBoundingClientRect()
      overlay.width = rect.width
      overlay.height = rect.height
      const ctx = overlay.getContext('2d')
      ctx.clearRect(0, 0, overlay.width, overlay.height)

      if (detected) {
        // We detected on a dw x dh frame; the video element is rendered at
        // rect.width x rect.height (object-cover scales the underlying video).
        // Compute object-cover transform: scale so the smaller dimension fills,
        // then center the larger.
        const videoAspect = vw / vh
        const renderAspect = rect.width / rect.height
        let scaleX, scaleY, offsetX, offsetY
        if (videoAspect > renderAspect) {
          // video wider than render area; height fills, width crops
          scaleY = rect.height / vh
          scaleX = scaleY
          offsetX = (rect.width - vw * scaleX) / 2
          offsetY = 0
        } else {
          scaleX = rect.width / vw
          scaleY = scaleX
          offsetX = 0
          offsetY = (rect.height - vh * scaleY) / 2
        }
        const toRenderX = (x) => offsetX + (x / dw) * vw * scaleX
        const toRenderY = (y) => offsetY + (y / dh) * vh * scaleY

        const pts = [
          detected.topLeftCorner,
          detected.topRightCorner,
          detected.bottomRightCorner,
          detected.bottomLeftCorner,
        ]
        ctx.lineWidth = valid ? 4 : 3
        ctx.strokeStyle = valid ? '#22c55e' : '#ef4444' // green or red
        ctx.fillStyle = valid ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.12)'
        ctx.beginPath()
        ctx.moveTo(toRenderX(pts[0].x), toRenderY(pts[0].y))
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(toRenderX(pts[i].x), toRenderY(pts[i].y))
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }

    async function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!streamRef.current?.getVideoTracks().some((t) => t.readyState === 'ended')) return
      // Track ended while backgrounded — silently re-acquire without changing phase
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
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
      {phase === 'ready' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium shadow-md ${
              quadValid
                ? 'bg-emerald-500 text-white'
                : 'bg-black/70 text-white'
            }`}
          >
            {quadValid ? '✓ Document detected — tap shutter' : 'Position document fully in frame'}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-6 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={handleShutter}
          disabled={phase !== 'ready'}
          aria-label="Capture page"
          className="pointer-events-auto rounded-full w-20 h-20 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-4 ring-white/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition"
        >
          {phase === 'capturing' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
        </button>
      </div>
    </div>
  )
}

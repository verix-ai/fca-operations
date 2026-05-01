import React, { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
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
  const frameBoxRef = useRef(null)
  const [phase, setPhase] = useState('initializing') // 'initializing' | 'ready' | 'capturing'

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        // Warm up OpenCV.js + jscanify so detection at capture time is instant.
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [onError])

  // Map the on-screen framing box to natural video coordinates, accounting for
  // object-cover scaling. Returns null if anything isn't ready yet.
  function computeCropHint() {
    const video = videoRef.current
    const box = frameBoxRef.current
    if (!video || !box) return null
    const naturalW = video.videoWidth
    const naturalH = video.videoHeight
    if (!naturalW || !naturalH) return null
    const videoRect = video.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()
    if (!videoRect.width || !videoRect.height) return null

    // object-cover: video is scaled to cover the container, cropping the
    // overflowing axis equally on both sides.
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
  }

  async function handleShutter() {
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
      await onCapture(bitmap, cropHint)
    } finally {
      setPhase('ready')
    }
  }

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

      {/* Static framing guide — portrait letter aspect (8.5:11), centered.
          The dimmed shadow around the box draws focus to the framed area like
          the iOS Notes scanner. Edge detection still runs at capture time. */}
      {phase === 'ready' && (
        <>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              ref={frameBoxRef}
              className="rounded-lg border-2 border-white/85 border-dashed shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{ aspectRatio: '5 / 6', height: '90%', maxWidth: '94%' }}
            />
          </div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/70 text-white shadow-md whitespace-nowrap">
              Frame your document inside the box
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
          className="pointer-events-auto rounded-full w-20 h-20 bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-4 ring-white/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition"
        >
          {phase === 'capturing' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Camera className="w-8 h-8" />}
        </button>
      </div>
    </div>
  )
}

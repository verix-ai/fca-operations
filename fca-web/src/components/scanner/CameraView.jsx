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

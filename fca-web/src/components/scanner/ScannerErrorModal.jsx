import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'

const COPY = {
  unsupported: {
    title: "Camera scanning isn't available",
    body: "This browser doesn't support camera scanning. Please use the Upload File button instead, or try a modern browser like Chrome, Safari, or Firefox.",
  },
  http: {
    title: "Secure connection required",
    body: "Camera scanning requires a secure (HTTPS) connection. Please reload the page from a secure URL, or use the Upload File button.",
  },
  permission: {
    title: "Camera access blocked",
    body: "Camera access was blocked. Tap How to enable for browser-specific instructions, or use the Upload File button instead.",
    expandable: {
      label: 'How to enable',
      content:
        'iOS Safari: Settings → Safari → Camera → Allow.\nAndroid Chrome: tap the lock icon in the address bar → Permissions → Camera → Allow.\nDesktop: click the camera/lock icon in the address bar and allow camera access for this site.',
    },
  },
  'no-camera': {
    title: "No camera detected",
    body: "No camera was found on this device. Please use the Upload File button instead.",
  },
  'camera-busy': {
    title: "Camera in use",
    body: "Your camera is being used by another app. Close it and try again, or use the Upload File button.",
  },
  'load-failed': {
    title: "Couldn't load the scanner",
    body: "Couldn't load the scanner. Check your connection and try again.",
  },
  unknown: {
    title: "Scanner error",
    body: "Something went wrong starting the scanner. Please try again, or use the Upload File button.",
  },
}

export default function ScannerErrorModal({ error, onRetry, onUseFilePicker }) {
  const [expanded, setExpanded] = useState(false)
  const copy = COPY[error?.kind] || COPY.unknown

  return createPortal(
    <div className="fixed inset-0 z-[1100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          <div className="p-5 border-b border-white/5">
            <div className="text-heading-primary font-semibold">{copy.title}</div>
            <div className="text-sm text-heading-subdued mt-2 whitespace-pre-line">{copy.body}</div>
            {copy.expandable && (
              <div className="mt-3">
                <button
                  type="button"
                  className="text-sm text-blue-300 hover:underline"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {copy.expandable.label}
                </button>
                {expanded && (
                  <div className="text-xs text-heading-subdued mt-2 whitespace-pre-line">
                    {copy.expandable.content}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 flex justify-end gap-2 flex-wrap">
            <Button variant="outline" onClick={onUseFilePicker}>Use Upload File Instead</Button>
            <Button onClick={onRetry}>Try Again</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

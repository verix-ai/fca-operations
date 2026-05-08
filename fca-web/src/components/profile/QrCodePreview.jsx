import React, { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Download, Copy, Check } from 'lucide-react'

const PUBLIC_BASE = 'https://friendlycareagency.org/ref/'

export default function QrCodePreview({ slug }) {
  const canvasRef = useRef(null)
  const [pngDataUrl, setPngDataUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const url = slug ? `${PUBLIC_BASE}${slug}` : ''

  useEffect(() => {
    if (!slug || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 240,
    }).catch(() => {/* ignore */})
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 1024,
    }).then(setPngDataUrl).catch(() => setPngDataUrl(''))
  }, [slug, url])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked — silently ignore */ }
  }

  const handleDownload = () => {
    if (!pngDataUrl) return
    const a = document.createElement('a')
    a.href = pngDataUrl
    a.download = `fca-referral-qr-${slug}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!slug) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 text-center">
        Save a slug to generate your QR code.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <canvas ref={canvasRef} className="rounded-lg border border-slate-200 bg-white" aria-label="QR code for your referral link" />
        <div className="flex-1 space-y-2">
          <div className="text-sm">
            <div className="text-slate-500 mb-1">Your public link:</div>
            <div className="font-mono text-emerald-700 break-all">{url}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy link'}
            </Button>
            <Button type="button" variant="outline" onClick={handleDownload} disabled={!pngDataUrl}>
              <Download className="w-4 h-4 mr-1" /> Download QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

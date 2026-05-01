import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

function ThumbnailItem({ page, onClick }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    const url = URL.createObjectURL(page.thumbnailBlob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [page.thumbnailBlob])

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative shrink-0 h-16 w-12 rounded-md overflow-hidden border border-white/15 bg-black/40 hover:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/40"
      aria-label="Review page"
    >
      {src && <img src={src} alt="" className="h-full w-full object-cover" />}
      {page.autoCropped === false && (
        <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-[10px] text-black font-medium flex items-center justify-center gap-1 py-0.5" title="Couldn't auto-crop this page">
          <AlertTriangle className="w-3 h-3" />
        </div>
      )}
    </button>
  )
}

export default function PageThumbnailStrip({ pages, onSelectPage }) {
  if (!pages || pages.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto p-2 bg-black/60 border-t border-white/10">
      {pages.map((page, i) => (
        <div key={page.id} className="flex flex-col items-center gap-1">
          <ThumbnailItem page={page} onClick={() => onSelectPage(page.id)} />
          <span className="text-[10px] text-white/70">{i + 1}</span>
        </div>
      ))}
    </div>
  )
}

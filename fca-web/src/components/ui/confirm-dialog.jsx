import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { createPortal } from 'react-dom'
import { Button } from './primitives.jsx'

function Modal({ title = 'Are you sure?', description, confirmText = 'Confirm', cancelText = 'Cancel', onResolve }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onResolve(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onResolve])

  const content = (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onResolve(false)} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[rgba(147,165,197,0.25)] bg-hero-card shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)]">
          <div className="p-5 border-b border-white/5">
            <div className="text-heading-primary font-semibold">{title}</div>
            {description && <div className="text-sm text-heading-subdued mt-1">{description}</div>}
          </div>
          <div className="p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onResolve(false)}>{cancelText}</Button>
            <Button onClick={() => onResolve(true)}>{confirmText}</Button>
          </div>
        </div>
      </div>
    </div>
  )
  return createPortal(content, document.body)
}

export function confirm({ title, description, confirmText = 'OK', cancelText = 'Cancel' } = {}) {
  return new Promise((resolve) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const handle = (value) => {
      root.unmount()
      container.remove()
      resolve(value)
    }
    root.render(
      <Modal title={title} description={description} confirmText={confirmText} cancelText={cancelText} onResolve={handle} />
    )
  })
}

export default { confirm }



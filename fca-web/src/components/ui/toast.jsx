import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastCtx = createContext(null)

let idCounter = 0
function nextId() { idCounter += 1; return `t_${idCounter}` }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback(({ title, description, variant = 'default', actionLabel, onAction, duration = 4000 }) => {
    const id = nextId()
    const toast = { id, title, description, variant, actionLabel, onAction }
    setToasts((prev) => [...prev, toast])
    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }
    return id
  }, [remove])

  const ctx = useMemo(() => ({ push, remove }), [push, remove])

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <Toaster toasts={toasts} onClose={remove} />
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function Toaster({ toasts, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map(t => (
        <div key={t.id} className={`min-w-[260px] max-w-[360px] rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm ${t.variant === 'destructive' ? 'bg-red-600/20 border-red-400/30 text-red-100' : 'bg-slate-800/70 border-slate-700/60 text-slate-100'}`}>
          {t.title && <div className="font-semibold">{t.title}</div>}
          {t.description && <div className="text-sm text-slate-300 mt-1">{t.description}</div>}
          {(t.actionLabel || true) && (
            <div className="mt-2 flex justify-end gap-2">
              {t.actionLabel && (
                <button
                  className="px-2 py-1 text-sm rounded-lg border border-slate-600/60 hover:bg-slate-700/60"
                  onClick={() => { t.onAction && t.onAction(); onClose(t.id) }}
                >
                  {t.actionLabel}
                </button>
              )}
              <button className="px-2 py-1 text-sm rounded-lg border border-slate-600/60 hover:bg-slate-700/60" onClick={() => onClose(t.id)}>Close</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default {}



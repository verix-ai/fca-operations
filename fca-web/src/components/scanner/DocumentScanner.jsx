import React, { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { confirm } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'
import { X, Trash2, RefreshCcw, Loader2 } from 'lucide-react'
import CameraView from './CameraView.jsx'
import PageThumbnailStrip from './PageThumbnailStrip.jsx'
import ScannerErrorModal from './ScannerErrorModal.jsx'
import { useScannerState } from './hooks/useScannerState.js'
import { processFrame } from './lib/pageProcessor.js'
import { buildPdf } from './lib/pdfBuilder.js'
import { buildFilename } from './lib/filename.js'

function checkEnvironment() {
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return { kind: 'unsupported' }
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return { kind: 'http' }
  }
  return null
}

export default function DocumentScanner({ isOpen, onClose, onComplete, categoryName }) {
  const { state, addPage, deletePage, setReviewingPage, clearReviewing, setMode, setError, clearError, reset } =
    useScannerState()
  const toast = useToast()

  // Environment precheck on open
  useEffect(() => {
    if (!isOpen) return
    const envError = checkEnvironment()
    if (envError) setError(envError)
    return () => reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 50 MB warning toast — fire once when state.warned50MB flips
  useEffect(() => {
    if (state.warned50MB) {
      const mb = (state.totalSizeBytes / (1024 * 1024)).toFixed(0)
      toast?.push?.({
        title: 'Document is getting large',
        description: `${mb} MB so far. Consider finishing now and starting a second scan if needed.`,
        duration: 6000,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.warned50MB])

  const handleCapture = useCallback(
    async (bitmap) => {
      try {
        const { processedBlob, thumbnailBlob, autoCropped } = await processFrame(bitmap)
        addPage(processedBlob, thumbnailBlob, autoCropped)
      } catch (err) {
        setError({ kind: 'unknown', message: err?.message || 'Capture failed' })
      } finally {
        if (bitmap?.close) bitmap.close()
      }
    },
    [addPage, setError],
  )

  const handleDone = useCallback(async () => {
    if (state.pages.length === 0) return
    setMode('building-pdf')
    try {
      const filename = buildFilename(categoryName, new Date())
      const pdfFile = await buildPdf(
        state.pages.map((p) => p.processedBlob),
        { filename },
      )
      onComplete(pdfFile)
      onClose()
    } catch (err) {
      setError({ kind: 'unknown', message: err?.message || 'PDF assembly failed' })
    }
  }, [state.pages, setMode, categoryName, onComplete, onClose, setError])

  const handleClose = useCallback(async () => {
    if (state.pages.length > 0) {
      const ok = await confirm({
        title: `Discard ${state.pages.length} scanned page${state.pages.length === 1 ? '' : 's'}?`,
        confirmText: 'Discard',
        cancelText: 'Keep scanning',
      })
      if (!ok) return
    }
    onClose()
  }, [state.pages.length, onClose])

  const handleRetake = useCallback(() => {
    if (state.reviewingPageId) deletePage(state.reviewingPageId)
  }, [state.reviewingPageId, deletePage])

  const handleDelete = useCallback(() => {
    if (state.reviewingPageId) deletePage(state.reviewingPageId)
  }, [state.reviewingPageId, deletePage])

  if (!isOpen) return null

  const reviewingPage = state.pages.find((p) => p.id === state.reviewingPageId)

  return createPortal(
    <div className="fixed inset-0 z-[1050] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-black/80">
        <div className="text-white font-medium truncate">{categoryName ? `Scan: ${categoryName}` : 'Scan Document'}</div>
        <button onClick={handleClose} aria-label="Close scanner" className="text-white/80 hover:text-white">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Body — min-h-0 + overflow-hidden so the high-res video doesn't push the bottom bar off-screen */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {state.mode === 'capturing' && (
          <CameraView
            onCapture={handleCapture}
            onError={(err) => setError(err)}
          />
        )}

        {state.mode === 'reviewing-page' && reviewingPage && (
          <ReviewPagePanel
            page={reviewingPage}
            onRetake={handleRetake}
            onDelete={handleDelete}
            onCancel={clearReviewing}
          />
        )}

        {state.mode === 'building-pdf' && (
          <div className="absolute inset-0 flex items-center justify-center text-white/90">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Building PDF…</span>
            </div>
          </div>
        )}

        {state.mode === 'error' && state.error && (
          <ScannerErrorModal
            error={state.error}
            onRetry={() => clearError()}
            onUseFilePicker={() => onClose()}
          />
        )}
      </div>

      {/* Thumbnail strip + Done */}
      {state.mode !== 'error' && state.mode !== 'building-pdf' && (
        <>
          <PageThumbnailStrip pages={state.pages} onSelectPage={setReviewingPage} />
          <div className="flex justify-end p-3 bg-black/80 border-t border-white/10 gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleDone} disabled={state.pages.length === 0}>
              Done ({state.pages.length})
            </Button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}

function ReviewPagePanel({ page, onRetake, onDelete, onCancel }) {
  const [src, setSrc] = React.useState(null)
  React.useEffect(() => {
    const url = URL.createObjectURL(page.processedBlob)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [page.processedBlob])

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="flex-1 flex items-center justify-center p-4">
        {src && <img src={src} alt="Page preview" className="max-h-full max-w-full object-contain" />}
      </div>
      {page.autoCropped === false && (
        <div className="text-amber-300 text-sm text-center pb-2">Couldn't auto-crop this page.</div>
      )}
      <div className="p-3 flex gap-2 justify-center bg-black/80 border-t border-white/10">
        <Button variant="outline" onClick={onCancel}>Back</Button>
        <Button variant="outline" onClick={onRetake}>
          <RefreshCcw className="w-4 h-4 mr-1" /> Retake
        </Button>
        <Button variant="outline" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" /> Delete
        </Button>
      </div>
    </div>
  )
}

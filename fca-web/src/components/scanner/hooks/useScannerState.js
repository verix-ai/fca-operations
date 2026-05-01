import { useReducer, useCallback } from 'react'

export const WARN_BYTES = 50 * 1024 * 1024 // 50 MB

export const initialState = {
  mode: 'capturing', // 'capturing' | 'reviewing-page' | 'building-pdf' | 'error'
  pages: [],
  reviewingPageId: null,
  totalSizeBytes: 0,
  warned50MB: false,
  error: null,
}

let nextId = 0
function makeId() {
  nextId += 1
  return `p_${Date.now()}_${nextId}`
}

export function reducer(state, action) {
  switch (action.type) {
    case 'addPage': {
      const page = {
        id: makeId(),
        processedBlob: action.processedBlob,
        thumbnailBlob: action.thumbnailBlob,
        sizeBytes: action.processedBlob.size,
        autoCropped: action.autoCropped !== false,
      }
      const totalSizeBytes = state.totalSizeBytes + page.sizeBytes
      const warned50MB = state.warned50MB || totalSizeBytes >= WARN_BYTES
      return { ...state, pages: [...state.pages, page], totalSizeBytes, warned50MB }
    }
    case 'deletePage': {
      const pages = state.pages.filter((p) => p.id !== action.id)
      const totalSizeBytes = pages.reduce((sum, p) => sum + p.sizeBytes, 0)
      return { ...state, pages, totalSizeBytes, reviewingPageId: null, mode: 'capturing' }
    }
    case 'setReviewingPage':
      return { ...state, reviewingPageId: action.id, mode: 'reviewing-page' }
    case 'clearReviewing':
      return { ...state, reviewingPageId: null, mode: 'capturing' }
    case 'setMode':
      return { ...state, mode: action.mode }
    case 'setError':
      return { ...state, mode: 'error', error: action.error }
    case 'clearError':
      return { ...state, mode: 'capturing', error: null }
    case 'reset':
      return initialState
    default:
      return state
  }
}

export function useScannerState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addPage = useCallback((processedBlob, thumbnailBlob, autoCropped = true) => {
    dispatch({ type: 'addPage', processedBlob, thumbnailBlob, autoCropped })
  }, [])
  const deletePage = useCallback((id) => dispatch({ type: 'deletePage', id }), [])
  const setReviewingPage = useCallback((id) => dispatch({ type: 'setReviewingPage', id }), [])
  const clearReviewing = useCallback(() => dispatch({ type: 'clearReviewing' }), [])
  const setMode = useCallback((mode) => dispatch({ type: 'setMode', mode }), [])
  const setError = useCallback((error) => dispatch({ type: 'setError', error }), [])
  const clearError = useCallback(() => dispatch({ type: 'clearError' }), [])
  const reset = useCallback(() => dispatch({ type: 'reset' }), [])

  return { state, addPage, deletePage, setReviewingPage, clearReviewing, setMode, setError, clearError, reset }
}

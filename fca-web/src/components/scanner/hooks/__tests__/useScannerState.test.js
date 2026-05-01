import { describe, it, expect } from 'vitest'
import { reducer, initialState, WARN_BYTES } from '../useScannerState.js'

function blob(size) {
  return { size, type: 'image/jpeg' }
}

describe('scanner reducer', () => {
  it('starts in capturing mode with no pages', () => {
    expect(initialState.mode).toBe('capturing')
    expect(initialState.pages).toEqual([])
    expect(initialState.totalSizeBytes).toBe(0)
    expect(initialState.warned50MB).toBe(false)
  })

  it('addPage appends a page and updates totalSizeBytes', () => {
    const s1 = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
    })
    expect(s1.pages).toHaveLength(1)
    expect(s1.pages[0].sizeBytes).toBe(1000)
    expect(s1.pages[0].id).toBeTruthy()
    expect(s1.totalSizeBytes).toBe(1000)
  })

  it('addPage flags autoCropped: false when passed', () => {
    const s = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
      autoCropped: false,
    })
    expect(s.pages[0].autoCropped).toBe(false)
  })

  it('addPage defaults autoCropped to true', () => {
    const s = reducer(initialState, {
      type: 'addPage',
      processedBlob: blob(1000),
      thumbnailBlob: blob(100),
    })
    expect(s.pages[0].autoCropped).toBe(true)
  })

  it('deletePage removes by id and updates totalSizeBytes', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    s = reducer(s, { type: 'addPage', processedBlob: blob(2000), thumbnailBlob: blob(200) })
    const target = s.pages[0].id
    s = reducer(s, { type: 'deletePage', id: target })
    expect(s.pages).toHaveLength(1)
    expect(s.pages[0].sizeBytes).toBe(2000)
    expect(s.totalSizeBytes).toBe(2000)
  })

  it('warned50MB flips to true once total crosses WARN_BYTES, stays true afterward', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(WARN_BYTES - 10), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(false)
    s = reducer(s, { type: 'addPage', processedBlob: blob(100), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(true)
    s = reducer(s, { type: 'addPage', processedBlob: blob(100), thumbnailBlob: blob(1) })
    expect(s.warned50MB).toBe(true) // still true
  })

  it('setMode updates mode', () => {
    const s = reducer(initialState, { type: 'setMode', mode: 'building-pdf' })
    expect(s.mode).toBe('building-pdf')
  })

  it('setReviewingPage and clearReviewing toggle review state', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    const id = s.pages[0].id
    s = reducer(s, { type: 'setReviewingPage', id })
    expect(s.mode).toBe('reviewing-page')
    expect(s.reviewingPageId).toBe(id)
    s = reducer(s, { type: 'clearReviewing' })
    expect(s.mode).toBe('capturing')
    expect(s.reviewingPageId).toBe(null)
  })

  it('setError moves to error mode', () => {
    const s = reducer(initialState, {
      type: 'setError',
      error: { kind: 'permission', message: 'blocked' },
    })
    expect(s.mode).toBe('error')
    expect(s.error.kind).toBe('permission')
  })

  it('clearError returns to capturing', () => {
    let s = reducer(initialState, { type: 'setError', error: { kind: 'permission', message: 'x' } })
    s = reducer(s, { type: 'clearError' })
    expect(s.mode).toBe('capturing')
    expect(s.error).toBe(null)
  })

  it('reset returns to initialState', () => {
    let s = reducer(initialState, { type: 'addPage', processedBlob: blob(1000), thumbnailBlob: blob(100) })
    s = reducer(s, { type: 'reset' })
    expect(s).toEqual(initialState)
  })
})

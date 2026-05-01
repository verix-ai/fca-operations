import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../jscanifyLoader.js', () => ({
  loadScanner: vi.fn(),
}))

import { loadScanner } from '../jscanifyLoader.js'
import { processFrame } from '../pageProcessor.js'

describe('processFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns autoCropped: false when jscanify cannot find a quad', async () => {
    const fakeCanvas = {
      width: 100,
      height: 100,
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (cb) => cb(new Blob(['x'], { type: 'image/jpeg' })),
    }
    loadScanner.mockResolvedValue({
      cv: {},
      scanner: {
        extractPaper: () => { throw new Error('no quad') },
      },
    })

    // mock document.createElement for OffscreenCanvas-less path
    const origCreate = document.createElement
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return fakeCanvas
      return origCreate.call(document, tag)
    })

    const fakeBitmap = { width: 1000, height: 1000, close: () => {} }
    const result = await processFrame(fakeBitmap)

    expect(result.autoCropped).toBe(false)
    expect(result.processedBlob).toBeInstanceOf(Blob)

    document.createElement = origCreate
  })
})

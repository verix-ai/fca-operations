import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../pdfBuilder.js'

// 1x1 red JPEG (smallest valid JPEG), base64-decoded to bytes
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z'

function makeJpegBlob() {
  const bin = atob(TINY_JPEG_BASE64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: 'image/jpeg' })
}

describe('buildPdf', () => {
  it('returns a File with application/pdf MIME and given filename', async () => {
    const file = await buildPdf([makeJpegBlob()], { filename: 'test.pdf' })
    expect(file).toBeInstanceOf(File)
    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('test.pdf')
  })

  it('produces a parseable PDF with N pages for N input blobs', async () => {
    const file = await buildPdf([makeJpegBlob(), makeJpegBlob(), makeJpegBlob()], { filename: 'three.pdf' })
    const buf = await file.arrayBuffer()
    const doc = await PDFDocument.load(buf)
    expect(doc.getPageCount()).toBe(3)
  })

  it('throws on empty input', async () => {
    await expect(buildPdf([], { filename: 'x.pdf' })).rejects.toThrow(/at least one page/i)
  })
})

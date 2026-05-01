import { describe, it, expect, vi } from 'vitest'
import { uploadComplianceDoc } from '../uploadComplianceDoc.js'

function fakeFile(name, type) {
  return new File(['x'], name, { type })
}

function fakeSupabase(uploadResult = { data: { path: 'ok' }, error: null }) {
  const upload = vi.fn().mockResolvedValue(uploadResult)
  return {
    storage: { from: vi.fn(() => ({ upload })) },
    _upload: upload,
  }
}

describe('uploadComplianceDoc', () => {
  it('uploads PDF to bucket using {ownerId}/compliance/{side}/{itemId}.pdf', async () => {
    const sb = fakeSupabase()
    const result = await uploadComplianceDoc(sb, {
      bucket: 'client-documents',
      ownerId: 'cli_1',
      side: 'left',
      itemId: 'care_plan',
      file: fakeFile('whatever.pdf', 'application/pdf'),
    })
    expect(sb.storage.from).toHaveBeenCalledWith('client-documents')
    expect(sb._upload).toHaveBeenCalledWith(
      'cli_1/compliance/left/care_plan.pdf',
      expect.any(File),
      { upsert: true, contentType: 'application/pdf' },
    )
    expect(result.filePath).toBe('cli_1/compliance/left/care_plan.pdf')
    expect(result.fileName).toBe('whatever.pdf')
  })

  it('uses jpg extension for image/jpeg', async () => {
    const sb = fakeSupabase()
    await uploadComplianceDoc(sb, {
      bucket: 'caregiver-documents',
      ownerId: 'cg_1',
      side: 'right',
      itemId: 'i9',
      file: fakeFile('p.jpg', 'image/jpeg'),
    })
    expect(sb._upload).toHaveBeenCalledWith(
      'cg_1/compliance/right/i9.jpg',
      expect.any(File),
      { upsert: true, contentType: 'image/jpeg' },
    )
  })

  it('rejects unsupported MIME types', async () => {
    const sb = fakeSupabase()
    await expect(
      uploadComplianceDoc(sb, {
        bucket: 'client-documents',
        ownerId: 'cli_1',
        side: 'left',
        itemId: 'care_plan',
        file: fakeFile('p.txt', 'text/plain'),
      }),
    ).rejects.toThrow(/Unsupported file type/i)
  })

  it('throws on supabase upload error', async () => {
    const sb = fakeSupabase({ data: null, error: { message: 'boom' } })
    await expect(
      uploadComplianceDoc(sb, {
        bucket: 'client-documents',
        ownerId: 'cli_1',
        side: 'left',
        itemId: 'care_plan',
        file: fakeFile('x.pdf', 'application/pdf'),
      }),
    ).rejects.toThrow(/boom/)
  })
})

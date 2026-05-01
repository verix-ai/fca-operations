import { describe, it, expect } from 'vitest'
import { buildFilename } from '../filename.js'

const date = new Date('2026-05-01T12:00:00Z')

describe('buildFilename', () => {
  it('formats simple category names', () => {
    expect(buildFilename('Driver License', date)).toBe('driver-license-2026-05-01.pdf')
  })

  it('strips apostrophes', () => {
    expect(buildFilename("Driver's License", date)).toBe('drivers-license-2026-05-01.pdf')
  })

  it('collapses multiple non-alphanumeric chars to single hyphen', () => {
    expect(buildFilename('TB / PPD Test', date)).toBe('tb-ppd-test-2026-05-01.pdf')
  })

  it('trims leading and trailing hyphens', () => {
    expect(buildFilename('  Hello  ', date)).toBe('hello-2026-05-01.pdf')
    expect(buildFilename('!!! Title !!!', date)).toBe('title-2026-05-01.pdf')
  })

  it('lowercases', () => {
    expect(buildFilename('APPENDIX L', date)).toBe('appendix-l-2026-05-01.pdf')
  })

  it('falls back to "document" for empty/all-symbol input', () => {
    expect(buildFilename('!!!', date)).toBe('document-2026-05-01.pdf')
    expect(buildFilename('', date)).toBe('document-2026-05-01.pdf')
  })

  it('formats date as YYYY-MM-DD using local time', () => {
    const d = new Date(2026, 0, 5) // Jan 5 2026, local
    expect(buildFilename('Doc', d)).toBe('doc-2026-01-05.pdf')
  })
})

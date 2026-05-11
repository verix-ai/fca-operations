import { describe, it, expect } from 'vitest'
import { diffTrackedFields, TRACKED_FIELDS } from '../referral-diff'

describe('referral-diff', () => {
  it('returns no diffs when nothing tracked changed', () => {
    const before = { code: '303', home_care_company: 'FCA', assessment_complete: false }
    const updates = { caregiver_name: 'Bob' } // not tracked
    expect(diffTrackedFields(before, updates)).toEqual([])
  })

  it('returns a diff entry for each changed tracked field', () => {
    const before = { code: null, home_care_company: 'FCA', cm_company: 'Acme', cm_call_status: 'awaiting' }
    const updates = { code: '303', home_care_company: 'Genesis', cm_company: 'Acme', cm_call_status: 'contacted' }
    const diffs = diffTrackedFields(before, updates)
    expect(diffs).toEqual([
      { field: 'code', oldValue: null, newValue: '303' },
      { field: 'home_care_company', oldValue: 'FCA', newValue: 'Genesis' },
      { field: 'cm_call_status', oldValue: 'awaiting', newValue: 'contacted' },
    ])
  })

  it('treats boolean changes as tracked', () => {
    const before = { assessment_complete: false, waiting_state_approval: false }
    const updates = { assessment_complete: true }
    expect(diffTrackedFields(before, updates)).toEqual([
      { field: 'assessment_complete', oldValue: false, newValue: true },
    ])
  })

  it('exports the canonical list of tracked fields', () => {
    expect(TRACKED_FIELDS).toEqual([
      'code',
      'home_care_company',
      'cm_company',
      'cm_call_status',
      'assessment_complete',
      'waiting_state_approval',
    ])
  })
})

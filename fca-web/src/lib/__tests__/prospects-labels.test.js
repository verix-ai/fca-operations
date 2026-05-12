import { describe, it, expect } from 'vitest'
import {
  CODE_OPTIONS,
  HOME_CARE_COMPANY_OPTIONS,
  CM_CALL_STATUS_OPTIONS,
  ARCHIVE_REASON_OPTIONS,
  archiveReasonLabel,
  cmCallStatusLabel,
  fieldChangeLabel,
} from '../prospects-labels'

describe('prospects-labels', () => {
  it('exposes the agreed code values', () => {
    expect(CODE_OPTIONS.map(o => o.value)).toEqual(['301','303','660','661','Other','None Found'])
  })

  it('exposes the agreed home care companies with FCA first', () => {
    expect(HOME_CARE_COMPANY_OPTIONS[0].value).toBe('FCA')
    expect(HOME_CARE_COMPANY_OPTIONS.map(o => o.value)).toEqual(
      ['FCA','Genesis','Gateway','Alice Place','Affordable']
    )
  })

  it('exposes the three call statuses', () => {
    expect(CM_CALL_STATUS_OPTIONS.map(o => o.value)).toEqual(['awaiting','need_resend','contacted'])
  })

  it('maps archive reasons to human labels', () => {
    expect(archiveReasonLabel('passed_to_hcc')).toBe('Passed to another home care company')
    expect(archiveReasonLabel('not_eligible')).toBe('Not eligible')
    expect(archiveReasonLabel('lost_contact')).toBe('Lost contact')
    expect(archiveReasonLabel('duplicate')).toBe('Duplicate')
    expect(archiveReasonLabel('other')).toBe('Other')
    expect(archiveReasonLabel(null)).toBe('')
  })

  it('maps call statuses to human labels', () => {
    expect(cmCallStatusLabel('awaiting')).toBe('Awaiting CM company contact')
    expect(cmCallStatusLabel('need_resend')).toBe('No call yet — need to resend referral')
    expect(cmCallStatusLabel('contacted')).toBe('CM company has contacted client')
  })

  it('produces human-readable field-change phrasing', () => {
    expect(fieldChangeLabel('code', 'None Found', '303')).toBe('Code changed from None Found → 303')
    expect(fieldChangeLabel('home_care_company', 'FCA', 'Genesis')).toBe('Home Care Company changed from FCA → Genesis')
    expect(fieldChangeLabel('cm_company', null, 'Acme CM')).toBe('CM Company changed from (none) → Acme CM')
    expect(fieldChangeLabel('assessment_complete', 'false', 'true')).toBe('Assessment marked complete')
    expect(fieldChangeLabel('assessment_complete', 'true', 'false')).toBe('Assessment unmarked')
    expect(fieldChangeLabel('waiting_state_approval', 'false', 'true')).toBe('Marked waiting on state approval')
    expect(fieldChangeLabel('waiting_state_approval', 'true', 'false')).toBe('No longer waiting on state approval')
    expect(fieldChangeLabel('cm_call_status', 'awaiting', 'contacted'))
      .toBe('CM call status changed from Awaiting CM company contact → CM company has contacted client')
    expect(fieldChangeLabel('referral_sent', 'false', 'true')).toBe('Referral marked sent')
    expect(fieldChangeLabel('referral_sent', 'true', 'false')).toBe('Referral marked not sent')
  })
})

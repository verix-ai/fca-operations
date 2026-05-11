export const CODE_OPTIONS = [
  { value: '301', label: '301' },
  { value: '303', label: '303' },
  { value: '660', label: '660' },
  { value: '661', label: '661' },
  { value: 'Other', label: 'Other' },
  { value: 'None Found', label: 'None Found' },
]

export const HOME_CARE_COMPANY_OPTIONS = [
  { value: 'FCA', label: 'FCA' },
  { value: 'Genesis', label: 'Genesis' },
  { value: 'Gateway', label: 'Gateway' },
  { value: 'Alice Place', label: 'Alice Place' },
  { value: 'Affordable', label: 'Affordable' },
]

export const CM_CALL_STATUS_OPTIONS = [
  { value: 'awaiting', label: 'Awaiting CM company contact' },
  { value: 'need_resend', label: 'No call yet — need to resend referral' },
  { value: 'contacted', label: 'CM company has contacted client' },
]

export const ARCHIVE_REASON_OPTIONS = [
  { value: 'passed_to_hcc', label: 'Passed to another home care company' },
  { value: 'not_eligible', label: 'Not eligible' },
  { value: 'lost_contact', label: 'Lost contact' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
]

function lookup(options, value) {
  if (value === null || value === undefined || value === '') return ''
  const hit = options.find(o => o.value === value)
  return hit ? hit.label : String(value)
}

export const archiveReasonLabel = (v) => lookup(ARCHIVE_REASON_OPTIONS, v)
export const cmCallStatusLabel  = (v) => lookup(CM_CALL_STATUS_OPTIONS, v)

const FIELD_TITLES = {
  code: 'Code',
  home_care_company: 'Home Care Company',
  cm_company: 'CM Company',
  cm_call_status: 'CM call status',
}

const fmt = (v) => (v === null || v === undefined || v === '') ? '(none)' : v

/**
 * Build the human-readable phrasing for a field_change history entry.
 * Booleans use bespoke phrasing per the spec; other fields use a generic
 * "<Title> changed from <old> → <new>" pattern.
 */
export function fieldChangeLabel(field, oldValue, newValue) {
  if (field === 'assessment_complete') {
    return newValue === 'true' ? 'Assessment marked complete' : 'Assessment unmarked'
  }
  if (field === 'waiting_state_approval') {
    return newValue === 'true' ? 'Marked waiting on state approval' : 'No longer waiting on state approval'
  }
  const title = FIELD_TITLES[field] || field
  const oldLabel = field === 'cm_call_status' ? (cmCallStatusLabel(oldValue) || fmt(oldValue)) : fmt(oldValue)
  const newLabel = field === 'cm_call_status' ? (cmCallStatusLabel(newValue) || fmt(newValue)) : fmt(newValue)
  return `${title} changed from ${oldLabel} → ${newLabel}`
}

export const TRACKED_FIELDS = [
  'code',
  'home_care_company',
  'cm_company',
  'cm_call_status',
  'assessment_complete',
  'waiting_state_approval',
]

/**
 * Returns one diff entry per tracked field whose value changes from `before`
 * to `updates`. A field is "changed" when:
 *   - it is present in `updates`, AND
 *   - the new value !== the old value (loose null/undefined coerce to null first)
 */
export function diffTrackedFields(before, updates) {
  const norm = (v) => (v === undefined ? null : v)
  const out = []
  for (const field of TRACKED_FIELDS) {
    if (!(field in updates)) continue
    const oldValue = norm(before?.[field])
    const newValue = norm(updates[field])
    if (oldValue !== newValue) {
      out.push({ field, oldValue, newValue })
    }
  }
  return out
}

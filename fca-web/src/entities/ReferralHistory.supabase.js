import { supabase } from '@/lib/supabase'

async function getUserContext() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('users')
    .select('organization_id, name')
    .eq('id', user.id)
    .single()
  if (error) throw error
  if (!profile?.organization_id) throw new Error('User not assigned to an organization')

  return { userId: user.id, organizationId: profile.organization_id, name: profile.name }
}

/**
 * Append-only audit log for the Prospects page. Mirrors lead_status_history.
 * Three event types are written:
 *   - 'note'         — manual user note
 *   - 'field_change' — automatic, emitted from Referral.update() diffs
 *   - 'archive' / 'unarchive' — emitted from Referral.archive()/unarchive()
 */
export const ReferralHistory = {
  /** Full history for one referral, newest first. */
  async list(referralId) {
    const { data, error } = await supabase
      .from('referral_status_history')
      .select('*')
      .eq('referral_id', referralId)
      .order('changed_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  /** Write a manual note. */
  async addNote(referralId, note) {
    const trimmed = (note || '').trim()
    if (!trimmed) throw new Error('Note cannot be empty')
    const { userId, organizationId, name } = await getUserContext()

    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'note',
        note: trimmed,
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Write a field-change event. Used internally by Referral.update(). */
  async addFieldChange(referralId, { field, oldValue, newValue }) {
    const { userId, organizationId, name } = await getUserContext()
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'field_change',
        field_name: field,
        old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
        new_value: newValue === null || newValue === undefined ? null : String(newValue),
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Write an archive event. Reason/note are inlined into the note text for display. */
  async addArchiveEvent(referralId, { reason, note }) {
    const { userId, organizationId, name } = await getUserContext()
    const summary = note?.trim()
      ? `Archived — Reason: ${reason}. Note: "${note.trim()}"`
      : `Archived — Reason: ${reason}`
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'archive',
        note: summary,
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async addUnarchiveEvent(referralId) {
    const { userId, organizationId, name } = await getUserContext()
    const { data, error } = await supabase
      .from('referral_status_history')
      .insert({
        referral_id: referralId,
        organization_id: organizationId,
        event_type: 'unarchive',
        note: 'Unarchived',
        changed_by: userId,
        changed_by_name: name,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },
}

export default ReferralHistory

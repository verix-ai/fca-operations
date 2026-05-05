import { supabase } from '@/lib/supabase'

async function getUserOrganization() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('users')
    .select('organization_id, role, name')
    .eq('id', user.id)
    .single()

  if (error) throw error
  if (!profile?.organization_id) throw new Error('User not assigned to an organization')

  return { userId: user.id, organizationId: profile.organization_id, role: profile.role, name: profile.name }
}

const STATUS_VALUES = ['new', 'contacted', 'didnt_answer', 'signed_up', 'doesnt_qualify']

export const Lead = {
  STATUS_VALUES,

  /**
   * List leads with rich filter / pagination support.
   *
   * @param {Object} opts
   * @param {'active'|'archived'} [opts.view='active']  - active = not archived
   * @param {'GA'|'OUT_OF_STATE'|'all'} [opts.state='GA']
   * @param {string[]} [opts.statuses]                   - filter to these statuses (omit for all)
   * @param {string|null} [opts.county]                  - exact county match
   * @param {string} [opts.search]                       - matches name/email/phone (ilike)
   * @param {string} [opts.dateFrom]                     - ISO date, inclusive
   * @param {string} [opts.dateTo]                       - ISO date, inclusive
   * @param {number} [opts.page=1]
   * @param {number} [opts.pageSize=25]
   * @returns {Promise<{ rows: Array, total: number }>}
   */
  async list(opts = {}) {
    const {
      view = 'active',
      state = 'GA',
      statuses,
      county,
      search,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 25,
    } = opts

    const { organizationId } = await getUserOrganization()

    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (view === 'archived') {
      query = query.not('archived_at', 'is', null)
    } else {
      query = query.is('archived_at', null)
    }

    if (state && state !== 'all') {
      query = query.eq('state', state)
    }

    if (Array.isArray(statuses) && statuses.length > 0) {
      query = query.in('status', statuses)
    }

    if (county) {
      query = query.eq('county', county)
    }

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)

    if (search && search.trim()) {
      const term = `%${search.trim()}%`
      // OR-match on name / email / phone
      query = query.or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throw error
    return { rows: data || [], total: count ?? 0 }
  },

  /** Distinct counties currently in use (for the County filter dropdown). */
  async distinctCounties() {
    const { organizationId } = await getUserOrganization()
    const { data, error } = await supabase
      .from('leads')
      .select('county')
      .eq('organization_id', organizationId)
      .not('county', 'is', null)
    if (error) throw error
    const set = new Set((data || []).map(r => r.county).filter(Boolean))
    return [...set].sort()
  },

  async get(id) {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  /** Update status. The DB trigger logs the change to lead_status_history automatically. */
  async setStatus(id, status) {
    if (!STATUS_VALUES.includes(status)) {
      throw new Error(`Invalid status: ${status}`)
    }
    const { data, error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /**
   * Append an immutable note entry to the lead's history. Each call adds a
   * new row to lead_status_history with no status transition; notes can never
   * be edited or deleted from the UI — this is an append-only audit log.
   */
  async addNote(leadId, note) {
    const trimmed = (note || '').trim()
    if (!trimmed) throw new Error('Note cannot be empty')

    const { userId, name } = await getUserOrganization()

    const { data, error } = await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        from_status: null,
        to_status: null,
        changed_by: userId,
        changed_by_name: name,
        note: trimmed,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async archive(id) {
    const { userId } = await getUserOrganization()
    const { data, error } = await supabase
      .from('leads')
      .update({ archived_at: new Date().toISOString(), archived_by: userId })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async unarchive(id) {
    const { data, error } = await supabase
      .from('leads')
      .update({ archived_at: null, archived_by: null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  /** Status history + notes for a single lead, newest first. */
  async statusHistory(leadId) {
    const { data, error } = await supabase
      .from('lead_status_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('changed_at', { ascending: false })
    if (error) throw error
    return data || []
  },
}

export default Lead

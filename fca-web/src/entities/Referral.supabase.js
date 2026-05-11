import { supabase } from '@/lib/supabase'
import { SupabaseService } from '@/services/supabaseService'
import { diffTrackedFields, TRACKED_FIELDS } from '@/lib/referral-diff'
import ReferralHistory from '@/entities/ReferralHistory.supabase'

const referralService = new SupabaseService('referrals')

/**
 * Get current user's organization ID
 */
async function getUserOrganization() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: userProfile, error } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (error) throw error
  if (!userProfile?.organization_id) {
    throw new Error('User not assigned to an organization')
  }

  return { userId: user.id, organizationId: userProfile.organization_id }
}

/**
 * Parse and merge notes field from referral data
 */
function parseReferralNotes(referral) {
  if (!referral) return referral
  
  // If notes is a JSON string, parse it and merge into the object
  if (referral.notes && typeof referral.notes === 'string') {
    try {
      const parsed = JSON.parse(referral.notes)
      return { ...referral, ...parsed }
    } catch {
      // If parsing fails, just return as-is
      return referral
    }
  }
  
  return referral
}

export const Referral = {
  /**
   * List referrals in the current user's organization.
   *
   * @param {Object} [opts]
   * @param {'active'|'archived'|'all'} [opts.view] - omit (or 'all') for no archive filter
   * @param {string} [opts.cmCompany]
   * @param {string} [opts.homeCareCompany]
   * @param {string} [opts.county]     - JSON-blob field; filtered client-side after fetch
   * @param {string} [opts.search]     - search term; filtered client-side
   * @param {string} [opts.dateFrom]   - ISO date, inclusive
   * @param {string} [opts.dateTo]     - ISO date, inclusive
   */
  async list(opts = {}) {
    const { view, cmCompany, homeCareCompany, dateFrom, dateTo } = opts

    let query = supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false })

    if (view === 'archived') query = query.not('archived_at', 'is', null)
    else if (view === 'active') query = query.is('archived_at', null)
    // else (view undefined or 'all') -> no archive filter; preserves legacy callers

    if (cmCompany) query = query.eq('cm_company', cmCompany)
    if (homeCareCompany) query = query.eq('home_care_company', homeCareCompany)
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) {
      // If the caller passed a date-only string (no time component), normalize
      // to end-of-day so the bound is inclusive. Anything that already includes
      // a time component is used as-is.
      const isoEnd = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo
      query = query.lte('created_at', isoEnd)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []).map(parseReferralNotes)
  },

  /**
   * Get a single referral by ID
   * @param {string} id - Referral ID
   * @returns {Promise<Object>} Referral object
   */
  async get(id) {
    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        client:clients(id, first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return parseReferralNotes(data)
  },

  /**
   * Get referrals for a specific client
   * @param {string} clientId - Client ID
   * @returns {Promise<Array>} Array of referrals for the client
   */
  async getByClient(clientId) {
    return referralService.list({
      filters: { client_id: clientId },
      sort: 'created_at:desc'
    })
  },

  /**
   * Create a new referral
   * @param {Object} data - Referral data
   * @param {string} data.client_id - Client ID (optional - null for prospects)
   * @param {string} data.referred_by - Who referred the client
   * @param {string} data.referral_date - Date of referral
   * @param {string} data.referral_source - Source of referral
   * @param {string} data.notes - Additional notes
   * @returns {Promise<Object>} Created referral
   */
  async create(data) {
    const { organizationId } = await getUserOrganization()

    // Extract only the core fields that exist in the database table
    // Schema: id, organization_id, client_id, referred_by, referral_date, referral_source, notes, created_at, updated_at
    const {
      client_id,
      referred_by,
      referral_date,
      referral_source,
      ...extraFields
    } = data

    // Store all extra fields (including marketer info) in the notes field as JSON
    const referralData = {
      organization_id: organizationId,
      client_id,
      referred_by: referred_by || null,
      referral_date: referral_date || null,
      referral_source: referral_source || null,
      notes: JSON.stringify(extraFields)
    }

    const result = await referralService.create(referralData)
    return parseReferralNotes(result)
  },

  /**
   * Update a referral. Splits the update payload into:
   *   - real columns (written directly)
   *   - extra fields (merged into the legacy notes JSON blob — kept for forward-compat
   *     until all consumers are migrated)
   * Then diffs tracked fields and writes a field_change row to referral_status_history
   * for each tracked field whose value changed.
   */
  async update(id, updates) {
    const existing = await this.get(id)

    // Schema-aware list of real columns we write to.
    const REAL_COLUMNS = new Set([
      'client_id','referred_by','referral_date','referral_source',
      'cm_company','marketer_id','marketer_name','marketer_email',
      'code','home_care_company','cm_call_status',
      'assessment_complete','waiting_state_approval',
      'archived_at','archived_by','archive_reason','archive_note',
    ])

    const {
      organization_id, created_at, updated_at, client, notes,
      id: _id,
      ...rest
    } = updates

    const updateData = {}
    const extraFields = {}
    for (const [k, v] of Object.entries(rest)) {
      if (REAL_COLUMNS.has(k)) updateData[k] = v
      else extraFields[k] = v
    }

    // Merge extra (non-column) fields into the legacy notes blob.
    if (Object.keys(extraFields).length > 0) {
      let existingNotes = {}
      if (existing.notes && typeof existing.notes === 'string') {
        try { existingNotes = JSON.parse(existing.notes) } catch { /* keep empty */ }
      }
      updateData.notes = JSON.stringify({ ...existingNotes, ...extraFields })
    }

    // Compute history diffs BEFORE writing — uses the existing record's tracked fields.
    const diffs = diffTrackedFields(existing, updateData)

    const result = await referralService.update(id, updateData)

    // Write history entries (best-effort: don't fail the update if history insert fails).
    for (const d of diffs) {
      try { await ReferralHistory.addFieldChange(id, d) } catch (e) { console.warn('history failed', e) }
    }

    return parseReferralNotes(result)
  },

  /** Soft-archive a referral with a reason + optional note. Writes a history event. */
  async archive(id, { reason, note }) {
    if (!reason) throw new Error('Archive reason is required')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('referrals')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user.id,
        archive_reason: reason,
        archive_note: note?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    try { await ReferralHistory.addArchiveEvent(id, { reason, note }) } catch (e) { console.warn(e) }
    return parseReferralNotes(data)
  },

  async unarchive(id) {
    const { data, error } = await supabase
      .from('referrals')
      .update({ archived_at: null, archived_by: null })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    try { await ReferralHistory.addUnarchiveEvent(id) } catch (e) { console.warn(e) }
    return parseReferralNotes(data)
  },

  /**
   * Delete a referral
   * @param {string} id - Referral ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    return referralService.remove(id)
  },

  /**
   * Search referrals by source or referred_by
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching referrals
   */
  async search(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.list()
    }

    const term = searchTerm.toLowerCase().trim()

    const { data, error } = await supabase
      .from('referrals')
      .select(`
        *,
        client:clients(id, first_name, last_name)
      `)
      .or(`referred_by.ilike.%${term}%,referral_source.ilike.%${term}%,notes.ilike.%${term}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(parseReferralNotes)
  },

  /**
   * Get referral statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStats() {
    const referrals = await this.list()

    // Count by source
    const bySource = {}
    referrals.forEach(ref => {
      const source = ref.referral_source || 'Unknown'
      bySource[source] = (bySource[source] || 0) + 1
    })

    return {
      total: referrals.length,
      by_source: bySource
    }
  }
}

Referral.TRACKED_FIELDS = TRACKED_FIELDS

export default Referral


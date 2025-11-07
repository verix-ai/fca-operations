import { supabase } from '@/lib/supabase'

/**
 * Get current user's organization
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
 * Merge defaults with settings
 */
function withDefaults(settings) {
  const defaults = {
    regions: {},
    timezone: 'UTC',
  }
  return { ...defaults, ...(settings || {}) }
}

export const Settings = {
  /**
   * Get organization settings
   * @returns {Promise<Object>} Settings object
   */
  async get() {
    const { organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('organizations')
      .select('settings')
      .eq('id', organizationId)
      .single()

    if (error) throw error

    return withDefaults(data?.settings || {})
  },

  /**
   * Update organization settings
   * @param {Object} partial - Partial settings to merge
   * @returns {Promise<Object>} Updated settings
   */
  async update(partial) {
    const { organizationId } = await getUserOrganization()

    // Get current settings
    const currentSettings = await this.get()

    // Merge with new settings
    const newSettings = { ...currentSettings, ...partial }

    // Update in database
    const { data, error } = await supabase
      .from('organizations')
      .update({ settings: newSettings })
      .eq('id', organizationId)
      .select('settings')
      .single()

    if (error) throw error

    return withDefaults(data?.settings || {})
  },

  /**
   * Set regions (counties by state)
   * @param {string} stateCode - State code (e.g., 'CA', 'TX')
   * @param {Array<string>} counties - Array of county names
   * @returns {Promise<Array>} Updated counties for the state
   */
  async setRegions(stateCode, counties) {
    const currentSettings = await this.get()

    const newSettings = {
      ...currentSettings,
      regions: {
        ...(currentSettings.regions || {}),
        [stateCode]: counties
      }
    }

    await this.update(newSettings)
    return newSettings.regions[stateCode]
  },

  /**
   * Set timezone
   * @param {string} timezone - Timezone string (e.g., 'America/New_York')
   * @returns {Promise<string>} Updated timezone
   */
  async setTimezone(timezone) {
    const newSettings = await this.update({ timezone: String(timezone || 'UTC') })
    return newSettings.timezone
  },

  /**
   * Get organization details
   * @returns {Promise<Object>} Organization object
   */
  async getOrganization() {
    const { organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Update organization details
   * @param {Object} updates - Organization fields to update
   * @returns {Promise<Object>} Updated organization
   */
  async updateOrganization(updates) {
    const { organizationId } = await getUserOrganization()

    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organizationId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export default Settings


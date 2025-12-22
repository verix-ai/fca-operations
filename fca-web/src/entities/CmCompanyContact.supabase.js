import { SupabaseService } from '@/services/supabaseService'

const service = new SupabaseService('cm_company_contacts')

export const CmCompanyContact = {
    /**
     * List contacts for a specific company
     * @param {string} companyId 
     * @returns {Promise<Array>}
     */
    async list(companyId) {
        return service.list({
            filters: { cm_company_id: companyId },
            sort: 'created_at:asc'
        })
    },

    /**
     * Create a new contact
     * @param {Object} data 
     * @returns {Promise<Object>}
     */
    async create(data) {
        if (!data.cm_company_id) throw new Error('Company ID is required')
        return service.create(data)
    },

    /**
     * Update a contact
     * @param {string} id 
     * @param {Object} updates 
     * @returns {Promise<Object>}
     */
    async update(id, updates) {
        return service.update(id, updates)
    },

    /**
     * Remove a contact
     * @param {string} id 
     * @returns {Promise<void>}
     */
    async remove(id) {
        return service.remove(id)
    }
}

export default CmCompanyContact

import { supabase } from '@/lib/supabase'

/**
 * Generic Supabase service class for CRUD operations
 * Provides a base layer for all entity services
 */
export class SupabaseService {
  constructor(tableName) {
    this.tableName = tableName
  }

  /**
   * List records with optional filtering and sorting
   * @param {Object} options - Query options
   * @param {Object} options.filters - Key-value pairs for filtering
   * @param {string} options.sort - Sort format: 'field:direction' (e.g., 'created_at:desc')
   * @param {number} options.limit - Maximum number of records to return
   * @param {number} options.offset - Number of records to skip
   * @returns {Promise<Array>} Array of records
   */
  async list(options = {}) {
    let query = supabase.from(this.tableName).select('*')
    
    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          query = query.eq(key, value)
        }
      })
    }
    
    // Apply sorting
    if (options.sort) {
      const [field, direction] = options.sort.split(':')
      query = query.order(field, { ascending: direction !== 'desc' })
    }
    
    // Apply pagination
    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  }

  /**
   * Get a single record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Record object
   */
  async get(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    return data
  }

  /**
   * Create a new record
   * @param {Object} record - Record data to create
   * @returns {Promise<Object>} Created record
   */
  async create(record) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert([record])
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  /**
   * Create multiple records
   * @param {Array<Object>} records - Array of records to create
   * @returns {Promise<Array>} Created records
   */
  async createMany(records) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(records)
      .select()
    
    if (error) throw error
    return data
  }

  /**
   * Update a record
   * @param {string} id - Record ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated record
   */
  async update(id, updates) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    return data
  }

  /**
   * Delete a record
   * @param {string} id - Record ID
   * @returns {Promise<Object>} Success status
   */
  async remove(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return { success: true }
  }

  /**
   * Count records with optional filters
   * @param {Object} filters - Key-value pairs for filtering
   * @returns {Promise<number>} Count of records
   */
  async count(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value)
      }
    })
    
    const { count, error } = await query
    if (error) throw error
    return count
  }

  /**
   * Search records by text field
   * @param {string} field - Field to search in
   * @param {string} searchTerm - Search term
   * @param {Object} options - Additional query options
   * @returns {Promise<Array>} Matching records
   */
  async search(field, searchTerm, options = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*')
      .ilike(field, `%${searchTerm}%`)
    
    if (options.sort) {
      const [sortField, direction] = options.sort.split(':')
      query = query.order(sortField, { ascending: direction !== 'desc' })
    }
    
    const { data, error } = await query
    if (error) throw error
    return data || []
  }
}

export default SupabaseService


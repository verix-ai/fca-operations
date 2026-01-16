import { SupabaseService } from "@/services/supabaseService";
import { supabase } from "@/lib/supabase";

const caregiverService = new SupabaseService("client_caregivers");

export const ClientCaregiver = {
  async listByClient(clientId) {
    if (!clientId) return [];
    return caregiverService.list({
      filters: { client_id: clientId },
      sort: "started_at:desc",
    });
  },

  async listAll() {
    const { data, error } = await supabase
      .from('client_caregivers')
      .select(`
        *,
        client:clients(id, client_name)
      `)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async get(id) {
    const { data, error } = await supabase
      .from('client_caregivers')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async addCaregiver(clientId, payload) {
    if (!clientId) throw new Error("clientId is required");

    // Ensure only one active caregiver at a time
    await supabase
      .from("client_caregivers")
      .update({
        status: "inactive",
        ended_at: new Date().toISOString(),
      })
      .eq("client_id", clientId)
      .eq("status", "active");

    return caregiverService.create({
      client_id: clientId,
      full_name: payload.full_name,
      relationship: payload.relationship || null,
      phone: payload.phone || null,
      email: payload.email || null,
      lives_in_home: Boolean(payload.lives_in_home),
      status: payload.status || "active",
      notes: payload.notes || null,
      started_at: payload.started_at || new Date().toISOString(),
      ended_at: null,
    });
  },

  async deactivateCaregiver(caregiverId, endedAt = new Date().toISOString()) {
    if (!caregiverId) throw new Error("caregiverId is required");
    return caregiverService.update(caregiverId, {
      status: "inactive",
      ended_at: endedAt,
    });
  },

  async updateCaregiver(caregiverId, updates) {
    if (!caregiverId) throw new Error("caregiverId is required");
    return caregiverService.update(caregiverId, updates);
  },

  /**
   * Create a standalone caregiver (not assigned to a client yet)
   * These caregivers can complete onboarding independently
   */
  async createStandalone(payload) {
    // Get current user's organization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    if (!userProfile?.organization_id) throw new Error("User not in an organization");

    const { data, error } = await supabase
      .from('client_caregivers')
      .insert({
        organization_id: userProfile.organization_id,
        client_id: null, // No client assigned yet
        full_name: payload.full_name,
        relationship: payload.relationship || null,
        phone: payload.phone || null,
        email: payload.email || null,
        lives_in_home: Boolean(payload.lives_in_home),
        status: 'active',
        notes: payload.notes || null,
        started_at: new Date().toISOString(),
        // Onboarding fields default to false
        viventium_onboarding_completed: false,
        caregiver_fingerprinted: false,
        background_results_uploaded: false,
        ssn_or_birth_certificate_submitted: false,
        pca_cert_including_2_of_3: false,
        drivers_license_submitted: false,
        tb_test_completed: false,
        cpr_first_aid_completed: false,
        onboarding_finalized: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * List all unassigned (floater) caregivers
   */
  async listUnassigned() {
    const { data, error } = await supabase
      .from('client_caregivers')
      .select('*')
      .is('client_id', null)
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data;
  },

  /**
   * Assign a standalone caregiver to a client
   */
  async assignToClient(caregiverId, clientId) {
    if (!caregiverId) throw new Error("caregiverId is required");
    if (!clientId) throw new Error("clientId is required");

    // Deactivate any existing active caregivers for this client
    await supabase
      .from('client_caregivers')
      .update({ status: 'inactive', ended_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('status', 'active');

    // Assign the caregiver to the client and reactivate them
    const { data, error } = await supabase
      .from('client_caregivers')
      .update({
        client_id: clientId,
        status: 'active',
        ended_at: null,
        started_at: new Date().toISOString()
      })
      .eq('id', caregiverId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export default ClientCaregiver;



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
};

export default ClientCaregiver;



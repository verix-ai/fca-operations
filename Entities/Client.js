// Simple localStorage-backed Client service used by the UI

const STORAGE_KEY = 'fca_clients';

function loadAll() {
  try {
    // One-time purge of all existing clients
    const PURGE_FLAG = 'fca_clients_purge_done';
    const purgeDone = localStorage.getItem(PURGE_FLAG) === '1';
    if (!purgeDone) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([])); } catch {}
      try { localStorage.setItem(PURGE_FLAG, '1'); } catch {}
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load clients from storage:', err);
    return [];
  }
}

function saveAll(clients) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  } catch (err) {
    console.error('Failed to save clients to storage:', err);
  }
}

function generateId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}_${random}`;
}

function coerceClientRecord(input, options = { applyDefaults: false }) {
  const defaults = {
    company: 'FCA',
    current_phase: 'intake',
    status: 'active',
    clinical_lead_completed: false,
    clinical_scheduler_completed: false,
    clinical_third_completed: false,
    // Phase finalization flags
    intake_finalized: false,
    onboarding_finalized: false,
    service_initiation_finalized: false,
    // Intake checklist
    initial_assessment_required: false,
    clinical_dates_entered: false,
    reassessment_date_entered: false,
    initial_assessment_completed: false,
    client_documents_populated: false,
    background_check_completed: false,
    drug_screen_completed: false,
    training_completed: false,
    orientation_completed: false,
    // New onboarding checklist (supersedes legacy four fields above)
    viventium_onboarding_completed: false,
    caregiver_fingerprinted: false,
    background_results_uploaded: false,
    drivers_license_submitted: false,
    ssn_or_birth_certificate_submitted: false,
    tb_test_completed: false,
    cpr_first_aid_completed: false,
    pca_cert_including_2_of_3: false,
    // Service initiation checklist (updated)
    training_or_care_start_date: '',
    edwp_created_and_sent: false,
    edwp_transmittal_completed: false,
    manager_ccd: false,
    schedule_created_and_extended_until_aed: false,
  };

  const record = options.applyDefaults ? { ...defaults, ...input } : { ...input };

  // Normalize types
  if ('cost_share_amount' in record) {
    if (typeof record.cost_share_amount === 'string' && record.cost_share_amount.trim() !== '') {
      const parsed = parseFloat(record.cost_share_amount);
      record.cost_share_amount = Number.isFinite(parsed) ? parsed : 0;
    }
  }
  if ('phone_numbers' in record) {
    if (!Array.isArray(record.phone_numbers)) {
      record.phone_numbers = record.phone_numbers ? [String(record.phone_numbers)] : [];
    }
  }

  return record;
}

function sortClients(clients, sort) {
  if (!sort) return clients;
  const direction = sort.startsWith('-') ? -1 : 1;
  const field = sort.replace(/^[-+]/, '');
  return [...clients].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * direction;
    if (av > bv) return 1 * direction;
    return 0;
  });
}

export const Client = {
  async list(sortBy) {
    const clients = loadAll();
    if (sortBy) {
      return sortClients(clients, sortBy);
    }
    // default newest first
    return sortClients(clients, '-created_date');
  },

  async get(id) {
    const clients = loadAll();
    return clients.find(c => c.id === id) || null;
  },

  async create(data) {
    const clients = loadAll();
    const nowIso = new Date().toISOString();
    const newClient = {
      id: generateId(),
      created_date: nowIso,
      updated_date: nowIso,
      ...coerceClientRecord(data, { applyDefaults: true }),
    };
    clients.push(newClient);
    saveAll(clients);
    return newClient;
  },

  async update(id, updates) {
    const clients = loadAll();
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Client not found');
    const merged = {
      ...clients[idx],
      ...coerceClientRecord(updates, { applyDefaults: false }),
      id,
      updated_date: new Date().toISOString(),
    };
    clients[idx] = merged;
    saveAll(clients);
    return merged;
  },

  async remove(id) {
    const clients = loadAll();
    const next = clients.filter(c => c.id !== id);
    saveAll(next);
    return { success: true };
  }
};

export default Client;
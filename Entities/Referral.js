// Simple localStorage-backed Referral service for marketer submissions

const STORAGE_KEY = 'fca_referrals';

function loadAll() {
  try {
    // One-time purge of all existing prospects
    const PURGE_FLAG = 'fca_referrals_purge_done';
    const purgeDone = localStorage.getItem(PURGE_FLAG) === '1';
    if (!purgeDone) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([])); } catch {}
      try { localStorage.setItem(PURGE_FLAG, '1'); } catch {}
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    // In-place migration: update marketer_name in old seed data to Mark Cuban
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false;
      const next = parsed.map(r => {
        if (r.marketer_name === 'Marketer One') { changed = true; return { ...r, marketer_name: 'Mark Cuban' }; }
        return r;
      });
      if (changed) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      }
      return next;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load referrals from storage:', err);
    return [];
  }
}

function saveAll(referrals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(referrals));
  } catch (err) {
    console.error('Failed to save referrals to storage:', err);
  }
}

function generateId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}_${random}`;
}

export const Referral = {
  async list() {
    const all = loadAll();
    // newest first
    return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  },

  async get(id) {
    const all = loadAll();
    return all.find(r => r.id === id) || null;
  },

  async create(data) {
    const all = loadAll();
    const nowIso = new Date().toISOString();
    const record = { id: generateId(), created_at: nowIso, ...data };
    all.push(record);
    saveAll(all);
    return record;
  },

  async update(id, updates) {
    const all = loadAll();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) throw new Error('Referral not found');
    const next = { ...all[idx], ...updates };
    all[idx] = next;
    saveAll(all);
    return next;
  },

  async remove(id) {
    const all = loadAll();
    const next = all.filter(r => r.id !== id);
    saveAll(next);
    return { success: true };
  },
};

export default Referral;



// Simple localStorage-backed CM Companies service

const STORAGE_KEY = 'fca_cm_companies';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveAll(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export const CmCompany = {
  async list() { return loadAll(); },
  async create(data) {
    const items = loadAll();
    const name = (data?.name || '').trim();
    if (!name) throw new Error('Name is required');
    const id = data.id || name;
    if (items.some(x => x.id === id || x.name.toLowerCase() === name.toLowerCase())) throw new Error('Company exists');
    const record = { id, name };
    items.push(record); saveAll(items); return record;
  },
  async update(id, updates) {
    const items = loadAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) throw new Error('Not found');
    const next = { ...items[idx], ...updates };
    items[idx] = next; saveAll(items); return next;
  },
  async remove(id) {
    const items = loadAll();
    const next = items.filter(x => x.id !== id);
    saveAll(next); return { success: true };
  },
}

export default CmCompany;



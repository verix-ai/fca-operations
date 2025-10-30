// Simple localStorage-backed Marketer service

const STORAGE_KEY = 'fca_marketers';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load marketers from storage:', err);
    return [];
  }
}

function saveAll(marketers) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marketers));
  } catch (err) {
    console.error('Failed to save marketers to storage:', err);
  }
}

export const Marketer = {
  async list() {
    return loadAll();
  },

  async create(data) {
    const marketers = loadAll();
    const name = (data?.name || '').trim();
    if (!name) throw new Error('Name is required');
    const id = data.id || name;
    const exists = marketers.some(m => m.id === id || m.name.toLowerCase() === name.toLowerCase());
    if (exists) throw new Error('Marketer already exists');
    const record = { id, name };
    marketers.push(record);
    saveAll(marketers);
    return record;
  },

  async update(id, updates) {
    const marketers = loadAll();
    const idx = marketers.findIndex(m => m.id === id);
    if (idx === -1) throw new Error('Marketer not found');
    const next = { ...marketers[idx], ...updates };
    marketers[idx] = next;
    saveAll(marketers);
    return next;
  },

  async remove(id) {
    const marketers = loadAll();
    const next = marketers.filter(m => m.id !== id);
    saveAll(next);
    return { success: true };
  },
};

export default Marketer;



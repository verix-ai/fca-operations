// Simple localStorage-backed Program service

const STORAGE_KEY = 'fca_programs';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultPrograms();
  } catch (err) {
    console.error('Failed to load programs from storage:', err);
    return getDefaultPrograms();
  }
}

function saveAll(programs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
  } catch (err) {
    console.error('Failed to save programs to storage:', err);
  }
}

function getDefaultPrograms() {
  return [
    { id: 'PSS', name: 'PSS' },
    { id: 'PCA', name: 'PCA' },
    { id: 'Companion Care', name: 'Companion Care' },
    { id: 'Respite Care', name: 'Respite Care' },
  ];
}

export const Program = {
  async list() {
    return loadAll();
  },

  async create(data) {
    const programs = loadAll();
    const exists = programs.some(p => p.id === data.id || p.name.toLowerCase() === data.name.toLowerCase());
    if (exists) throw new Error('Program already exists');
    const record = { id: data.id || data.name, name: data.name };
    programs.push(record);
    saveAll(programs);
    return record;
  },

  async update(id, updates) {
    const programs = loadAll();
    const idx = programs.findIndex(p => p.id === id);
    if (idx === -1) throw new Error('Program not found');
    const next = { ...programs[idx], ...updates };
    programs[idx] = next;
    saveAll(programs);
    return next;
  },

  async remove(id) {
    const programs = loadAll();
    const next = programs.filter(p => p.id !== id);
    saveAll(next);
    return { success: true };
  },
};

export default Program;



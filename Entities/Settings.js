const STORAGE_KEY = 'fca_settings';

function withDefaults(obj) {
  // Ensure defaults for newly added fields
  const defaults = { regions: {}, timezone: 'UTC' };
  return { ...defaults, ...(obj || {}) };
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return withDefaults(parsed);
  } catch (e) {
    return withDefaults({});
  }
}

function saveAll(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(withDefaults(data))); } catch {}
}

export const Settings = {
  async get() { return loadAll() },
  async update(partial) {
    const next = { ...loadAll(), ...partial };
    saveAll(next);
    return next;
  },
  async setRegions(stateCode, counties) {
    const data = loadAll();
    data.regions = { ...(data.regions||{}), [stateCode]: counties };
    saveAll(data);
    return data.regions[stateCode];
  },
  async setTimezone(timezone) {
    const data = loadAll();
    data.timezone = String(timezone || 'UTC');
    saveAll(data);
    return data.timezone;
  }
};

export default Settings;



export const ALLOWED_PAGE_SIZES = [5, 10, 20, 50];

export function clampPage(page, total, pageSize) {
  if (total <= 0) return 1;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (page < 1) return 1;
  if (page > lastPage) return lastPage;
  return page;
}

export function getWindow(page, pageSize) {
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize };
}

export function readPersistedPageSize(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return ALLOWED_PAGE_SIZES.includes(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function writePersistedPageSize(key, size) {
  if (!ALLOWED_PAGE_SIZES.includes(size)) return;
  try {
    localStorage.setItem(key, String(size));
  } catch {
    /* localStorage may be unavailable (private mode, SSR) — silently ignore */
  }
}

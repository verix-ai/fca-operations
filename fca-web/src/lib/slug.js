// Slug regex is intentionally TIGHTER than the DB CHECK constraint:
//   - DB allows 1–30 chars: ^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$
//   - JS requires 2–30 chars: ^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$
// The UI is the gateway; this stricter form matches the "2–30 lowercase letters,
// numbers, and hyphens" helper text shown to marketers and the existing tests.
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/;

// Keep in sync with the DB `reserved_slugs` table seed (20260507 migration; reused by 20260509).
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'app', 'auth', 'login', 'signup', 'signin', 'logout',
  'ref', 'referral', 'referrals', 'dashboard', 'support', 'help',
  'about', 'about-us', 'contact', 'contact-us', 'terms', 'privacy', 'privacy-policy',
  'home', 'index', 'www', 'mail', 'email', 'staff', 'client', 'clients',
  'prospect', 'prospects', 'caregiver', 'caregivers', 'marketer', 'marketers',
  'faq', 'rf', 'settings', 'profile', 'null', 'undefined',
]);

/**
 * Lowercase and reduce a name to a slug-safe form.
 * Returns a candidate that may still need uniqueness/reserved checks.
 */
export function slugify(input) {
  if (!input) return '';
  // Take only the first whitespace-separated token, so "Marcus H." -> "marcus"
  // (initials and surnames after a space are dropped).
  const firstToken = String(input).trim().split(/\s+/)[0] || '';
  return firstToken
    .toLowerCase()
    // Strip any char that isn't [a-z0-9-]
    .replace(/[^a-z0-9-]/g, '')
    // Strip leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export function isValidSlug(slug) {
  if (typeof slug !== 'string') return false;
  if (!SLUG_REGEX.test(slug)) return false;
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return true;
}

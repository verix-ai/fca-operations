// Mirrors the SQL function `public.is_office_role(text)`.
// Keep this list in sync with the SQL helper. New office roles are
// added in BOTH places.
export const OFFICE_ROLES = ['admin', 'marketer'];

export function isOfficeRole(role) {
  if (typeof role !== 'string' || role.length === 0) return false;
  return OFFICE_ROLES.includes(role);
}

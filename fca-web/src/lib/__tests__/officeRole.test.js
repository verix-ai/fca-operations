import { describe, it, expect } from 'vitest';
import { isOfficeRole, OFFICE_ROLES } from '../officeRole';

describe('isOfficeRole', () => {
  it('returns true for admin and marketer', () => {
    expect(isOfficeRole('admin')).toBe(true);
    expect(isOfficeRole('marketer')).toBe(true);
  });
  it('returns false for caregiver / field roles / unknown', () => {
    expect(isOfficeRole('caregiver')).toBe(false);
    expect(isOfficeRole('client')).toBe(false);
    expect(isOfficeRole('')).toBe(false);
    expect(isOfficeRole(null)).toBe(false);
    expect(isOfficeRole(undefined)).toBe(false);
  });
});

describe('OFFICE_ROLES', () => {
  it('exposes the role allowlist for UI iteration', () => {
    expect(OFFICE_ROLES).toEqual(['admin', 'marketer']);
  });
});

import { describe, it, expect } from 'vitest';
import { slugify, isValidSlug, RESERVED_SLUGS, SLUG_REGEX } from '../slug';

describe('slugify', () => {
  it('lowercases and strips non-alnum from a single name', () => {
    expect(slugify('Jane')).toBe('jane');
    expect(slugify('Marcus H.')).toBe('marcus');
  });
  it('keeps internal hyphens when given hyphenated input', () => {
    expect(slugify('Mary-Ann')).toBe('mary-ann');
  });
  it('trims to 30 chars', () => {
    expect(slugify('a'.repeat(50))).toHaveLength(30);
  });
  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
    expect(slugify(undefined)).toBe('');
  });
});

describe('isValidSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidSlug('jane')).toBe(true);
    expect(isValidSlug('marcus-h')).toBe(true);
    expect(isValidSlug('a1')).toBe(true);
    expect(isValidSlug('a'.repeat(30))).toBe(true);
  });
  it('rejects too short / too long', () => {
    expect(isValidSlug('a')).toBe(false);
    expect(isValidSlug('a'.repeat(31))).toBe(false);
  });
  it('rejects leading/trailing hyphens', () => {
    expect(isValidSlug('-jane')).toBe(false);
    expect(isValidSlug('jane-')).toBe(false);
  });
  it('rejects uppercase / special chars', () => {
    expect(isValidSlug('Jane')).toBe(false);
    expect(isValidSlug('jane.doe')).toBe(false);
    expect(isValidSlug('jane_doe')).toBe(false);
    expect(isValidSlug('jane doe')).toBe(false);
  });
  it('rejects reserved slugs', () => {
    expect(isValidSlug('admin')).toBe(false);
    expect(isValidSlug('login')).toBe(false);
    expect(isValidSlug('ref')).toBe(false);
  });
});

describe('SLUG_REGEX', () => {
  it('requires 2-30 chars (tighter than the DB CHECK; UI gateway)', () => {
    expect(SLUG_REGEX.source).toBe('^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$');
  });
});

describe('RESERVED_SLUGS', () => {
  it('contains the core reserved words', () => {
    expect(RESERVED_SLUGS).toContain('admin');
    expect(RESERVED_SLUGS).toContain('ref');
  });
});

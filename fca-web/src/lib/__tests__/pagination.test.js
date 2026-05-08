import { describe, it, expect, beforeEach } from 'vitest';
import {
  clampPage,
  getWindow,
  readPersistedPageSize,
  writePersistedPageSize,
  ALLOWED_PAGE_SIZES,
} from '../pagination';

describe('clampPage', () => {
  it('returns 1 when total is 0', () => {
    expect(clampPage(5, 0, 10)).toBe(1);
  });
  it('returns the current page when it is within range', () => {
    expect(clampPage(2, 25, 10)).toBe(2);
  });
  it('clamps down to last valid page when current is too high', () => {
    expect(clampPage(5, 25, 10)).toBe(3); // 25 / 10 = 3 pages
  });
  it('clamps up to 1 when current is below 1', () => {
    expect(clampPage(0, 25, 10)).toBe(1);
    expect(clampPage(-3, 25, 10)).toBe(1);
  });
  it('handles total exactly divisible by pageSize', () => {
    expect(clampPage(5, 30, 10)).toBe(3);
  });
});

describe('getWindow', () => {
  it('returns the start/end indices for a given page', () => {
    expect(getWindow(1, 7)).toEqual({ start: 0, end: 7 });
    expect(getWindow(2, 7)).toEqual({ start: 7, end: 14 });
    expect(getWindow(3, 10)).toEqual({ start: 20, end: 30 });
  });
});

describe('readPersistedPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('returns the fallback when storage is empty', () => {
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
  it('returns the stored value when it is in the allowed list', () => {
    localStorage.setItem('k', '20');
    expect(readPersistedPageSize('k', 7)).toBe(20);
  });
  it('returns the fallback when the stored value is not in the allowed list', () => {
    localStorage.setItem('k', '13');
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
  it('returns the fallback when the stored value is non-numeric garbage', () => {
    localStorage.setItem('k', 'banana');
    expect(readPersistedPageSize('k', 7)).toBe(7);
  });
});

describe('writePersistedPageSize', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it('writes allowed sizes to storage as strings', () => {
    writePersistedPageSize('k', 20);
    expect(localStorage.getItem('k')).toBe('20');
  });
  it('does not write disallowed sizes', () => {
    writePersistedPageSize('k', 13);
    expect(localStorage.getItem('k')).toBeNull();
  });
});

describe('ALLOWED_PAGE_SIZES', () => {
  it('is exactly [5, 10, 20, 50]', () => {
    expect(ALLOWED_PAGE_SIZES).toEqual([5, 10, 20, 50]);
  });
});

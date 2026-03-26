import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  toSortDate,
  createComparator,
  readSortMode,
  writeSortMode,
  SORT_MODES,
  SORT_ORDER,
} from '../../../../src/client/js/utils/sort';
import type { SidebarItem } from '../../../../src/client/js/utils/sort';

//////////////////////////////
// localStorage mock helpers
//////////////////////////////

/**
 * Minimal in-memory localStorage mock. The unit test environment runs in Node
 * which has no built-in localStorage, so we stub it globally for the tests
 * that exercise readSortMode / writeSortMode.
 */
function makeLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
}

//////////////////////////////
// toSortDate
//////////////////////////////

describe('toSortDate', () => {
  it('returns a Date unchanged when passed a Date instance', () => {
    const d = new Date('2024-01-15');
    expect(toSortDate(d)).toBe(d);
  });

  it('parses a valid ISO date string into a Date', () => {
    const result = toSortDate('2024-06-01');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
  });

  it('parses a valid ISO datetime string into a Date', () => {
    const result = toSortDate('2024-06-01T12:00:00Z');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a Date (possibly Invalid) for a non-date string — callers handle invalid dates', () => {
    // The function returns new Date(str) for any string; invalid date strings
    // yield an Invalid Date object rather than undefined.
    const result = toSortDate('not-a-date');
    expect(result).toBeInstanceOf(Date);
  });

  it('returns undefined for null', () => {
    expect(toSortDate(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(toSortDate(undefined)).toBeUndefined();
  });

  it('returns undefined for a number', () => {
    expect(toSortDate(42)).toBeUndefined();
  });

  it('returns undefined for an object', () => {
    expect(toSortDate({ date: '2024-01-01' })).toBeUndefined();
  });
});

//////////////////////////////
// createComparator — alpha mode
//////////////////////////////

describe('createComparator — alpha', () => {
  const cmp = createComparator('alpha');

  it('sorts items lexicographically by label', () => {
    const a: SidebarItem = { label: 'Banana', href: '/b' };
    const b: SidebarItem = { label: 'Apple', href: '/a' };
    expect(cmp(a, b)).toBeGreaterThan(0);
    expect(cmp(b, a)).toBeLessThan(0);
  });

  it('returns 0 for identical labels', () => {
    const a: SidebarItem = { label: 'Same', href: '/a' };
    const b: SidebarItem = { label: 'Same', href: '/b' };
    expect(cmp(a, b)).toBe(0);
  });

  it('is case-insensitive', () => {
    const a: SidebarItem = { label: 'apple', href: '/a' };
    const b: SidebarItem = { label: 'Apple', href: '/b' };
    expect(cmp(a, b)).toBe(0);
  });
});

//////////////////////////////
// createComparator — date-asc mode
//////////////////////////////

describe('createComparator — date-asc', () => {
  const cmp = createComparator('date-asc');

  it('sorts earlier dates before later dates', () => {
    const a: SidebarItem = {
      label: 'A',
      href: '/a',
      date: new Date('2023-01-01'),
    };
    const b: SidebarItem = {
      label: 'B',
      href: '/b',
      date: new Date('2024-01-01'),
    };
    expect(cmp(a, b)).toBeLessThan(0);
    expect(cmp(b, a)).toBeGreaterThan(0);
  });

  it('returns 0 for equal dates', () => {
    const a: SidebarItem = {
      label: 'A',
      href: '/a',
      date: new Date('2024-01-01'),
    };
    const b: SidebarItem = {
      label: 'B',
      href: '/b',
      date: new Date('2024-01-01'),
    };
    expect(cmp(a, b)).toBe(0);
  });

  it('sorts items without a date to the top (before items with a date)', () => {
    const nodateItem: SidebarItem = { label: 'A', href: '/a' };
    const datedItem: SidebarItem = {
      label: 'B',
      href: '/b',
      date: new Date('2020-01-01'),
    };
    expect(cmp(nodateItem, datedItem)).toBeLessThan(0);
    expect(cmp(datedItem, nodateItem)).toBeGreaterThan(0);
  });

  it('returns 0 when both items have no date', () => {
    const a: SidebarItem = { label: 'A', href: '/a' };
    const b: SidebarItem = { label: 'B', href: '/b' };
    expect(cmp(a, b)).toBe(0);
  });
});

//////////////////////////////
// createComparator — date-desc mode
//////////////////////////////

describe('createComparator — date-desc', () => {
  const cmp = createComparator('date-desc');

  it('sorts later dates before earlier dates', () => {
    const a: SidebarItem = {
      label: 'A',
      href: '/a',
      date: new Date('2024-01-01'),
    };
    const b: SidebarItem = {
      label: 'B',
      href: '/b',
      date: new Date('2023-01-01'),
    };
    expect(cmp(a, b)).toBeLessThan(0);
    expect(cmp(b, a)).toBeGreaterThan(0);
  });

  it('sorts items without a date to the top', () => {
    const nodateItem: SidebarItem = { label: 'A', href: '/a' };
    const datedItem: SidebarItem = {
      label: 'B',
      href: '/b',
      date: new Date('2020-01-01'),
    };
    expect(cmp(nodateItem, datedItem)).toBeLessThan(0);
  });
});

//////////////////////////////
// readSortMode / writeSortMode
//////////////////////////////

describe('readSortMode / writeSortMode', () => {
  beforeEach(() => {
    // Stub localStorage globally — Node has no built-in localStorage
    vi.stubGlobal('localStorage', makeLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to "alpha" when no value is stored', () => {
    expect(readSortMode('my-collection')).toBe('alpha');
  });

  it('returns the stored "alpha" mode', () => {
    writeSortMode('my-collection', 'alpha');
    expect(readSortMode('my-collection')).toBe('alpha');
  });

  it('returns the stored "date-asc" mode', () => {
    writeSortMode('my-collection', 'date-asc');
    expect(readSortMode('my-collection')).toBe('date-asc');
  });

  it('returns the stored "date-desc" mode', () => {
    writeSortMode('my-collection', 'date-desc');
    expect(readSortMode('my-collection')).toBe('date-desc');
  });

  it('defaults to "alpha" when the stored value is not a valid SortMode', () => {
    localStorage.setItem('cms-sort-my-collection', 'invalid-value');
    expect(readSortMode('my-collection')).toBe('alpha');
  });

  it('namespaces storage keys by collection name', () => {
    writeSortMode('posts', 'date-desc');
    writeSortMode('pages', 'date-asc');
    expect(readSortMode('posts')).toBe('date-desc');
    expect(readSortMode('pages')).toBe('date-asc');
  });
});

//////////////////////////////
// SORT_MODES and SORT_ORDER constants
//////////////////////////////

describe('SORT_MODES constant', () => {
  it('contains an entry for every SortMode', () => {
    expect(SORT_MODES).toHaveProperty('alpha');
    expect(SORT_MODES).toHaveProperty('date-asc');
    expect(SORT_MODES).toHaveProperty('date-desc');
  });

  it('each entry has icon and label strings', () => {
    for (const entry of Object.values(SORT_MODES)) {
      expect(typeof entry.icon).toBe('string');
      expect(typeof entry.label).toBe('string');
    }
  });
});

describe('SORT_ORDER constant', () => {
  it('is an array with exactly 3 entries', () => {
    expect(Array.isArray(SORT_ORDER)).toBe(true);
    expect(SORT_ORDER).toHaveLength(3);
  });

  it('contains all three SortMode values', () => {
    expect(SORT_ORDER).toContain('alpha');
    expect(SORT_ORDER).toContain('date-asc');
    expect(SORT_ORDER).toContain('date-desc');
  });
});

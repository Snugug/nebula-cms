/* Shared sort module mock for sidebar component tests. */
import { vi } from 'vitest';

/**
 * Returns a mock factory for the sort module used by vi.mock.
 * @return {Record<string, unknown>} The mock module exports
 */
export function createSortMock() {
  return {
    SORT_MODES: {
      alpha: { icon: 'sort_by_alpha', label: 'Alphabetical' },
      'date-asc': { icon: 'hourglass_arrow_down', label: 'Oldest first' },
      'date-desc': { icon: 'hourglass_arrow_up', label: 'Newest first' },
    },
    SORT_ORDER: ['alpha', 'date-asc', 'date-desc'],
    readSortMode: vi.fn(() => 'alpha'),
    writeSortMode: vi.fn(),
    createComparator: vi.fn(
      () => (a: { label: string }, b: { label: string }) =>
        a.label.localeCompare(b.label),
    ),
  };
}

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import AdminSidebar from '../../../../src/client/components/sidebar/AdminSidebar.svelte';

/**
 * Tests for the AdminSidebar component.
 * Mocks all JS module imports to avoid Svelte 5 rune initialization issues
 * in the jsdom environment. Verifies item rendering, search filtering,
 * active item highlighting, showAdd prop, and showFooter prop.
 */

vi.mock('../../../../src/client/js/utils/sort', () => ({
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
}));

vi.mock('../../../../src/client/js/state/router.svelte', () => ({
  navigate: vi.fn(),
  getBasePath: vi.fn(() => '/admin'),
}));

vi.mock('../../../../src/client/js/drafts/storage', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  reloadCollection: vi.fn(),
  disconnect: vi.fn(),
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

/** Sample items used in multiple tests. */
const sampleItems = [
  { label: 'Alpha Post', href: '/admin/posts/alpha' },
  { label: 'Beta Post', href: '/admin/posts/beta' },
  { label: 'Gamma Post', href: '/admin/posts/gamma' },
];

describe('AdminSidebar', () => {
  //////////////////////////////
  // Item list rendering
  //////////////////////////////

  it('renders all provided items as links', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: sampleItems,
      },
    });

    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(3);
  });

  it('renders the sidebar heading', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Collections', items: [] },
    });

    expect(
      container.querySelector('.sidebar-heading')?.textContent?.trim(),
    ).toBe('Collections');
  });

  it('renders a "No items found." message when items is empty', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: [] },
    });

    expect(container.querySelector('.status')?.textContent?.trim()).toBe(
      'No items found.',
    );
  });

  it('renders a loading message when loading prop is true', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: [], loading: true },
    });

    expect(container.querySelector('.status')?.textContent?.trim()).toBe(
      'Loading...',
    );
  });

  it('renders an error message when error prop is set', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: [],
        error: 'Failed to load',
      },
    });

    expect(container.querySelector('.status')?.textContent?.trim()).toBe(
      'Failed to load',
    );
  });

  //////////////////////////////
  // Active item
  //////////////////////////////

  it('sets aria-current="page" on the active item link', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: sampleItems,
        activeItem: '/admin/posts/beta',
      },
    });

    const links = Array.from(container.querySelectorAll('.sidebar-link'));
    const active = links.find((l) => l.getAttribute('aria-current') === 'page');

    expect(active).not.toBeUndefined();
    expect(active?.getAttribute('href')).toBe('/admin/posts/beta');
  });

  it('does not set aria-current on non-active items', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: sampleItems,
        activeItem: '/admin/posts/beta',
      },
    });

    const links = Array.from(container.querySelectorAll('.sidebar-link'));
    const nonActive = links.filter(
      (l) => l.getAttribute('href') !== '/admin/posts/beta',
    );

    for (const link of nonActive) {
      expect(link.getAttribute('aria-current')).toBeNull();
    }
  });

  //////////////////////////////
  // Search filtering
  //////////////////////////////

  it('filters items when the search input has a value', async () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems },
    });

    const input = container.querySelector('.search-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'beta' } });

    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('/admin/posts/beta');
  });

  it('shows all items when the search input is cleared', async () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems },
    });

    const input = container.querySelector('.search-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'alpha' } });
    await fireEvent.input(input, { target: { value: '' } });

    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(3);
  });

  it('shows "No items found." when no items match the search query', async () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems },
    });

    const input = container.querySelector('.search-input') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'zzznomatch' } });

    expect(container.querySelector('.status')?.textContent?.trim()).toBe(
      'No items found.',
    );
  });

  //////////////////////////////
  // showAdd prop
  //////////////////////////////

  it('renders the add button when showAdd is true', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: sampleItems,
        showAdd: true,
        collection: 'posts',
      },
    });

    expect(container.querySelector('.add-btn')).not.toBeNull();
  });

  it('does not render the add button when showAdd is false', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems, showAdd: false },
    });

    expect(container.querySelector('.add-btn')).toBeNull();
  });

  //////////////////////////////
  // showFooter prop
  //////////////////////////////

  it('renders the footer when showFooter is true', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems, showFooter: true },
    });

    expect(container.querySelector('.sidebar-footer')).not.toBeNull();
  });

  it('does not render the footer when showFooter is false', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems, showFooter: false },
    });

    expect(container.querySelector('.sidebar-footer')).toBeNull();
  });

  it('renders the logout button inside the footer', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems, showFooter: true },
    });

    const footer = container.querySelector('.sidebar-footer');
    expect(footer?.querySelector('.logout-btn')).not.toBeNull();
  });

  //////////////////////////////
  // Sort controls
  //////////////////////////////

  it('renders the sort control when hasDates is true', () => {
    const { container } = render(AdminSidebar, {
      props: {
        title: 'Posts',
        items: sampleItems,
        hasDates: true,
        storageKey: 'posts',
      },
    });

    // The AdminSidebarSort component renders a .sort-btn
    expect(container.querySelector('.sort-btn')).not.toBeNull();
  });

  it('does not render the sort control when hasDates is false', () => {
    const { container } = render(AdminSidebar, {
      props: { title: 'Posts', items: sampleItems, hasDates: false },
    });

    expect(container.querySelector('.sort-btn')).toBeNull();
  });
});

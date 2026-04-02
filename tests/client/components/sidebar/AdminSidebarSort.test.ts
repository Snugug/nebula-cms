import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import AdminSidebarSort from '../../../../src/client/components/sidebar/AdminSidebarSort.svelte';

/**
 * Tests for the AdminSidebarSort component.
 * Verifies that sort mode buttons render correctly and clicking a popover option
 * calls writeSortMode with the selected mode.
 */

vi.mock('../../../../src/client/js/utils/sort', async () => {
  const { createSortMock } = await import('./sort-mock');
  return createSortMock();
});

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

beforeEach(() => {
  // jsdom does not implement the Popover API — stub hidePopover
  HTMLElement.prototype.hidePopover = vi.fn();
  HTMLElement.prototype.showPopover = vi.fn();
});

describe('AdminSidebarSort', () => {
  /*
  //////////////////////////////
  // Initial render
  //////////////////////////////
  */

  it('renders the sort button with the active mode icon', () => {
    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha' },
    });

    const btn = container.querySelector('.sort-btn');
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('title')).toBe('Alphabetical');
    expect(btn!.textContent?.trim()).toBe('sort_by_alpha');
  });

  it('renders popover options for all modes except the active one', () => {
    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha' },
    });

    const options = container.querySelectorAll('.sort-option');
    // alpha is active, so the two remaining modes appear as options
    expect(options.length).toBe(2);

    const labels = Array.from(options).map((o) => o.textContent?.trim());
    expect(labels.some((l) => l?.includes('Oldest first'))).toBe(true);
    expect(labels.some((l) => l?.includes('Newest first'))).toBe(true);
  });

  it('does not render the active mode as a popover option', () => {
    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'date-asc' },
    });

    const options = Array.from(container.querySelectorAll('.sort-option'));
    const hasDateAsc = options.some((o) =>
      o.textContent?.includes('Oldest first'),
    );
    expect(hasDateAsc).toBe(false);
  });

  /*
  //////////////////////////////
  // Sort option click
  //////////////////////////////
  */

  it('calls writeSortMode with the selected mode and storageKey when a popover option is clicked', async () => {
    const { writeSortMode } =
      await import('../../../../src/client/js/utils/sort');
    const writeMock = writeSortMode as ReturnType<typeof vi.fn>;
    writeMock.mockClear();

    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha', storageKey: 'posts' },
    });

    const firstOption = container.querySelector(
      '.sort-option',
    ) as HTMLButtonElement;
    await fireEvent.click(firstOption);

    expect(writeMock).toHaveBeenCalledOnce();
    expect(writeMock).toHaveBeenCalledWith('posts', expect.any(String));
  });

  it('does not call writeSortMode when no storageKey is provided', async () => {
    const { writeSortMode } =
      await import('../../../../src/client/js/utils/sort');
    const writeMock = writeSortMode as ReturnType<typeof vi.fn>;
    writeMock.mockClear();

    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha' },
    });

    const firstOption = container.querySelector(
      '.sort-option',
    ) as HTMLButtonElement;
    await fireEvent.click(firstOption);

    expect(writeMock).not.toHaveBeenCalled();
  });

  /*
  //////////////////////////////
  // Popover ID
  //////////////////////////////
  */

  it('uses the storageKey in the popover element ID', () => {
    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha', storageKey: 'blog' },
    });

    const popover = container.querySelector('.sort-popover');
    expect(popover?.id).toBe('sort-popover-blog');
  });

  it('falls back to "default" in the popover ID when no storageKey', () => {
    const { container } = render(AdminSidebarSort, {
      props: { sortMode: 'alpha' },
    });

    const popover = container.querySelector('.sort-popover');
    expect(popover?.id).toBe('sort-popover-default');
  });
});

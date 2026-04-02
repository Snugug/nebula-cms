import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import FilenameDialog from '../../../../src/client/components/dialogs/FilenameDialog.svelte';
import { stubDialogMethods } from './dialog-stubs';

/**
 * Tests for the FilenameDialog component.
 * Mocks slugify so tests are not sensitive to the slug implementation.
 * The component uses a native <dialog> element — showModal/close are stubbed before each test.
 *
 * jsdom treats <dialog> as hidden from the accessibility tree when `open` is absent.
 * Since our showModal stub does not set `open`, buttons are queried via
 * container.querySelector instead of getByRole to avoid hidden-element failures.
 */
vi.mock('../../../../src/client/js/utils/slug', () => ({
  slugify: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, '-')),
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

/**
 * Finds the first button in a container whose trimmed text matches the given label.
 * @param {HTMLElement} container - The DOM container to search within
 * @param {string} label - The button text to match
 * @return {HTMLButtonElement | null} The matching button, or null if not found
 */
function getButton(
  container: HTMLElement,
  label: string,
): HTMLButtonElement | null {
  return (
    (Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement | undefined) ?? null
  );
}

describe('FilenameDialog', () => {
  beforeEach(() => {
    stubDialogMethods();
  });

  it('renders with the slug pre-filled from the title prop', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: 'My Post',
        existingFilenames: [],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    // slugify mock lowercases and replaces spaces with hyphens
    expect(input.value).toBe('my-post');
  });

  it('renders the .md extension label', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: 'Hello',
        existingFilenames: [],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(container.querySelector('.extension')?.textContent?.trim()).toBe(
      '.md',
    );
  });

  it('shows an error when the filename matches an existing one', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: 'hello',
        existingFilenames: ['hello.md'],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    // The slug mock produces "hello" from "hello", so hello.md is a duplicate
    expect(container.querySelector('.error')?.textContent?.trim()).toBe(
      'A file with this name already exists',
    );
  });

  it('shows an error when the slug is empty', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: '',
        existingFilenames: [],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    expect(container.querySelector('.error')?.textContent?.trim()).toBe(
      'Filename cannot be empty',
    );
  });

  it('disables the Confirm button when there is a validation error', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: 'hello',
        existingFilenames: ['hello.md'],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const confirmBtn = getButton(container, 'Confirm');
    expect(confirmBtn?.disabled).toBe(true);
  });

  it('enables the Confirm button when the filename is valid', () => {
    const { container } = render(FilenameDialog, {
      props: {
        title: 'New Post',
        existingFilenames: [],
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      },
    });

    const confirmBtn = getButton(container, 'Confirm');
    expect(confirmBtn?.disabled).toBe(false);
  });

  it('calls onConfirm with the full filename when Confirm is clicked', async () => {
    const onConfirm = vi.fn();

    const { container } = render(FilenameDialog, {
      props: {
        title: 'My Post',
        existingFilenames: [],
        onConfirm,
        onCancel: vi.fn(),
      },
    });

    await fireEvent.click(getButton(container, 'Confirm')!);

    expect(onConfirm).toHaveBeenCalledWith('my-post.md');
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    const onCancel = vi.fn();

    const { container } = render(FilenameDialog, {
      props: {
        title: 'My Post',
        existingFilenames: [],
        onConfirm: vi.fn(),
        onCancel,
      },
    });

    await fireEvent.click(getButton(container, 'Cancel')!);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when there is a validation error', async () => {
    const onConfirm = vi.fn();

    const { container } = render(FilenameDialog, {
      props: {
        title: 'hello',
        existingFilenames: ['hello.md'],
        onConfirm,
        onCancel: vi.fn(),
      },
    });

    await fireEvent.click(getButton(container, 'Confirm')!);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('updates the slug when the input changes and calls onConfirm with the new value', async () => {
    const onConfirm = vi.fn();

    const { container } = render(FilenameDialog, {
      props: {
        title: 'My Post',
        existingFilenames: [],
        onConfirm,
        onCancel: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;

    // Fire input event to update the bound slug value via Svelte's bind:value handler
    await fireEvent.input(input, { target: { value: 'custom-slug' } });
    await fireEvent.click(getButton(container, 'Confirm')!);

    expect(onConfirm).toHaveBeenCalledWith('custom-slug.md');
  });
});

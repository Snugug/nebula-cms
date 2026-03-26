import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DeleteDraftDialog from '../../../../src/client/components/dialogs/DeleteDraftDialog.svelte';

/**
 * Tests for the DeleteDraftDialog component.
 * The component uses a native <dialog> element with showModal() — jsdom does not
 * implement showModal(), so it is stubbed on HTMLDialogElement.prototype before each test.
 *
 * jsdom treats <dialog> as hidden from the accessibility tree when the `open` attribute
 * is absent. Since our showModal stub doesn't set `open`, we query buttons via
 * container.querySelector instead of getByRole to avoid hidden-element failures.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('DeleteDraftDialog', () => {
  beforeEach(() => {
    // jsdom does not implement showModal/close on HTMLDialogElement — stub them
    // so the $effect that calls dialogEl?.showModal() does not throw.
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  it('renders the dialog with title and message', () => {
    const { container } = render(DeleteDraftDialog, {
      props: { onConfirm: vi.fn(), onCancel: vi.fn() },
    });

    expect(container.querySelector('.dialog-title')?.textContent?.trim()).toBe(
      'Delete Draft?',
    );
    expect(
      container.querySelector('.dialog-message')?.textContent?.trim(),
    ).toBe('This cannot be undone.');
  });

  it('renders Cancel and Delete buttons', () => {
    const { container } = render(DeleteDraftDialog, {
      props: { onConfirm: vi.fn(), onCancel: vi.fn() },
    });

    const buttons = container.querySelectorAll('button');
    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).toContain('Cancel');
    expect(labels).toContain('Delete');
  });

  it('calls onConfirm when the Delete button is clicked', async () => {
    const { fireEvent } = await import('@testing-library/svelte');
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(DeleteDraftDialog, {
      props: { onConfirm, onCancel },
    });
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete',
    )!;

    await fireEvent.click(deleteBtn);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    const { fireEvent } = await import('@testing-library/svelte');
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(DeleteDraftDialog, {
      props: { onConfirm, onCancel },
    });
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    )!;

    await fireEvent.click(cancelBtn);

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls showModal on the dialog element on mount', () => {
    render(DeleteDraftDialog, {
      props: { onConfirm: vi.fn(), onCancel: vi.fn() },
    });

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });
});

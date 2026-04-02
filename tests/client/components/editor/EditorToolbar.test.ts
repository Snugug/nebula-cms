import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import EditorToolbar from '../../../../src/client/components/editor/EditorToolbar.svelte';
import { makeEditorFile } from './fixtures';

/**
 * Tests for the EditorToolbar component.
 * The component imports state modules directly rather than receiving props,
 * so we mock each module to control rendering and verify interactions.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run,
// since vi.mock calls are hoisted to the top of the file by Vitest.
const {
  mockGetEditorFile,
  mockHandleSave,
  mockHandlePublish,
  mockOpenDialog,
  mockComputePublishDisabled,
} = vi.hoisted(() => ({
  mockGetEditorFile: vi.fn(),
  mockHandleSave: vi.fn(),
  mockHandlePublish: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
  mockOpenDialog: vi.fn(),
  mockComputePublishDisabled: vi.fn(() => false),
}));

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  getEditorFile: mockGetEditorFile,
}));

vi.mock('../../../../src/client/js/state/router.svelte', () => ({
  nav: {
    get route() {
      return { view: 'file', collection: 'posts', slug: 'hello' };
    },
  },
}));

vi.mock('../../../../src/client/js/state/schema.svelte', () => ({
  schema: {
    get active() {
      return null;
    },
  },
}));

vi.mock('../../../../src/client/js/handlers/admin', () => ({
  handleSave: mockHandleSave,
  handlePublish: mockHandlePublish,
  computePublishDisabled: mockComputePublishDisabled,
}));

vi.mock('../../../../src/client/js/state/dialogs.svelte', () => ({
  dialog: {
    open: mockOpenDialog,
  },
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('EditorToolbar', () => {
  /*
  //////////////////////////////
  // Renders when file is open
  //////////////////////////////
  */

  it('renders the toolbar header when a file is open', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.toolbar')).not.toBeNull();
  });

  it('renders nothing when no file is open', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.toolbar')).toBeNull();
  });

  /*
  //////////////////////////////
  // Title display
  //////////////////////////////
  */

  it('shows the title from formData when present', () => {
    mockGetEditorFile.mockReturnValue(
      makeEditorFile({ formData: { title: 'My Great Post' } }),
    );

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'My Great Post',
    );
  });

  it('falls back to the filename when formData has no title', () => {
    mockGetEditorFile.mockReturnValue(
      makeEditorFile({ filename: 'my-post.md' }),
    );

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'my-post.md',
    );
  });

  it('shows "Untitled Draft" when there is no title and no filename', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ filename: '' }));

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'Untitled Draft',
    );
  });

  /*
  //////////////////////////////
  // Save button
  //////////////////////////////
  */

  it('renders the Save button', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());

    const { container } = render(EditorToolbar);

    const saveBtn = container.querySelector('.btn--save-outline');
    expect(saveBtn).not.toBeNull();
  });

  it('disables Save when file is not dirty', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ dirty: false }));

    const { container } = render(EditorToolbar);

    const saveBtn = container.querySelector(
      '.btn--save-outline',
    ) as HTMLButtonElement;
    expect(saveBtn?.disabled).toBe(true);
  });

  it('calls handleSave when the Save button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ dirty: true }));

    const { container } = render(EditorToolbar);

    await fireEvent.click(container.querySelector('.btn--save-outline')!);
    expect(mockHandleSave).toHaveBeenCalledOnce();
  });

  /*
  //////////////////////////////
  // Publish button
  //////////////////////////////
  */

  it('renders the Publish button', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.btn--primary')).not.toBeNull();
  });

  it('disables the Publish button when computePublishDisabled returns true', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());
    mockComputePublishDisabled.mockReturnValue(true);

    const { container } = render(EditorToolbar);

    const publishBtn = container.querySelector(
      '.btn--primary',
    ) as HTMLButtonElement;
    expect(publishBtn?.disabled).toBe(true);

    mockComputePublishDisabled.mockReturnValue(false);
  });

  it('enables the Publish button when not disabled and not saving', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ saving: false }));
    mockComputePublishDisabled.mockReturnValue(false);

    const { container } = render(EditorToolbar);

    const publishBtn = container.querySelector(
      '.btn--primary',
    ) as HTMLButtonElement;
    expect(publishBtn?.disabled).toBe(false);
  });

  it('calls handlePublish when the Publish button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());

    const { container } = render(EditorToolbar);

    await fireEvent.click(container.querySelector('.btn--primary')!);
    expect(mockHandlePublish).toHaveBeenCalledOnce();
  });

  it('shows filename dialog when publish needs a filename', async () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile());
    mockHandlePublish.mockResolvedValueOnce({ status: 'needs-filename' });

    const { container } = render(EditorToolbar);

    await fireEvent.click(container.querySelector('.btn--primary')!);
    expect(mockOpenDialog).toHaveBeenCalledWith('filename');
  });

  /*
  //////////////////////////////
  // Delete Draft button
  //////////////////////////////
  */

  it('renders the Delete Draft button when draftId is set', () => {
    mockGetEditorFile.mockReturnValue(
      makeEditorFile({ draftId: 'draft-abc-123' }),
    );

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.btn--danger-outline')).not.toBeNull();
  });

  it('does not render the Delete Draft button when draftId is null', () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ draftId: null }));

    const { container } = render(EditorToolbar);

    expect(container.querySelector('.btn--danger-outline')).toBeNull();
  });

  it('calls showDeleteDialog when the Delete Draft button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeEditorFile({ draftId: 'draft-abc' }));

    const { container } = render(EditorToolbar);

    await fireEvent.click(container.querySelector('.btn--danger-outline')!);
    expect(mockOpenDialog).toHaveBeenCalledWith('delete');
  });
});

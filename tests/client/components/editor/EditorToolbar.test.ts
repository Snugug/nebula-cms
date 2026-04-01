import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import EditorToolbar from '../../../../src/client/components/editor/EditorToolbar.svelte';

/**
 * Tests for the EditorToolbar component.
 * Mocks editor.svelte to control the file state and verify that the toolbar
 * renders save/publish/delete buttons correctly and fires click handlers.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run,
// since vi.mock calls are hoisted to the top of the file by Vitest.
const { mockGetEditorFile } = vi.hoisted(() => ({
  mockGetEditorFile: vi.fn(),
}));

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  getEditorFile: mockGetEditorFile,
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

/** Builds a minimal EditorFile fixture with sensible defaults. */
function makeFile(
  overrides: Partial<{
    filename: string;
    dirty: boolean;
    saving: boolean;
    draftId: string | null;
    formData: Record<string, unknown>;
    body: string;
    bodyLoaded: boolean;
    isNewDraft: boolean;
  }> = {},
) {
  return {
    filename: 'my-post.md',
    dirty: false,
    saving: false,
    draftId: null,
    formData: {},
    body: '',
    bodyLoaded: true,
    isNewDraft: false,
    ...overrides,
  };
}

describe('EditorToolbar', () => {
  //////////////////////////////
  // Renders when file is open
  //////////////////////////////

  it('renders the toolbar header when a file is open', () => {
    mockGetEditorFile.mockReturnValue(makeFile());

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.toolbar')).not.toBeNull();
  });

  it('renders nothing when no file is open', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.toolbar')).toBeNull();
  });

  //////////////////////////////
  // Title display
  //////////////////////////////

  it('shows the title from formData when present', () => {
    mockGetEditorFile.mockReturnValue(
      makeFile({ formData: { title: 'My Great Post' } }),
    );

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'My Great Post',
    );
  });

  it('falls back to the filename when formData has no title', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ filename: 'my-post.md' }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'my-post.md',
    );
  });

  it('shows "Untitled Draft" when there is no title and no filename', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ filename: '' }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.toolbar__title')?.textContent).toContain(
      'Untitled Draft',
    );
  });

  //////////////////////////////
  // Save button
  //////////////////////////////

  it('renders the Save button', () => {
    mockGetEditorFile.mockReturnValue(makeFile());

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    const saveBtn = container.querySelector('.btn--save-outline');
    expect(saveBtn).not.toBeNull();
  });

  it('disables Save when file is not dirty', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ dirty: false }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    const saveBtn = container.querySelector(
      '.btn--save-outline',
    ) as HTMLButtonElement;
    expect(saveBtn?.disabled).toBe(true);
  });

  it('calls onSave when the Save button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeFile({ dirty: true }));
    const onSave = vi.fn();

    const { container } = render(EditorToolbar, {
      props: {
        onSave,
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    await fireEvent.click(container.querySelector('.btn--save-outline')!);
    expect(onSave).toHaveBeenCalledOnce();
  });

  //////////////////////////////
  // Publish button
  //////////////////////////////

  it('renders the Publish button', () => {
    mockGetEditorFile.mockReturnValue(makeFile());

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.btn--primary')).not.toBeNull();
  });

  it('disables the Publish button when publishDisabled prop is true', () => {
    mockGetEditorFile.mockReturnValue(makeFile());

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: true,
      },
    });

    const publishBtn = container.querySelector(
      '.btn--primary',
    ) as HTMLButtonElement;
    expect(publishBtn?.disabled).toBe(true);
  });

  it('enables the Publish button when publishDisabled is false and not saving', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ saving: false }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    const publishBtn = container.querySelector(
      '.btn--primary',
    ) as HTMLButtonElement;
    expect(publishBtn?.disabled).toBe(false);
  });

  it('calls onPublish when the Publish button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeFile());
    const onPublish = vi.fn();

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish,
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    await fireEvent.click(container.querySelector('.btn--primary')!);
    expect(onPublish).toHaveBeenCalledOnce();
  });

  //////////////////////////////
  // Delete Draft button
  //////////////////////////////

  it('renders the Delete Draft button when draftId is set', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ draftId: 'draft-abc-123' }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.btn--danger-outline')).not.toBeNull();
  });

  it('does not render the Delete Draft button when draftId is null', () => {
    mockGetEditorFile.mockReturnValue(makeFile({ draftId: null }));

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete: vi.fn(),
        publishDisabled: false,
      },
    });

    expect(container.querySelector('.btn--danger-outline')).toBeNull();
  });

  it('calls onDelete when the Delete Draft button is clicked', async () => {
    mockGetEditorFile.mockReturnValue(makeFile({ draftId: 'draft-abc' }));
    const onDelete = vi.fn();

    const { container } = render(EditorToolbar, {
      props: {
        onSave: vi.fn(),
        onPublish: vi.fn(),
        onDelete,
        publishDisabled: false,
      },
    });

    await fireEvent.click(container.querySelector('.btn--danger-outline')!);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});

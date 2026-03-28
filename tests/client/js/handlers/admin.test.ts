import { describe, it, expect, vi, beforeEach } from 'vitest';

//////////////////////////////
// admin handler tests
//
// All three imported state modules are mocked so the handlers run in
// isolation without requiring Svelte reactivity or IDB. Each test
// configures the mocks to reflect the scenario under test.
//
// vi.mock() is hoisted to the top of the file by vitest, which means any
// top-level `const mock = vi.fn()` declarations would not yet be initialised
// when the factory runs. We use vi.hoisted() to pre-declare the spy
// references so they are available inside the hoisted vi.mock() factories.
//////////////////////////////

// ── Hoisted mock refs ──────────────────────────────────────────────────────

const {
  mockSaveDraftToIDB,
  mockPublishFile,
  mockDeleteCurrentDraft,
  mockClearEditor,
  mockGetEditorFile,
  mockSetFilename,
  mockGetOriginalFilename,
  mockReloadCollection,
  mockRefreshDrafts,
  mockUpdateContentItem,
  mockNavigate,
} = vi.hoisted(() => ({
  mockSaveDraftToIDB: vi.fn(),
  mockPublishFile: vi.fn(),
  mockDeleteCurrentDraft: vi.fn(),
  mockClearEditor: vi.fn(),
  mockGetEditorFile: vi.fn(),
  mockSetFilename: vi.fn(),
  mockGetOriginalFilename: vi.fn(),
  mockReloadCollection: vi.fn(),
  mockRefreshDrafts: vi.fn(),
  mockUpdateContentItem: vi.fn(),
  mockNavigate: vi.fn(),
}));

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  saveDraftToIDB: mockSaveDraftToIDB,
  publishFile: mockPublishFile,
  deleteCurrentDraft: mockDeleteCurrentDraft,
  clearEditor: mockClearEditor,
  getEditorFile: mockGetEditorFile,
  setFilename: mockSetFilename,
  getOriginalFilename: mockGetOriginalFilename,
}));

vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  reloadCollection: mockReloadCollection,
  refreshDrafts: mockRefreshDrafts,
  updateContentItem: mockUpdateContentItem,
}));

vi.mock('../../../../src/client/js/state/router.svelte', () => ({
  navigate: mockNavigate,
}));

// ── Import handlers ────────────────────────────────────────────────────────

import {
  handleSave,
  handlePublish,
  handleDeleteDraft,
  handleFilenameConfirm,
  computePublishDisabled,
} from '../../../../src/client/js/handlers/admin';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveDraftToIDB.mockResolvedValue(undefined);
    mockRefreshDrafts.mockResolvedValue(undefined);
  });

  it('calls saveDraftToIDB', async () => {
    await handleSave(null);
    expect(mockSaveDraftToIDB).toHaveBeenCalledOnce();
  });

  it('calls refreshDrafts when activeCollection is provided', async () => {
    await handleSave('posts');
    expect(mockRefreshDrafts).toHaveBeenCalledWith('posts');
  });

  it('skips refreshDrafts when activeCollection is null', async () => {
    await handleSave(null);
    expect(mockRefreshDrafts).not.toHaveBeenCalled();
  });
});

describe('handlePublish', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshDrafts.mockResolvedValue(undefined);
    mockPublishFile.mockResolvedValue(undefined);
  });

  it('returns no-file when getEditorFile returns null', async () => {
    mockGetEditorFile.mockReturnValue(null);
    const result = await handlePublish('posts');
    expect(result).toEqual({ status: 'no-file' });
  });

  it('returns no-file when activeCollection is null and file exists', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'test.md',
      isNewDraft: false,
      formData: {},
    });
    const result = await handlePublish(null);
    expect(result).toEqual({ status: 'no-file' });
  });

  it('returns needs-filename when file has no filename', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: '',
      isNewDraft: true,
      formData: {},
    });
    const result = await handlePublish('posts');
    expect(result).toEqual({ status: 'needs-filename' });
  });

  it('publishes and returns ok for existing file', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'hello.md',
      isNewDraft: false,
      formData: { title: 'Hello' },
    });
    // Same filename means no rename — originalFilename arg should be undefined
    mockGetOriginalFilename.mockReturnValue('hello.md');
    const result = await handlePublish('posts');
    expect(mockPublishFile).toHaveBeenCalledWith(
      'posts',
      'hello.md',
      undefined,
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('calls reloadCollection for a new draft after publish', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'new.md',
      isNewDraft: true,
      formData: {},
    });
    // New draft — originalFilename is empty
    mockGetOriginalFilename.mockReturnValue('');
    await handlePublish('posts');
    expect(mockReloadCollection).toHaveBeenCalledWith('posts');
    expect(mockUpdateContentItem).not.toHaveBeenCalled();
  });

  it('calls updateContentItem for an existing file after publish', async () => {
    const formData = { title: 'Existing' };
    mockGetEditorFile.mockReturnValue({
      filename: 'existing.md',
      isNewDraft: false,
      formData,
    });
    // Same filename — no rename
    mockGetOriginalFilename.mockReturnValue('existing.md');
    await handlePublish('posts');
    expect(mockUpdateContentItem).toHaveBeenCalledWith('existing.md', formData);
    expect(mockReloadCollection).not.toHaveBeenCalled();
  });

  it('calls refreshDrafts after a successful publish', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'f.md',
      isNewDraft: false,
      formData: {},
    });
    mockGetOriginalFilename.mockReturnValue('f.md');
    await handlePublish('posts');
    expect(mockRefreshDrafts).toHaveBeenCalledWith('posts');
  });
});

describe('handleDeleteDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshDrafts.mockResolvedValue(undefined);
    mockDeleteCurrentDraft.mockResolvedValue(undefined);
  });

  it('deletes the current draft', async () => {
    mockGetEditorFile.mockReturnValue(null);
    await handleDeleteDraft('posts');
    expect(mockDeleteCurrentDraft).toHaveBeenCalledOnce();
  });

  it('navigates to collection list when draft is new', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: null,
      isNewDraft: true,
      formData: {},
    });
    await handleDeleteDraft('posts');
    expect(mockNavigate).toHaveBeenCalledWith('/admin/posts');
  });

  it('navigates to the live file URL when draft is for existing content', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'my-post.md',
      isNewDraft: false,
      formData: {},
    });
    await handleDeleteDraft('posts');
    expect(mockNavigate).toHaveBeenCalledWith('/admin/posts/my-post');
  });

  it('strips .mdx extension when navigating to live file', async () => {
    mockGetEditorFile.mockReturnValue({
      filename: 'component-post.mdx',
      isNewDraft: false,
      formData: {},
    });
    await handleDeleteDraft('posts');
    expect(mockNavigate).toHaveBeenCalledWith('/admin/posts/component-post');
  });

  it('calls refreshDrafts after deleting', async () => {
    mockGetEditorFile.mockReturnValue(null);
    await handleDeleteDraft('posts');
    expect(mockRefreshDrafts).toHaveBeenCalledWith('posts');
  });

  it('clears the editor before navigating', async () => {
    mockGetEditorFile.mockReturnValue(null);
    await handleDeleteDraft('posts');
    expect(mockClearEditor).toHaveBeenCalledOnce();
  });

  it('does not navigate when activeCollection is null', async () => {
    mockGetEditorFile.mockReturnValue(null);
    await handleDeleteDraft(null);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('handleFilenameConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshDrafts.mockResolvedValue(undefined);
    mockPublishFile.mockResolvedValue(undefined);
    mockGetEditorFile.mockReturnValue({
      filename: 'chosen-name.md',
      isNewDraft: true,
      formData: {},
    });
    // New draft — no original filename
    mockGetOriginalFilename.mockReturnValue('');
  });

  it('sets the filename then calls handlePublish', async () => {
    await handleFilenameConfirm('chosen-name.md', 'posts');
    expect(mockSetFilename).toHaveBeenCalledWith('chosen-name.md');
    expect(mockPublishFile).toHaveBeenCalled();
  });

  it('passes the chosen filename to setFilename', async () => {
    await handleFilenameConfirm('my-article.md', 'posts');
    expect(mockSetFilename).toHaveBeenCalledWith('my-article.md');
  });
});

describe('computePublishDisabled', () => {
  it('returns true when schema is null', () => {
    expect(computePublishDisabled(null, {})).toBe(true);
  });

  it('returns false when schema has no required array', () => {
    expect(computePublishDisabled({ title: 'Schema' }, {})).toBe(false);
  });

  it('returns false when all required fields are populated', () => {
    const schema = { required: ['title', 'date'] };
    const formData = { title: 'Hello', date: '2026-01-01' };
    expect(computePublishDisabled(schema, formData)).toBe(false);
  });

  it('returns true when a required field is undefined', () => {
    const schema = { required: ['title', 'date'] };
    const formData = { title: 'Hello' };
    expect(computePublishDisabled(schema, formData)).toBe(true);
  });

  it('returns true when a required field is null', () => {
    const schema = { required: ['title'] };
    const formData = { title: null };
    expect(computePublishDisabled(schema, formData)).toBe(true);
  });

  it('returns true when a required field is an empty string', () => {
    const schema = { required: ['title'] };
    const formData = { title: '' };
    expect(computePublishDisabled(schema, formData)).toBe(true);
  });

  it('returns false when required is an empty array', () => {
    const schema = { required: [] };
    expect(computePublishDisabled(schema, {})).toBe(false);
  });

  it('returns true when only some required fields are missing', () => {
    const schema = { required: ['title', 'date', 'author'] };
    const formData = { title: 'T', author: 'A' };
    expect(computePublishDisabled(schema, formData)).toBe(true);
  });
});

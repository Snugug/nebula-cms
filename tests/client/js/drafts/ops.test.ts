import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// Module-level mocks
//
// ops.svelte.ts imports from ./storage, ../utils/stable-stringify,
// ../editor/editor.svelte, and ../state/state.svelte. All of these
// must be mocked before the module under test is imported so that
// side-effects (like the registerDirtyChecker call in editor.svelte.ts)
// do not run against uninitialized browser globals.
//////////////////////////////

// js-yaml is imported directly by ops.svelte.ts — mock it so the module
// resolves cleanly in Node.js without requiring the full YAML library.
vi.mock('js-yaml', () => ({
  dump: vi.fn((obj: unknown) => JSON.stringify(obj)),
}));

vi.mock('../../../../src/client/js/drafts/storage', () => ({
  saveDraft: vi.fn(async () => undefined),
  loadDraft: vi.fn(async () => null),
  deleteDraft: vi.fn(async () => undefined),
}));

vi.mock('../../../../src/client/js/utils/stable-stringify', () => ({
  stableStringify: vi.fn((v: unknown) => JSON.stringify(v)),
}));

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  applyEditorState: vi.fn(),
  _getDraftState: vi.fn(() => ({
    saving: false,
    draftId: null,
    isNewDraft: false,
    snapshot: null,
    currentCollection: 'posts',
    draftCreatedAt: null,
    lastSavedFormData: '{"title":"Hello"}',
    lastSavedBody: 'Original body',
    formData: { title: 'Hello' },
    body: 'Current body',
    filename: 'post.md',
    dirty: false,
  })),
  _setDraftState: vi.fn(),
}));

vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  getStorageClient: vi.fn(() => null),
}));

import {
  saveDraft as persistDraft,
  loadDraft as fetchDraft,
  deleteDraft as removeDraft,
} from '../../../../src/client/js/drafts/storage';
import {
  applyEditorState,
  _getDraftState,
  _setDraftState,
} from '../../../../src/client/js/editor/editor.svelte';
import { getStorageClient } from '../../../../src/client/js/state/state.svelte';
import { stableStringify } from '../../../../src/client/js/utils/stable-stringify';

import type { Draft } from '../../../../src/client/js/drafts/storage';

/**
 * Builds a minimal Draft fixture for ops tests.
 * @param {Partial<Draft>} overrides - Optional field overrides
 * @return {Draft} A complete Draft object
 */
function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'draft-001',
    collection: 'posts',
    filename: 'post.md',
    isNew: false,
    formData: { title: 'Hello' },
    body: 'Draft body',
    snapshot: '{"body":"orig","formData":{"title":"Orig"}}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Returns a draft state fixture representing the default editor state shape.
 * @param {object} overrides - Optional field overrides
 * @return {ReturnType<typeof _getDraftState>} The draft state snapshot
 */
function makeEditorState(
  overrides: Partial<ReturnType<typeof _getDraftState>> = {},
): ReturnType<typeof _getDraftState> {
  return {
    saving: false,
    draftId: null,
    isNewDraft: false,
    snapshot: null,
    currentCollection: 'posts',
    draftCreatedAt: null,
    lastSavedFormData: '{"title":"Hello"}',
    lastSavedBody: 'Original body',
    formData: { title: 'Hello' },
    body: 'Current body',
    filename: 'post.md',
    dirty: false,
    ...overrides,
  };
}

//////////////////////////////
// loadDraftById
//////////////////////////////

describe('loadDraftById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies draft state from IDB when draft is found', async () => {
    const draft = makeDraft({ id: 'ldi-01' });
    vi.mocked(fetchDraft).mockResolvedValue(draft);

    const { loadDraftById } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await loadDraftById('ldi-01', 'posts');

    expect(applyEditorState).toHaveBeenCalledWith(
      expect.objectContaining({
        body: draft.body,
        formData: draft.formData,
        filename: draft.filename,
        draftId: draft.id,
        isNewDraft: draft.isNew,
        snapshot: draft.snapshot,
        collection: 'posts',
        bodyLoaded: true,
      }),
      true,
    );
  });

  it('applies fallback empty state when draft is not found', async () => {
    vi.mocked(fetchDraft).mockResolvedValue(null);

    const { loadDraftById } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await loadDraftById('ghost-id', 'posts');

    expect(applyEditorState).toHaveBeenCalledWith(
      expect.objectContaining({
        body: '',
        formData: {},
        bodyLoaded: true,
        draftId: 'ghost-id',
        isNewDraft: true,
        collection: 'posts',
      }),
      true,
    );
  });

  it('fetches the draft by the given ID', async () => {
    vi.mocked(fetchDraft).mockResolvedValue(null);

    const { loadDraftById } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await loadDraftById('specific-id', 'posts');

    expect(fetchDraft).toHaveBeenCalledWith('specific-id');
  });
});

//////////////////////////////
// saveDraftToIDB
//////////////////////////////

describe('saveDraftToIDB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls persistDraft with data from the current editor state', async () => {
    const editorState = makeEditorState({
      draftId: 'existing-draft-id',
      draftCreatedAt: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(_getDraftState).mockReturnValue(editorState);

    const { saveDraftToIDB } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveDraftToIDB();

    expect(persistDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-draft-id',
        collection: 'posts',
        filename: 'post.md',
        body: 'Current body',
        formData: { title: 'Hello' },
      }),
    );
  });

  it('generates a UUID when draftId is null (first save)', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: null,
        draftCreatedAt: null,
        isNewDraft: true,
      }),
    );

    const { saveDraftToIDB } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveDraftToIDB();

    // A UUID must have been provided — check that persistDraft received a non-null id
    const call = vi.mocked(persistDraft).mock.calls[0][0];
    expect(call.id).toBeTruthy();
    expect(typeof call.id).toBe('string');
  });

  it('captures a snapshot for live content on first save', async () => {
    // isNewDraft=false means editing an existing file — snapshot should be set
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: null,
        draftCreatedAt: null,
        isNewDraft: false,
      }),
    );
    vi.mocked(stableStringify).mockReturnValue('{"snapshot":"value"}');

    const { saveDraftToIDB } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveDraftToIDB();

    expect(stableStringify).toHaveBeenCalled();
    const call = vi.mocked(persistDraft).mock.calls[0][0];
    expect(call.snapshot).toBe('{"snapshot":"value"}');
  });

  it('sets saving to true then false regardless of outcome', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'sd-01',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { saveDraftToIDB } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveDraftToIDB();

    const calls = vi.mocked(_setDraftState).mock.calls;
    const savingTrue = calls.some((c) => c[0].saving === true);
    const savingFalse = calls.some((c) => c[0].saving === false);
    expect(savingTrue).toBe(true);
    expect(savingFalse).toBe(true);
  });

  it('clears dirty flag after successful save', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'sd-02',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { saveDraftToIDB } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveDraftToIDB();

    const calls = vi.mocked(_setDraftState).mock.calls;
    const dirtyCall = calls.find((c) => 'dirty' in c[0]);
    expect(dirtyCall?.[0].dirty).toBe(false);
  });
});

//////////////////////////////
// saveFile (alias)
//////////////////////////////

describe('saveFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to saveDraftToIDB and calls persistDraft', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'sf-01',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { saveFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await saveFile();

    expect(persistDraft).toHaveBeenCalled();
  });
});

//////////////////////////////
// publishFile
//////////////////////////////

describe('publishFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when no storage client is connected', async () => {
    vi.mocked(getStorageClient).mockReturnValue(null as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'pf-01',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await expect(publishFile('posts', 'post.md')).rejects.toThrow(
      'No storage backend connected',
    );
  });

  it('writes the file via the storage client', async () => {
    const writeFile = vi.fn(async () => undefined);
    vi.mocked(getStorageClient).mockReturnValue({ writeFile } as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'pf-02',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
        formData: { title: 'Hello' },
        body: 'The body',
      }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await publishFile('posts', 'post.md');

    expect(writeFile).toHaveBeenCalledWith(
      'posts',
      'post.md',
      expect.stringContaining('The body'),
    );
  });

  it('deletes the draft from IDB after a successful write', async () => {
    const writeFile = vi.fn(async () => undefined);
    vi.mocked(getStorageClient).mockReturnValue({ writeFile } as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'pf-03',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await publishFile('posts', 'post.md');

    expect(removeDraft).toHaveBeenCalledWith('pf-03');
  });

  it('clears draftId in state after publish', async () => {
    const writeFile = vi.fn(async () => undefined);
    vi.mocked(getStorageClient).mockReturnValue({ writeFile } as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'pf-04',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await publishFile('posts', 'post.md');

    const calls = vi.mocked(_setDraftState).mock.calls;
    const clearCall = calls.find((c) => c[0].draftId === null);
    expect(clearCall).toBeDefined();
  });

  it('sets saving to true then false', async () => {
    const writeFile = vi.fn(async () => undefined);
    vi.mocked(getStorageClient).mockReturnValue({ writeFile } as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({
        draftId: 'pf-05',
        draftCreatedAt: '2026-01-01T00:00:00.000Z',
      }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await publishFile('posts', 'post.md');

    const calls = vi.mocked(_setDraftState).mock.calls;
    expect(calls.some((c) => c[0].saving === true)).toBe(true);
    expect(calls.some((c) => c[0].saving === false)).toBe(true);
  });

  it('skips draft deletion when draftId is null', async () => {
    const writeFile = vi.fn(async () => undefined);
    vi.mocked(getStorageClient).mockReturnValue({ writeFile } as any);
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({ draftId: null }),
    );

    const { publishFile } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await publishFile('posts', 'post.md');

    expect(removeDraft).not.toHaveBeenCalled();
  });
});

//////////////////////////////
// deleteCurrentDraft
//////////////////////////////

describe('deleteCurrentDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls removeDraft with the current draftId', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({ draftId: 'dcd-01' }),
    );

    const { deleteCurrentDraft } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await deleteCurrentDraft();

    expect(removeDraft).toHaveBeenCalledWith('dcd-01');
  });

  it('skips removeDraft when draftId is null', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({ draftId: null }),
    );

    const { deleteCurrentDraft } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await deleteCurrentDraft();

    expect(removeDraft).not.toHaveBeenCalled();
  });

  it('resets draft state fields to null/false', async () => {
    vi.mocked(_getDraftState).mockReturnValue(
      makeEditorState({ draftId: 'dcd-02' }),
    );

    const { deleteCurrentDraft } =
      await import('../../../../src/client/js/drafts/ops.svelte');
    await deleteCurrentDraft();

    expect(_setDraftState).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        draftCreatedAt: null,
      }),
    );
  });
});

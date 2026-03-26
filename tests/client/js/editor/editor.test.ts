import { describe, it, expect, vi, afterEach } from 'vitest';

//////////////////////////////
// Editor module test strategy
//
// editor.svelte.ts calls registerDirtyChecker() at the top level when the
// module is first evaluated, which requires the router to already be mocked.
// The module also holds all state at module scope — to get a clean starting
// state for each describe block that needs it we use vi.resetModules() +
// dynamic import. All dependency mocks are declared here before static
// imports so Vitest's vi.mock() hoisting guarantees they are in place.
//////////////////////////////

vi.mock('../../../../src/client/js/state/router.svelte', () => ({
  registerDirtyChecker: vi.fn(),
}));

vi.mock('../../../../src/client/js/utils/frontmatter', () => ({
  splitFrontmatter: vi.fn((text: string) => ({
    rawFrontmatter: '',
    body: text,
  })),
}));

vi.mock('../../../../src/client/js/utils/schema-utils', () => ({
  setByPath: vi.fn(
    (
      obj: Record<string, unknown>,
      path: (string | number)[],
      value: unknown,
    ) => {
      // Minimal real implementation so updateFormField tests work correctly
      let current = obj as Record<string | number, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        if (!current[path[i]]) current[path[i]] = {};
        current = current[path[i]] as Record<string | number, unknown>;
      }
      current[path[path.length - 1]] = value;
    },
  ),
}));

vi.mock('../../../../src/client/js/drafts/storage', () => ({
  getDraftByFile: vi.fn(async () => null),
}));

vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  getStorageClient: vi.fn(() => null),
}));

// ops.svelte re-exports — editor.svelte.ts re-exports these; mock them so
// importing the editor does not pull in the real ops module's dependencies.
vi.mock('../../../../src/client/js/drafts/ops.svelte', () => ({
  saveDraftToIDB: vi.fn(async () => undefined),
  saveFile: vi.fn(async () => undefined),
  publishFile: vi.fn(async () => undefined),
  loadDraftById: vi.fn(async () => undefined),
  deleteCurrentDraft: vi.fn(async () => undefined),
}));

import { getDraftByFile } from '../../../../src/client/js/drafts/storage';
import { getStorageClient } from '../../../../src/client/js/state/state.svelte';
import { splitFrontmatter } from '../../../../src/client/js/utils/frontmatter';

import type { Draft } from '../../../../src/client/js/drafts/storage';

/**
 * Builds a minimal Draft fixture for editor tests.
 * @param {Partial<Draft>} overrides - Optional field overrides
 * @return {Draft} A complete Draft object
 */
function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'ed-draft-01',
    collection: 'posts',
    filename: 'post.md',
    isNew: false,
    formData: { title: 'Draft Title' },
    body: 'Draft body content',
    snapshot: '{"body":"orig","formData":{"title":"Orig"}}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

//////////////////////////////
// getEditorFile / getFormData — initial state
//////////////////////////////

describe('getEditorFile — initial state', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns null when no file has been opened', async () => {
    vi.resetModules();
    const { getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    expect(getEditorFile()).toBeNull();
  });
});

describe('getFormData — initial state', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns an empty object before any file is loaded', async () => {
    vi.resetModules();
    const { getFormData } =
      await import('../../../../src/client/js/editor/editor.svelte');
    expect(getFormData()).toEqual({});
  });
});

//////////////////////////////
// getActiveTab / setActiveTab
//////////////////////////////

describe('getActiveTab / setActiveTab', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns "metadata" as the default active tab', async () => {
    vi.resetModules();
    const { getActiveTab } =
      await import('../../../../src/client/js/editor/editor.svelte');
    expect(getActiveTab()).toBe('metadata');
  });

  it('updates the active tab via setActiveTab', async () => {
    vi.resetModules();
    const { getActiveTab, setActiveTab } =
      await import('../../../../src/client/js/editor/editor.svelte');
    setActiveTab('content');
    expect(getActiveTab()).toBe('content');
  });

  it('can set any arbitrary tab string', async () => {
    vi.resetModules();
    const { getActiveTab, setActiveTab } =
      await import('../../../../src/client/js/editor/editor.svelte');
    setActiveTab('seo');
    expect(getActiveTab()).toBe('seo');
  });
});

//////////////////////////////
// applyEditorState
//////////////////////////////

describe('applyEditorState', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('opens the file and populates getEditorFile when open=true', async () => {
    vi.resetModules();
    const { applyEditorState, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'Hello',
        formData: { title: 'T' },
        filename: 'test.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    const file = getEditorFile();
    expect(file).not.toBeNull();
    expect(file?.body).toBe('Hello');
    expect(file?.filename).toBe('test.md');
    expect(file?.dirty).toBe(false);
  });

  it('resets activeTab to "metadata" on each apply', async () => {
    vi.resetModules();
    const { applyEditorState, getActiveTab, setActiveTab } =
      await import('../../../../src/client/js/editor/editor.svelte');
    setActiveTab('content');
    applyEditorState(
      {
        body: '',
        formData: {},
        filename: 'x.md',
        bodyLoaded: false,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    expect(getActiveTab()).toBe('metadata');
  });

  it('keeps getEditorFile null when open=false', async () => {
    vi.resetModules();
    const { applyEditorState, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: '',
        formData: {},
        filename: '',
        bodyLoaded: false,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: '',
        draftCreatedAt: null,
      },
      false,
    );
    expect(getEditorFile()).toBeNull();
  });
});

//////////////////////////////
// updateFormField
//////////////////////////////

describe('updateFormField', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('updates a top-level formData field', async () => {
    vi.resetModules();
    const { applyEditorState, updateFormField, getFormData } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: '',
        formData: { title: 'Original' },
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    updateFormField(['title'], 'Updated');
    expect(getFormData()['title']).toBe('Updated');
  });

  it('marks the file dirty after a formData change', async () => {
    vi.resetModules();
    const { applyEditorState, updateFormField, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: '',
        formData: { title: 'Same' },
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    updateFormField(['title'], 'Different');
    expect(getEditorFile()?.dirty).toBe(true);
  });
});

//////////////////////////////
// updateBody
//////////////////////////////

describe('updateBody', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('updates the body content', async () => {
    vi.resetModules();
    const { applyEditorState, updateBody, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'original',
        formData: {},
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    updateBody('new content');
    expect(getEditorFile()?.body).toBe('new content');
  });

  it('marks the file dirty when body differs from last saved', async () => {
    vi.resetModules();
    const { applyEditorState, updateBody, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'saved',
        formData: {},
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    updateBody('changed');
    expect(getEditorFile()?.dirty).toBe(true);
  });

  it('clears dirty when body is restored to last saved value', async () => {
    vi.resetModules();
    const { applyEditorState, updateBody, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'saved body',
        formData: {},
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    updateBody('changed');
    updateBody('saved body');
    expect(getEditorFile()?.dirty).toBe(false);
  });
});

//////////////////////////////
// clearEditor
//////////////////////////////

describe('clearEditor', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns null from getEditorFile after clearing', async () => {
    vi.resetModules();
    const { applyEditorState, clearEditor, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'content',
        formData: { title: 'T' },
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    clearEditor();
    expect(getEditorFile()).toBeNull();
  });

  it('resets formData to empty object', async () => {
    vi.resetModules();
    const { applyEditorState, clearEditor, getFormData } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: '',
        formData: { title: 'X' },
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    clearEditor();
    expect(getFormData()).toEqual({});
  });
});

//////////////////////////////
// preloadFile
//////////////////////////////

describe('preloadFile', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads draft data when a draft exists for the file', async () => {
    vi.resetModules();
    const draft = makeDraft();
    vi.mocked(getDraftByFile).mockResolvedValue(draft);

    const { preloadFile, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    await preloadFile('posts', 'post.md', { title: 'Live' });

    const file = getEditorFile();
    expect(file?.body).toBe(draft.body);
    expect(file?.formData).toEqual(draft.formData);
    expect(file?.draftId).toBe(draft.id);
    expect(file?.bodyLoaded).toBe(true);
  });

  it('loads live data when no draft exists', async () => {
    vi.resetModules();
    vi.mocked(getDraftByFile).mockResolvedValue(null);

    const { preloadFile, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    await preloadFile('posts', 'live-file.md', { title: 'Live Title' });

    const file = getEditorFile();
    expect(file?.body).toBe('');
    expect(file?.formData).toEqual({ title: 'Live Title' });
    expect(file?.draftId).toBeNull();
    expect(file?.bodyLoaded).toBe(false);
  });

  it('is a no-op when the same file is already open', async () => {
    vi.resetModules();
    vi.mocked(getDraftByFile).mockResolvedValue(null);

    const { preloadFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    await preloadFile('posts', 'same.md', { title: 'First' });

    vi.clearAllMocks();
    await preloadFile('posts', 'same.md', { title: 'Second' });

    // getDraftByFile should not be called on the second preload of the same file
    expect(getDraftByFile).not.toHaveBeenCalled();
  });
});

//////////////////////////////
// loadFileBody
//////////////////////////////

describe('loadFileBody', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('does nothing when no storage client is connected', async () => {
    vi.resetModules();
    vi.mocked(getStorageClient).mockReturnValue(null as any);
    vi.mocked(getDraftByFile).mockResolvedValue(null);

    const { preloadFile, loadFileBody, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    await preloadFile('posts', 'f.md', {});
    await loadFileBody('posts', 'f.md');

    // bodyLoaded should remain false since client was null
    expect(getEditorFile()?.bodyLoaded).toBe(false);
  });

  it('reads the file and updates body + bodyLoaded flag', async () => {
    vi.resetModules();
    vi.mocked(getDraftByFile).mockResolvedValue(null);
    vi.mocked(splitFrontmatter).mockReturnValue({
      rawFrontmatter: 'title: T',
      body: '\n\nThe markdown body\n\n',
    });
    const fakeClient = {
      readFile: vi.fn(
        async () => '---\ntitle: T\n---\n\nThe markdown body\n\n',
      ),
    };
    vi.mocked(getStorageClient).mockReturnValue(fakeClient as any);

    const { preloadFile, loadFileBody, getEditorFile } =
      await import('../../../../src/client/js/editor/editor.svelte');
    await preloadFile('posts', 'body-file.md', { title: 'T' });
    await loadFileBody('posts', 'body-file.md');

    const file = getEditorFile();
    expect(file?.bodyLoaded).toBe(true);
    // Leading/trailing newlines are stripped from the body
    expect(file?.body).toBe('The markdown body');
  });
});

//////////////////////////////
// _getDraftState / _setDraftState
//////////////////////////////

describe('_getDraftState / _setDraftState', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('_getDraftState returns current internal state snapshot', async () => {
    vi.resetModules();
    const { _getDraftState } =
      await import('../../../../src/client/js/editor/editor.svelte');
    const state = _getDraftState();
    expect(state).toHaveProperty('saving');
    expect(state).toHaveProperty('draftId');
    expect(state).toHaveProperty('isNewDraft');
    expect(state).toHaveProperty('snapshot');
    expect(state).toHaveProperty('currentCollection');
    expect(state).toHaveProperty('body');
    expect(state).toHaveProperty('formData');
  });

  it('_setDraftState updates the saving flag', async () => {
    vi.resetModules();
    const { _setDraftState, _getDraftState } =
      await import('../../../../src/client/js/editor/editor.svelte');
    _setDraftState({ saving: true });
    expect(_getDraftState().saving).toBe(true);
    _setDraftState({ saving: false });
    expect(_getDraftState().saving).toBe(false);
  });

  it('_setDraftState updates draftId', async () => {
    vi.resetModules();
    const { _setDraftState, _getDraftState } =
      await import('../../../../src/client/js/editor/editor.svelte');
    _setDraftState({ draftId: 'new-id' });
    expect(_getDraftState().draftId).toBe('new-id');
  });

  it('_setDraftState only mutates the specified fields', async () => {
    vi.resetModules();
    const { applyEditorState, _setDraftState, _getDraftState } =
      await import('../../../../src/client/js/editor/editor.svelte');
    applyEditorState(
      {
        body: 'body',
        formData: { title: 'T' },
        filename: 'f.md',
        bodyLoaded: true,
        draftId: null,
        isNewDraft: true,
        snapshot: null,
        collection: 'posts',
        draftCreatedAt: null,
      },
      true,
    );
    _setDraftState({ saving: true });
    // isNewDraft should be unchanged
    expect(_getDraftState().isNewDraft).toBe(true);
  });
});

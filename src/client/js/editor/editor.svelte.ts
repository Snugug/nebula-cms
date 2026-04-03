/*
 * Reactive editor state for the file editing view.
 * Manages loading, saving, and dirty-checking of content files and drafts.
 */

import { registerDirtyChecker } from '../state/router.svelte';
import { splitFrontmatter } from '../utils/frontmatter';
import { setByPath, type PathSegment } from '../utils/schema-utils';
import { getDraftByFile } from '../drafts/storage';
import { storageClient } from '../state/state.svelte';
import {
  getFileCategory,
  stripExtension,
  getDefaultExtension,
  FILE_TYPES,
} from '../utils/file-types';

// Editor file state exposed via getEditorFile().
export type EditorFile = {
  body: string;
  formData: Record<string, unknown>;
  dirty: boolean;
  saving: boolean;
  filename: string;
  bodyLoaded: boolean;
  draftId: string | null;
  isNewDraft: boolean;
};

// Shape for bulk-setting all editor state via applyEditorState.
export type EditorStateConfig = {
  body: string;
  formData: Record<string, unknown>;
  filename: string;
  bodyLoaded: boolean;
  draftId: string | null;
  isNewDraft: boolean;
  snapshot: string | null;
  collection: string;
  draftCreatedAt: string | null;
};

let body = $state('');
let formData = $state<Record<string, unknown>>({});
let dirty = $state(false);
let saving = $state(false);
let lastSavedBody = '';
let lastSavedFormData = '{}';
let filename = $state('');
let fileOpen = $state(false);
let activeTab = $state('metadata');
let bodyLoaded = $state(false);
let originalFilename = $state(''); // filename at load time — publish uses this to detect renames
// Draft-specific state
let draftId = $state<string | null>(null);
let isNewDraft = $state(false);
let snapshot = $state<string | null>(null);
let currentCollection = $state('');
let draftCreatedAt = $state<string | null>(null);
registerDirtyChecker(() => dirty);

export const editor = {
  // Current structured form data for the open file.
  get data(): Record<string, unknown> {
    return formData;
  },
  // Currently active editor tab identifier.
  get tab(): string {
    return activeTab;
  },
  // Filename at load time — publish uses this to detect renames.
  get originalFilename(): string {
    return originalFilename;
  },
};

/**
 * Applies a full set of editor state values, resetting dirty/saving flags and updating save baselines.
 * @param {EditorStateConfig} c - All editor state fields to apply
 * @param {boolean} open - Whether to mark the file as open
 * @return {void}
 */
export function applyEditorState(c: EditorStateConfig, open: boolean): void {
  formData = c.formData;
  lastSavedFormData = JSON.stringify(c.formData);
  body = c.body;
  lastSavedBody = c.body;
  dirty = false;
  formDataDirty = false;
  saving = false;
  filename = c.filename;
  originalFilename = c.filename;
  bodyLoaded = c.bodyLoaded;
  activeTab = 'metadata';
  fileOpen = open;
  draftId = c.draftId;
  isNewDraft = c.isNewDraft;
  snapshot = c.snapshot;
  currentCollection = c.collection;
  draftCreatedAt = c.draftCreatedAt;
}

/*
 * Tracks whether formData has diverged from its saved snapshot.
 * Updated only by updateFormField to avoid re-serializing on every body keystroke.
 */
let formDataDirty = false;
/**
 * Recomputes dirty state from body comparison and the cached formData flag.
 * @return {void}
 */
function recomputeDirty(): void {
  dirty = body !== lastSavedBody || formDataDirty;
}

/**
 * Returns a snapshot of draft-related internal state for use by editor-draft-ops. Exposes private module state without leaking $state reactivity.
 * @return {object} Snapshot of all draft-related editor state
 */
export function _getDraftState() {
  return {
    saving,
    draftId,
    isNewDraft,
    snapshot,
    currentCollection,
    draftCreatedAt,
    lastSavedFormData,
    lastSavedBody,
    formData,
    body,
    filename,
    originalFilename,
    dirty,
  };
}

/**
 * Applies draft-related state mutations from editor-draft-ops back into the reactive module state.
 * @param {Partial<ReturnType<typeof _getDraftState>>} updates - Fields to update
 * @return {void}
 */
export function _setDraftState(
  updates: Partial<ReturnType<typeof _getDraftState>>,
): void {
  if ('saving' in updates) saving = updates.saving!;
  if ('draftId' in updates) draftId = updates.draftId!;
  if ('isNewDraft' in updates) isNewDraft = updates.isNewDraft!;
  if ('snapshot' in updates) snapshot = updates.snapshot!;
  if ('draftCreatedAt' in updates) draftCreatedAt = updates.draftCreatedAt!;
  if ('lastSavedFormData' in updates)
    lastSavedFormData = updates.lastSavedFormData!;
  if ('lastSavedBody' in updates) lastSavedBody = updates.lastSavedBody!;
  if ('dirty' in updates) dirty = updates.dirty!;
  if ('originalFilename' in updates)
    originalFilename = updates.originalFilename!;
}
/**
 * Returns the current editor file state, or null if no file is open.
 * @return {EditorFile | null} The current editor file state, or null
 */
export function getEditorFile(): EditorFile | null {
  if (!fileOpen) return null;
  return {
    body,
    formData,
    dirty,
    saving,
    filename,
    bodyLoaded,
    draftId,
    isNewDraft,
  };
}
/**
 * Sets the active editor tab.
 * @param {string} tab - The tab identifier to activate
 * @return {void}
 */
export function setActiveTab(tab: string): void {
  activeTab = tab;
}
/**
 * Updates a single field within formData by path and recomputes dirty state.
 * @param {PathSegment[]} path - Ordered path segments addressing the field
 * @param {unknown} value - The new value to assign at the given path
 * @return {void}
 */
export function updateFormField(path: PathSegment[], value: unknown): void {
  setByPath(formData, path, value);
  formDataDirty = JSON.stringify(formData) !== lastSavedFormData;
  recomputeDirty();
}

/**
 * Populates the editor with metadata so the UI renders without waiting for the async file read. Checks IndexedDB for an existing draft first — if found, loads draft data instead.
 * @param {string} collection - The collection this file belongs to
 * @param {string} itemFilename - The content file's name
 * @param {Record<string, unknown>} data - Pre-parsed frontmatter data
 * @return {Promise<void>}
 */
export async function preloadFile(
  collection: string,
  itemFilename: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Compare slugs so a format change (e.g. .md → .mdx) doesn't trigger a full reload
  if (stripExtension(filename) === stripExtension(itemFilename) && fileOpen)
    return;

  // Check IndexedDB for an existing draft of this live file
  const d = await getDraftByFile(collection, itemFilename);
  if (d) {
    // Draft already contains body content, no disk read needed
    applyEditorState(
      {
        body: d.body,
        formData: d.formData,
        filename: itemFilename,
        bodyLoaded: true,
        draftId: d.id,
        isNewDraft: d.isNew,
        snapshot: d.snapshot,
        collection,
        draftCreatedAt: d.createdAt,
      },
      true,
    );
    return;
  }
  // No draft — load live data; $state.snapshot strips Svelte reactive proxies
  applyEditorState(
    {
      body: '',
      formData: $state.snapshot(data) as Record<string, unknown>,
      filename: itemFilename,
      bodyLoaded: false,
      draftId: null,
      isNewDraft: false,
      snapshot: null,
      collection,
      draftCreatedAt: null,
    },
    true,
  );
}

/**
 * Sets the filename for the current editor file. Used by the filename dialog.
 * @param {string} newFilename - The new filename to set
 * @return {void}
 */
export function setFilename(newFilename: string): void {
  filename = newFilename;
}

/**
 * Changes the file format by swapping the filename extension to the new type's default. Preserves the slug (base filename without extension) and leaves originalFilename untouched so publishFile can detect the rename and delete the old file on disk.
 * @param {string} newType - The type identifier to switch to (e.g. 'md', 'json')
 * @return {void}
 */
export function changeFileFormat(newType: string): void {
  const ext = getDefaultExtension(newType);
  if (!ext) return;
  const slug = filename ? stripExtension(filename) : '';
  filename = slug ? slug + ext : '';
  // Switch to metadata tab if the new format has no body editor
  const config = FILE_TYPES[newType];
  if (config && !config.hasBody && activeTab === 'body') activeTab = 'metadata';
}

/**
 * Sets a default file format for a new draft based on the collection's supported file types. Only applies when the editor has no filename yet (new draft). Sets the activeTab to 'body' if the format supports body editing.
 * @param {string[]} fileTypes - Type identifiers from the schema's files array
 * @return {void}
 */
export function setDefaultFormat(fileTypes: string[]): void {
  if (filename || fileTypes.length === 0) return;
  const defaultType = fileTypes[0];
  const ext = getDefaultExtension(defaultType);
  if (!ext) return;
  // Set just the extension so EditorTabs and FormatSelector derive the correct type
  filename = ext;
  // Activate body tab for content types that support it
  if (FILE_TYPES[defaultType]?.hasBody) activeTab = 'body';
}

/**
 * Loads body content via StorageClient for an already-preloaded file, completing the two-phase load.
 * @param {string} collection - The collection the file belongs to
 * @param {string} filename - The filename to read within the collection
 * @return {Promise<void>}
 */
export async function loadFileBody(
  collection: string,
  filename: string,
): Promise<void> {
  const category = getFileCategory(filename);
  if (category === 'data') {
    // Data files have no body — all content was parsed as formData during preload
    bodyLoaded = true;
    return;
  }
  if (!storageClient) return;
  const text = await storageClient.readFile(collection, filename);
  const split = splitFrontmatter(text);
  // Strip leading/trailing newlines from body; added back on save when reconstituting the file
  body = lastSavedBody = split.body.replace(/^\n+/, '').replace(/\n+$/, '');
  bodyLoaded = true;
}

/**
 * Updates the editor body content and recomputes dirty state.
 * Only compares body against its saved snapshot — avoids serializing
 * formData to JSON on every keystroke from CodeMirror's update listener.
 * @param {string} content - The new body content
 * @return {void}
 */
export function updateBody(content: string): void {
  body = content;
  recomputeDirty();
}

/**
 * Resets all editor state including draft-specific fields.
 * @return {void}
 */
export function clearEditor(): void {
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
}

/*
 * Re-export draft operations so existing import paths keep working.
 * The canonical source is editor-draft-ops.svelte.ts.
 */
export {
  saveDraftToIDB,
  saveFile,
  publishFile,
  loadDraftById,
  deleteCurrentDraft,
} from '../drafts/ops.svelte';

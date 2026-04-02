import {
  saveDraft as persistDraft,
  loadDraft as fetchDraft,
  deleteDraft as removeDraft,
  type Draft,
} from './storage';
import { stableStringify } from '../utils/stable-stringify';
import {
  applyEditorState,
  _getDraftState,
  _setDraftState,
} from '../editor/editor.svelte';
import { storageClient } from '../state/state.svelte';
import { getFileCategory, getDataFormat } from '../utils/file-types';

/**
 * Loads a draft by ID from IndexedDB and populates the editor. Falls back to empty state if the draft is not found (safety fallback for the "Add" button flow).
 * @param {string} id - The draft UUID to load
 * @param {string} collection - The collection this draft belongs to
 * @return {Promise<void>}
 */
export async function loadDraftById(
  id: string,
  collection: string,
): Promise<void> {
  const draft = await fetchDraft(id);

  if (!draft) {
    applyEditorState(
      {
        body: '',
        formData: {},
        filename: '',
        bodyLoaded: true,
        draftId: id,
        isNewDraft: true,
        snapshot: null,
        collection,
        draftCreatedAt: new Date().toISOString(),
      },
      true,
    );
    return;
  }

  applyEditorState(
    {
      body: draft.body,
      formData: draft.formData,
      filename: draft.filename ?? '',
      bodyLoaded: true,
      draftId: draft.id,
      isNewDraft: draft.isNew,
      snapshot: draft.snapshot,
      collection,
      draftCreatedAt: draft.createdAt,
    },
    true,
  );
}

/**
 * Saves the current editor content as a draft in IndexedDB. On first save, generates a UUID and createdAt timestamp. For live content edits, captures a snapshot of the original data.
 * @return {Promise<void>}
 */
export async function saveDraftToIDB(): Promise<void> {
  const s = _getDraftState();
  _setDraftState({ saving: true });

  try {
    let { draftId, draftCreatedAt, snapshot } = s;

    // Generate draft ID and timestamp on first save
    if (!draftId) {
      draftId = crypto.randomUUID();
      draftCreatedAt = new Date().toISOString();

      // For live content edits, capture a snapshot of the original saved data
      if (!s.isNewDraft) {
        snapshot = stableStringify({
          formData: JSON.parse(s.lastSavedFormData),
          body: s.lastSavedBody,
        });
      }

      _setDraftState({ draftId, draftCreatedAt, snapshot });
    }

    const draft: Draft = {
      id: draftId,
      collection: s.currentCollection,
      filename: s.filename || null,
      isNew: s.isNewDraft,
      formData: $state.snapshot(s.formData) as Record<string, unknown>,
      body: s.body,
      snapshot,
      createdAt: draftCreatedAt!,
    };

    await persistDraft(draft);
    _setDraftState({
      lastSavedBody: s.body,
      lastSavedFormData: JSON.stringify(s.formData),
      dirty: false,
    });
  } finally {
    _setDraftState({ saving: false });
  }
}

/**
 * Legacy alias for saveDraftToIDB — preserves existing test mock call sites.
 * @return {Promise<void>}
 */
export async function saveFile(): Promise<void> {
  return saveDraftToIDB();
}

/**
 * Serializes editor content based on the target file format. Data files produce pure JSON/YAML/TOML; frontmatter files produce the standard `---` delimited format.
 * @param {string} filename - The target filename, used to determine format
 * @param {Record<string, unknown>} formData - The structured data to serialize
 * @param {string} body - The body content (only used for frontmatter files)
 * @return {Promise<string>} The serialized file content
 */
async function serializeContent(
  filename: string,
  formData: Record<string, unknown>,
  body: string,
): Promise<string> {
  const category = getFileCategory(filename);

  // Lazy-load js-yaml once for both data and frontmatter YAML paths
  const loadYAML = () => import('js-yaml');

  if (category === 'data') {
    const format = getDataFormat(filename);
    switch (format) {
      case 'json':
        return JSON.stringify(formData, null, 2) + '\n';
      case 'yaml': {
        const { dump } = await loadYAML();
        return dump(formData, { lineWidth: -1 });
      }
      case 'toml': {
        const { stringify } = await import('smol-toml');
        return stringify(formData);
      }
      default:
        throw new Error(`Unsupported data format: ${format}`);
    }
  }

  // Frontmatter files: ---\nyaml\n---\n\nbody\n
  const { dump } = await loadYAML();
  // dump() adds a trailing newline, so the template omits a \n before ---
  const yaml = dump(formData, { lineWidth: -1 });
  return `---\n${yaml}---\n\n${body}\n`;
}

/**
 * Writes editor content to the storage backend via StorageClient. Dispatches serialization by file format. If originalFilename is provided and differs from filename, deletes the old file (file type conversion). Deletes the associated draft from IndexedDB after a successful write.
 * @param {string} collection - The collection the file belongs to
 * @param {string} filename - The filename to write within the collection
 * @param {string} [originalFilename] - The previous filename if the file was renamed/converted
 * @return {Promise<void>}
 */
export async function publishFile(
  collection: string,
  filename: string,
  originalFilename?: string,
): Promise<void> {
  const s = _getDraftState();
  _setDraftState({ saving: true });

  try {
    const content = await serializeContent(filename, s.formData, s.body);
    await storageClient.writeFile(collection, filename, content);

    // Remove the old file if the filename changed (file type conversion)
    if (originalFilename && originalFilename !== filename) {
      await storageClient.deleteFile(collection, originalFilename);
    }

    // Clean up the draft from IndexedDB after successful publish
    if (s.draftId) {
      await removeDraft(s.draftId);
      _setDraftState({
        draftId: null,
        isNewDraft: false,
        snapshot: null,
        draftCreatedAt: null,
      });
    }

    // Update originalFilename so subsequent publishes know the current on-disk name.
    // Without this, a second format change would not detect the rename because
    // originalFilename would still point to the pre-first-publish name.
    _setDraftState({
      lastSavedBody: s.body,
      lastSavedFormData: JSON.stringify(s.formData),
      dirty: false,
      originalFilename: filename,
    });
  } finally {
    _setDraftState({ saving: false });
  }
}

/**
 * Deletes the current draft from IndexedDB and resets draft-related state fields.
 * @return {Promise<void>}
 */
export async function deleteCurrentDraft(): Promise<void> {
  const { draftId } = _getDraftState();
  if (draftId) {
    await removeDraft(draftId);
  }
  _setDraftState({
    draftId: null,
    isNewDraft: false,
    snapshot: null,
    draftCreatedAt: null,
  });
}

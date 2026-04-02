import type { Mock } from 'vitest';

//////////////////////////////
// Mock state type
//
// Each test file creates its own mocks via vi.hoisted(). This type
// describes the shape so helper functions can manipulate mock return
// values without being tightly coupled to any single test file.
// Mock names match the getter properties on the exported state objects
// (backend, content, nav, schema, drafts, editor).
//////////////////////////////

/**
 * Shape of the mocks object created by vi.hoisted() in each test file.
 * Each field is a Vitest Mock function controlling a reactive export.
 */
export type E2EMocks = {
  mockBackendReady: Mock<() => boolean>;
  mockRoute: Mock;
  mockCollections: Mock<() => string[]>;
  mockContentList: Mock;
  mockLoading: Mock<() => boolean>;
  mockError: Mock<() => string | null>;
  mockDrafts: Mock;
  mockOutdatedMap: Mock<() => Record<string, boolean>>;
  mockActiveTab: Mock<() => string>;
  mockGetEditorFile: Mock;
  mockSchema: Mock;
  mockCollectionHasDates: Mock<() => boolean>;
  mockComputePublishDisabled: Mock<() => boolean>;
};

/**
 * Resets all mock return values to their disconnected defaults.
 * Call in beforeEach() to avoid state leaking between tests.
 * @param {E2EMocks} m - The mocks object to reset
 * @return {void}
 */
export function resetMocks(m: E2EMocks): void {
  m.mockBackendReady.mockReturnValue(false);
  m.mockRoute.mockReturnValue({ view: 'home' });
  m.mockCollections.mockReturnValue([]);
  m.mockContentList.mockReturnValue([]);
  m.mockLoading.mockReturnValue(false);
  m.mockError.mockReturnValue(null);
  m.mockDrafts.mockReturnValue([]);
  m.mockOutdatedMap.mockReturnValue({});
  m.mockActiveTab.mockReturnValue('metadata');
  m.mockGetEditorFile.mockReturnValue(null);
  m.mockSchema.mockReturnValue(null);
  m.mockCollectionHasDates.mockReturnValue(false);
  m.mockComputePublishDisabled.mockReturnValue(false);
}

/**
 * Configures mocks to show the backend as connected with collections visible.
 * @param {E2EMocks} m - The mocks object
 * @param {string[]} collections - Collection names to show
 * @return {void}
 */
export function configureConnected(
  m: E2EMocks,
  collections: string[] = ['pages', 'posts'],
): void {
  m.mockBackendReady.mockReturnValue(true);
  m.mockCollections.mockReturnValue(collections);
}

/**
 * Configures mocks to show a collection selected with content items.
 * @param {E2EMocks} m - The mocks object
 * @param {string} collection - The active collection name
 * @param {Array<{ filename: string, data: Record<string, unknown> }>} items - Content items
 * @return {void}
 */
export function configureCollection(
  m: E2EMocks,
  collection: string,
  items: Array<{ filename: string; data: Record<string, unknown> }> = [],
): void {
  configureConnected(m);
  m.mockRoute.mockReturnValue({ view: 'collection', collection });
  m.mockContentList.mockReturnValue(items);
}

/**
 * Configures mocks to show a file open in the editor.
 * @param {E2EMocks} m - The mocks object
 * @param {string} collection - The active collection
 * @param {string} slug - The file slug (filename without extension)
 * @param {{ filename: string, body: string, formData: Record<string, unknown>, dirty?: boolean, draftId?: string | null, isNewDraft?: boolean }} file - Editor file state
 * @return {void}
 */
export function configureFileOpen(
  m: E2EMocks,
  collection: string,
  slug: string,
  file: {
    filename: string;
    body: string;
    formData: Record<string, unknown>;
    dirty?: boolean;
    draftId?: string | null;
    isNewDraft?: boolean;
  },
): void {
  configureConnected(m);
  m.mockRoute.mockReturnValue({ view: 'file', collection, slug });
  m.mockContentList.mockReturnValue([
    { filename: file.filename, data: file.formData },
  ]);
  m.mockGetEditorFile.mockReturnValue({
    filename: file.filename,
    body: file.body,
    formData: file.formData,
    dirty: file.dirty ?? false,
    saving: false,
    bodyLoaded: true,
    draftId: file.draftId ?? null,
    isNewDraft: file.isNewDraft ?? false,
  });
}

/**
 * Configures mocks to show a draft open in the editor.
 * @param {E2EMocks} m - The mocks object
 * @param {string} collection - The active collection
 * @param {string} draftId - The draft UUID
 * @param {{ body: string, formData: Record<string, unknown>, dirty?: boolean, filename?: string }} draft - Draft state
 * @return {void}
 */
export function configureDraftOpen(
  m: E2EMocks,
  collection: string,
  draftId: string,
  draft: {
    body: string;
    formData: Record<string, unknown>;
    dirty?: boolean;
    filename?: string;
  },
): void {
  configureConnected(m);
  m.mockRoute.mockReturnValue({ view: 'draft', collection, draftId });
  m.mockGetEditorFile.mockReturnValue({
    filename: draft.filename ?? '',
    body: draft.body,
    formData: draft.formData,
    dirty: draft.dirty ?? false,
    saving: false,
    bodyLoaded: true,
    draftId,
    isNewDraft: true,
  });
}

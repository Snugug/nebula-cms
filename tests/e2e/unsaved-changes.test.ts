import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { resetMocks, configureFileOpen } from './helpers/test-app';

//////////////////////////////
// Hoisted mocks
//////////////////////////////

const mocks = vi.hoisted(() => ({
  mockIsBackendReady: vi.fn(() => false),
  mockGetRoute: vi.fn(() => ({ view: 'home' as const })),
  mockGetCollections: vi.fn(() => [] as string[]),
  mockGetContentList: vi.fn(
    () => [] as Array<{ filename: string; data: Record<string, unknown> }>,
  ),
  mockIsLoading: vi.fn(() => false),
  mockGetError: vi.fn(() => null as string | null),
  mockGetDrafts: vi.fn(() => []),
  mockGetOutdatedMap: vi.fn(() => ({}) as Record<string, boolean>),
  mockGetActiveTab: vi.fn(() => 'metadata'),
  mockGetEditorFile: vi.fn(() => null),
  mockGetSchema: vi.fn(() => null),
  mockCollectionHasDates: vi.fn(() => false),
  mockComputePublishDisabled: vi.fn(() => false),
}));

//////////////////////////////
// Module mocks
//////////////////////////////

vi.mock('virtual:collections', () => ({
  default: {
    pages: '/collections/pages.schema.json',
    posts: '/collections/posts.schema.json',
  },
}));
vi.mock('../../src/client/js/state/state.svelte', () => ({
  isBackendReady: mocks.mockIsBackendReady,
  getCollections: mocks.mockGetCollections,
  getContentList: mocks.mockGetContentList,
  isLoading: mocks.mockIsLoading,
  getError: mocks.mockGetError,
  getDrafts: mocks.mockGetDrafts,
  getOutdatedMap: mocks.mockGetOutdatedMap,
  restoreBackend: vi.fn(async () => {}),
  loadCollection: vi.fn(),
  reloadCollection: vi.fn(),
  disconnect: vi.fn(),
  refreshDrafts: vi.fn(async () => {}),
  updateContentItem: vi.fn(),
  getBackendType: vi.fn(() => null),
  getPermissionState: vi.fn(() => 'denied'),
  pickDirectory: vi.fn(),
  requestPermission: vi.fn(),
  connectGitHub: vi.fn(async () => {}),
  getStorageClient: vi.fn(() => null),
}));
vi.mock('../../src/client/js/state/router.svelte', () => ({
  initRouter: vi.fn(),
  getRoute: mocks.mockGetRoute,
  navigate: vi.fn(),
  registerDirtyChecker: vi.fn(),
}));
vi.mock('../../src/client/js/state/schema.svelte', () => ({
  fetchSchema: vi.fn(async () => {}),
  getSchema: mocks.mockGetSchema,
  clearSchema: vi.fn(),
  prefetchAllSchemas: vi.fn(async () => {}),
  collectionHasDates: mocks.mockCollectionHasDates,
  getCollectionTitle: vi.fn(() => null),
  getCollectionDescription: vi.fn(() => null),
}));
vi.mock('../../src/client/js/editor/editor.svelte', () => ({
  preloadFile: vi.fn(async () => {}),
  loadFileBody: vi.fn(async () => {}),
  clearEditor: vi.fn(),
  getActiveTab: mocks.mockGetActiveTab,
  setActiveTab: vi.fn(),
  getEditorFile: mocks.mockGetEditorFile,
  loadDraftById: vi.fn(async () => {}),
  setFilename: vi.fn(),
  updateBody: vi.fn(),
  updateFormField: vi.fn(),
  getFormData: vi.fn(() => ({})),
  saveDraftToIDB: vi.fn(async () => {}),
  saveFile: vi.fn(async () => {}),
  publishFile: vi.fn(async () => {}),
  deleteCurrentDraft: vi.fn(async () => {}),
  applyEditorState: vi.fn(),
  _getDraftState: vi.fn(() => ({})),
  _setDraftState: vi.fn(),
}));
vi.mock('../../src/client/js/handlers/admin', () => ({
  handleSave: vi.fn(async () => {}),
  handlePublish: vi.fn(async () => ({ status: 'ok' })),
  handleDeleteDraft: vi.fn(async () => {}),
  handleFilenameConfirm: vi.fn(async () => {}),
  computePublishDisabled: mocks.mockComputePublishDisabled,
  buildContentItems: vi.fn(() => []),
}));
vi.mock('../../src/client/js/utils/sort', () => ({
  toSortDate: vi.fn(() => undefined),
  readSortMode: vi.fn(() => 'alpha'),
  writeSortMode: vi.fn(),
  createComparator: vi.fn(() => () => 0),
  SORT_MODES: {
    alpha: { icon: 'sort_by_alpha', label: 'Alphabetical' },
    'date-asc': { icon: 'hourglass_arrow_down', label: 'Oldest first' },
    'date-desc': { icon: 'hourglass_arrow_up', label: 'Newest first' },
  },
  SORT_ORDER: ['alpha', 'date-asc', 'date-desc'],
}));
vi.mock('../../src/client/js/drafts/storage', () => ({
  saveDraft: vi.fn(async () => {}),
  getDraftByFile: vi.fn(async () => null),
  loadDrafts: vi.fn(async () => []),
  loadDraft: vi.fn(async () => null),
  deleteDraft: vi.fn(async () => {}),
}));
vi.mock('../../src/client/js/utils/schema-utils', () => ({
  extractTabs: vi.fn(() => []),
  getFieldsForTab: vi.fn(() => []),
  resolveFieldType: vi.fn(() => ({ kind: 'string' })),
  createDefaultValue: vi.fn(() => ''),
  getByPath: vi.fn(),
  setByPath: vi.fn(),
}));
vi.mock('../../src/client/js/drafts/merge.svelte', () => ({
  getDrafts: mocks.mockGetDrafts,
  getOutdatedMap: mocks.mockGetOutdatedMap,
  mergeDrafts: vi.fn(async () => {}),
  refreshDrafts: vi.fn(async () => {}),
  resetDraftMerge: vi.fn(),
}));

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => resetMocks(mocks));

describe('Unsaved Changes', () => {
  it('shows dirty indicator for a file with unsaved changes', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Modified body',
      formData: { title: 'Hello World' },
      dirty: true,
    });

    const { container } = render(Admin);

    // The bullet indicator gets the --visible class when dirty
    const indicator = container.querySelector('.dirty-indicator--visible');
    expect(indicator).not.toBeNull();
  });

  it('does not show dirty indicator for a clean file', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Original body',
      formData: { title: 'Hello World' },
      dirty: false,
    });

    const { container } = render(Admin);

    // Indicator element exists but without --visible class
    const indicator = container.querySelector('.dirty-indicator--visible');
    expect(indicator).toBeNull();
  });

  it('shows dirty indicator for a dirty draft', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Changed',
      formData: { title: 'Hello World' },
      dirty: true,
      draftId: 'draft-1',
    });

    const { container } = render(Admin);

    const indicator = container.querySelector('.dirty-indicator--visible');
    expect(indicator).not.toBeNull();
  });

  it('renders editor area even when dirty state is true', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Some content',
      formData: { title: 'Hello World' },
      dirty: true,
    });

    const { container } = render(Admin);

    expect(container.querySelector('.editor-area')).not.toBeNull();
    // Toolbar is inside editor-area with class .toolbar (not .editor-toolbar)
    expect(
      container.querySelector('.editor-area .toolbar__title'),
    ).not.toBeNull();
  });

  it('maintains three-column layout when dirty and file open', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
      dirty: true,
    });

    const { container } = render(Admin);

    // Both sidebars + editor area = 3 columns
    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
    expect(container.querySelector('.editor-area')).not.toBeNull();
    expect(container.querySelector('.admin--file-open')).not.toBeNull();
  });
});

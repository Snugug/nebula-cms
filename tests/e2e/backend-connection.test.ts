import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { resetMocks, configureConnected } from './helpers/test-app';

//////////////////////////////
// Hoisted mocks — created before any import runs
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
// Module mocks — each vi.mock() is hoisted to run before imports
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

describe('Backend Connection', () => {
  it('renders BackendPicker when no backend is connected', () => {
    const { container } = render(Admin);

    expect(container.querySelector('.picker')).not.toBeNull();
    const heading = container.querySelector('.picker-title');
    expect(heading?.textContent).toBe('Connect to your project');
  });

  it('does not render sidebar when backend is not ready', () => {
    const { container } = render(Admin);

    expect(container.querySelector('.sidebar')).toBeNull();
  });

  it('shows both FSA and GitHub connection options', () => {
    const { container } = render(Admin);

    const options = container.querySelectorAll('.picker-option');
    expect(options.length).toBe(2);
    expect(options[0].querySelector('h3')?.textContent).toBe('Local Folder');
    expect(options[1].querySelector('h3')?.textContent).toBe(
      'GitHub Repository',
    );
  });

  it('renders collections sidebar after backend connects', () => {
    configureConnected(mocks, ['pages', 'posts']);
    mocks.mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin);

    expect(container.querySelector('.picker')).toBeNull();
    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(1);
  });

  it('shows collection names title-cased in sidebar', () => {
    configureConnected(mocks, ['posts', 'pages']);
    mocks.mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin);

    const links = container.querySelectorAll('.sidebar-link');
    const labels = Array.from(links).map((el) => el.textContent?.trim());
    expect(labels).toContain('Posts');
    expect(labels).toContain('Pages');
  });

  it('applies admin--connected CSS class when backend is ready', () => {
    configureConnected(mocks, []);
    mocks.mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin);

    expect(container.querySelector('.admin--connected')).not.toBeNull();
  });

  it('does not apply admin--connected CSS class when not ready', () => {
    const { container } = render(Admin);

    expect(container.querySelector('.admin--connected')).toBeNull();
  });
});

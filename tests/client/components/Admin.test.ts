import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Admin from '../../../src/client/Admin.svelte';

/**
 * Tests for the Admin orchestration component.
 * All JS module imports are mocked so that Svelte 5 runes never initialize
 * in the jsdom environment. Tests verify state-driven rendering: which child
 * components are mounted based on the backend ready state and current route.
 *
 * vi.hoisted is required because vi.mock factories are hoisted above all
 * variable declarations at the top of the file, so any mock fn referenced
 * inside a factory must itself be declared via vi.hoisted to avoid TDZ errors.
 */

//////////////////////////////
// Hoisted mock functions
//////////////////////////////

const {
  mockIsBackendReady,
  mockGetRoute,
  mockGetCollections,
  mockGetContentList,
  mockIsLoading,
  mockGetError,
  mockGetDrafts,
  mockGetOutdatedMap,
  mockGetActiveTab,
  mockGetEditorFile,
  mockGetSchema,
  mockCollectionHasDates,
  mockComputePublishDisabled,
} = vi.hoisted(() => ({
  mockIsBackendReady: vi.fn(() => false),
  mockGetRoute: vi.fn(() => ({ view: 'home' as const })),
  mockGetCollections: vi.fn(() => [] as string[]),
  mockGetContentList: vi.fn(
    () => [] as Array<{ filename: string; data: Record<string, unknown> }>,
  ),
  mockIsLoading: vi.fn(() => false),
  mockGetError: vi.fn(() => null as string | null),
  mockGetDrafts: vi.fn(
    () =>
      [] as Array<{
        id: string;
        isNew: boolean;
        filename: string | null;
        formData: Record<string, unknown>;
        collection: string;
      }>,
  ),
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

vi.mock('../../../src/client/js/state/state.svelte', () => ({
  isBackendReady: mockIsBackendReady,
  getCollections: mockGetCollections,
  getContentList: mockGetContentList,
  isLoading: mockIsLoading,
  getError: mockGetError,
  getDrafts: mockGetDrafts,
  getOutdatedMap: mockGetOutdatedMap,
  restoreBackend: vi.fn(() => Promise.resolve()),
  loadCollection: vi.fn(() => Promise.resolve()),
  reloadCollection: vi.fn(),
  disconnect: vi.fn(),
  refreshDrafts: vi.fn(() => Promise.resolve()),
  updateContentItem: vi.fn(),
  // BackendPicker (rendered when not ready) also imports these from state.svelte
  getBackendType: vi.fn(() => null),
  getPermissionState: vi.fn(() => 'denied'),
  pickDirectory: vi.fn(),
  requestPermission: vi.fn(),
  connectGitHub: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../src/client/js/state/router.svelte', () => ({
  initRouter: vi.fn(),
  getRoute: mockGetRoute,
  navigate: vi.fn(),
  registerDirtyChecker: vi.fn(),
}));

vi.mock('../../../src/client/js/state/schema.svelte', () => ({
  fetchSchema: vi.fn(() => Promise.resolve()),
  getSchema: mockGetSchema,
  clearSchema: vi.fn(),
  prefetchAllSchemas: vi.fn(() => Promise.resolve()),
  collectionHasDates: mockCollectionHasDates,
}));

vi.mock('../../../src/client/js/editor/editor.svelte', () => ({
  preloadFile: vi.fn(() => Promise.resolve()),
  loadFileBody: vi.fn(() => Promise.resolve()),
  clearEditor: vi.fn(),
  getActiveTab: mockGetActiveTab,
  getEditorFile: mockGetEditorFile,
  loadDraftById: vi.fn(() => Promise.resolve()),
  setFilename: vi.fn(),
  updateBody: vi.fn(),
}));

vi.mock('../../../src/client/js/handlers/admin', () => ({
  handleSave: vi.fn(() => Promise.resolve()),
  handlePublish: vi.fn(() => Promise.resolve({ status: 'ok' })),
  handleDeleteDraft: vi.fn(() => Promise.resolve()),
  handleFilenameConfirm: vi.fn(() => Promise.resolve()),
  computePublishDisabled: mockComputePublishDisabled,
}));

// sort is used by Admin.svelte to build contentItems
vi.mock('../../../src/client/js/utils/sort', () => ({
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

// Storage and drafts mocks that AdminSidebar/editor pull in transitively
vi.mock('../../../src/client/js/drafts/storage', () => ({
  saveDraft: vi.fn(() => Promise.resolve()),
  getDraftByFile: vi.fn(() => Promise.resolve(null)),
}));

// schema-utils used by EditorTabs and MetadataForm
vi.mock('../../../src/client/js/utils/schema-utils', () => ({
  extractTabs: vi.fn(() => []),
  getFieldsForTab: vi.fn(() => []),
  resolveFieldType: vi.fn(() => ({ kind: 'string' })),
  createDefaultValue: vi.fn(() => ''),
  getByPath: vi.fn(),
  setByPath: vi.fn(),
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

beforeEach(() => {
  // jsdom does not implement showModal/close — stub them
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  HTMLElement.prototype.showPopover = vi.fn();
  HTMLElement.prototype.hidePopover = vi.fn();
});

describe('Admin', () => {
  //////////////////////////////
  // Not ready — BackendPicker
  //////////////////////////////

  it('renders BackendPicker when backend is not ready', () => {
    mockIsBackendReady.mockReturnValue(false);
    mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    // BackendPicker renders a .picker element
    expect(container.querySelector('.picker')).not.toBeNull();
  });

  it('does not render sidebar navigation when backend is not ready', () => {
    mockIsBackendReady.mockReturnValue(false);
    mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.sidebar')).toBeNull();
  });

  //////////////////////////////
  // Ready, home view — collections sidebar only
  //////////////////////////////

  it('renders the collections sidebar when ready at home view', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({ view: 'home' });
    mockGetCollections.mockReturnValue(['posts', 'pages']);

    const { container } = render(Admin, { props: {} });

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(1);
  });

  it('shows collection items in the sidebar when backend is ready', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({ view: 'home' });
    mockGetCollections.mockReturnValue(['posts', 'pages']);

    const { container } = render(Admin, { props: {} });

    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('does not render the editor area when at home view', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({ view: 'home' });
    mockGetCollections.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).toBeNull();
  });

  //////////////////////////////
  // Ready, collection view — both sidebars
  //////////////////////////////

  it('renders both sidebars when a collection is selected', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mockGetCollections.mockReturnValue(['posts']);
    mockGetContentList.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
  });

  it('does not render the editor area in collection view', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mockGetCollections.mockReturnValue(['posts']);
    mockGetContentList.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).toBeNull();
  });

  //////////////////////////////
  // Ready, file view — editor area rendered
  //////////////////////////////

  it('renders the editor area when a file is open', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({
      view: 'file',
      collection: 'posts',
      slug: 'my-post',
    });
    mockGetCollections.mockReturnValue(['posts']);
    mockGetContentList.mockReturnValue([]);
    mockGetEditorFile.mockReturnValue({
      filename: 'my-post.md',
      dirty: false,
      saving: false,
      draftId: null,
      formData: {},
      body: '',
      bodyLoaded: false,
      isNewDraft: false,
    });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  it('renders both sidebars and the editor area in file view', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({
      view: 'file',
      collection: 'posts',
      slug: 'my-post',
    });
    mockGetCollections.mockReturnValue(['posts']);
    mockGetContentList.mockReturnValue([]);
    mockGetEditorFile.mockReturnValue({
      filename: 'my-post.md',
      dirty: false,
      saving: false,
      draftId: null,
      formData: {},
      body: '',
      bodyLoaded: false,
      isNewDraft: false,
    });

    const { container } = render(Admin, { props: {} });

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  //////////////////////////////
  // Ready, draft view — editor area rendered
  //////////////////////////////

  it('renders the editor area when a draft is open', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({
      view: 'draft',
      collection: 'posts',
      draftId: 'abc-123',
    });
    mockGetCollections.mockReturnValue(['posts']);
    mockGetContentList.mockReturnValue([]);
    mockGetEditorFile.mockReturnValue({
      filename: '',
      dirty: false,
      saving: false,
      draftId: 'abc-123',
      formData: {},
      body: '',
      bodyLoaded: true,
      isNewDraft: true,
    });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  //////////////////////////////
  // admin CSS class states
  //////////////////////////////

  it('adds admin--connected class when backend is ready', () => {
    mockIsBackendReady.mockReturnValue(true);
    mockGetRoute.mockReturnValue({ view: 'home' });
    mockGetCollections.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.admin--connected')).not.toBeNull();
  });

  it('does not add admin--connected class when backend is not ready', () => {
    mockIsBackendReady.mockReturnValue(false);
    mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.admin--connected')).toBeNull();
  });
});

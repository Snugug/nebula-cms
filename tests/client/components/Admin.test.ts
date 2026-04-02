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

/*
//////////////////////////////
// Hoisted mock functions
//////////////////////////////
*/

const {
  mockBackendReady,
  mockRoute,
  mockCollections,
  mockContentList,
  mockLoading,
  mockError,
  mockDrafts,
  mockOutdatedMap,
  mockActiveTab,
  mockEditorFile,
  mockSchema,
  mockCollectionHasDates,
  mockComputePublishDisabled,
} = vi.hoisted(() => ({
  mockBackendReady: vi.fn(() => false),
  mockRoute: vi.fn(() => ({ view: 'home' as const })),
  mockCollections: vi.fn(() => [] as string[]),
  mockContentList: vi.fn(
    () => [] as Array<{ filename: string; data: Record<string, unknown> }>,
  ),
  mockLoading: vi.fn(() => false),
  mockError: vi.fn(() => null as string | null),
  mockDrafts: vi.fn(
    () =>
      [] as Array<{
        id: string;
        isNew: boolean;
        filename: string | null;
        formData: Record<string, unknown>;
        collection: string;
      }>,
  ),
  mockOutdatedMap: vi.fn(() => ({}) as Record<string, boolean>),
  mockActiveTab: vi.fn(() => 'metadata'),
  mockEditorFile: vi.fn(() => null),
  mockSchema: vi.fn(() => null),
  mockCollectionHasDates: vi.fn(() => false),
  mockComputePublishDisabled: vi.fn(() => false),
}));

/*
//////////////////////////////
// Module mocks
//////////////////////////////
*/

vi.mock('../../../src/client/js/state/state.svelte', () => ({
  backend: {
    get type() {
      return null;
    },
    get ready() {
      return mockBackendReady();
    },
    get permission() {
      return 'denied';
    },
  },
  content: {
    get list() {
      return mockContentList();
    },
    get loading() {
      return mockLoading();
    },
    get error() {
      return mockError();
    },
  },
  get collections() {
    return mockCollections();
  },
  drafts: {
    get all() {
      return mockDrafts();
    },
    get outdated() {
      return mockOutdatedMap();
    },
  },
  storageClient: {},
  restoreBackend: vi.fn(() => Promise.resolve()),
  loadCollection: vi.fn(() => Promise.resolve()),
  reloadCollection: vi.fn(),
  disconnect: vi.fn(),
  refreshDrafts: vi.fn(() => Promise.resolve()),
  updateContentItem: vi.fn(),
  pickDirectory: vi.fn(),
  requestPermission: vi.fn(),
  connectGitHub: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../src/client/js/state/router.svelte', () => ({
  initRouter: vi.fn(),
  nav: {
    get route() {
      return mockRoute();
    },
  },
  navigate: vi.fn(),
  registerDirtyChecker: vi.fn(),
  adminPath: vi.fn((...segments) =>
    segments.length === 0 ? '/admin' : '/admin/' + segments.join('/'),
  ),
}));

vi.mock('../../../src/client/js/state/schema.svelte', () => ({
  fetchSchema: vi.fn(() => Promise.resolve()),
  schema: {
    get active() {
      return mockSchema();
    },
  },
  clearSchema: vi.fn(),
  prefetchAllSchemas: vi.fn(() => Promise.resolve()),
  collectionHasDates: mockCollectionHasDates,
  getCollectionTitle: vi.fn(() => null),
  getCollectionDescription: vi.fn(() => null),
}));

vi.mock('../../../src/client/js/editor/editor.svelte', () => ({
  preloadFile: vi.fn(() => Promise.resolve()),
  loadFileBody: vi.fn(() => Promise.resolve()),
  clearEditor: vi.fn(),
  editor: {
    get tab() {
      return mockActiveTab();
    },
    get data() {
      return {};
    },
    get originalFilename() {
      return '';
    },
  },
  getEditorFile: mockEditorFile,
  loadDraftById: vi.fn(() => Promise.resolve()),
  setFilename: vi.fn(),
  updateBody: vi.fn(),
}));

vi.mock('../../../src/client/js/handlers/admin', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/client/js/handlers/admin')
    >();
  return {
    ...actual,
    handleSave: vi.fn(() => Promise.resolve()),
    handlePublish: vi.fn(() => Promise.resolve({ status: 'ok' })),
    handleDeleteDraft: vi.fn(() => Promise.resolve()),
    handleFilenameConfirm: vi.fn(() => Promise.resolve()),
    computePublishDisabled: mockComputePublishDisabled,
  };
});

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

// Theme state mock — prevents localStorage/matchMedia access in jsdom
vi.mock('../../../src/client/js/state/theme.svelte', () => ({
  initTheme: vi.fn(() => () => {}),
  cycleTheme: vi.fn(),
  theme: { resolved: 'dark', icon: 'brightness_auto', label: 'Auto' },
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
  /*
  //////////////////////////////
  // Not ready — BackendPicker
  //////////////////////////////
  */

  it('renders BackendPicker when backend is not ready', () => {
    mockBackendReady.mockReturnValue(false);
    mockRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    // BackendPicker renders a .picker element
    expect(container.querySelector('.picker')).not.toBeNull();
  });

  it('does not render sidebar navigation when backend is not ready', () => {
    mockBackendReady.mockReturnValue(false);
    mockRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.sidebar')).toBeNull();
  });

  /*
  //////////////////////////////
  // Ready, home view — collections sidebar only
  //////////////////////////////
  */

  it('renders the collections sidebar when ready at home view', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({ view: 'home' });
    mockCollections.mockReturnValue(['posts', 'pages']);

    const { container } = render(Admin, { props: {} });

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(1);
  });

  it('shows collection items in the sidebar when backend is ready', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({ view: 'home' });
    mockCollections.mockReturnValue(['posts', 'pages']);

    const { container } = render(Admin, { props: {} });

    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('does not render the editor area when at home view', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({ view: 'home' });
    mockCollections.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).toBeNull();
  });

  /*
  //////////////////////////////
  // Ready, collection view — both sidebars
  //////////////////////////////
  */

  it('renders both sidebars when a collection is selected', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mockCollections.mockReturnValue(['posts']);
    mockContentList.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
  });

  it('does not render the editor area in collection view', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mockCollections.mockReturnValue(['posts']);
    mockContentList.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.editor-area')).toBeNull();
  });

  /*
  //////////////////////////////
  // Ready, file view — editor area rendered
  //////////////////////////////
  */

  it('renders the editor area when a file is open', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({
      view: 'file',
      collection: 'posts',
      slug: 'my-post',
    });
    mockCollections.mockReturnValue(['posts']);
    mockContentList.mockReturnValue([]);
    mockEditorFile.mockReturnValue({
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
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({
      view: 'file',
      collection: 'posts',
      slug: 'my-post',
    });
    mockCollections.mockReturnValue(['posts']);
    mockContentList.mockReturnValue([]);
    mockEditorFile.mockReturnValue({
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

  /*
  //////////////////////////////
  // Ready, draft view — editor area rendered
  //////////////////////////////
  */

  it('renders the editor area when a draft is open', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({
      view: 'draft',
      collection: 'posts',
      draftId: 'abc-123',
    });
    mockCollections.mockReturnValue(['posts']);
    mockContentList.mockReturnValue([]);
    mockEditorFile.mockReturnValue({
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

  /*
  //////////////////////////////
  // admin CSS class states
  //////////////////////////////
  */

  it('adds admin--connected class when backend is ready', () => {
    mockBackendReady.mockReturnValue(true);
    mockRoute.mockReturnValue({ view: 'home' });
    mockCollections.mockReturnValue([]);

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.admin--connected')).not.toBeNull();
  });

  it('does not add admin--connected class when backend is not ready', () => {
    mockBackendReady.mockReturnValue(false);
    mockRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin, { props: {} });

    expect(container.querySelector('.admin--connected')).toBeNull();
  });
});

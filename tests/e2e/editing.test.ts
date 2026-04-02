import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { resetMocks, configureFileOpen } from './helpers/test-app';

//////////////////////////////
// Hoisted mocks
//////////////////////////////

const mocks = vi.hoisted(() => ({
  mockBackendReady: vi.fn(() => false),
  mockRoute: vi.fn(() => ({ view: 'home' as const })),
  mockCollections: vi.fn(() => [] as string[]),
  mockContentList: vi.fn(
    () => [] as Array<{ filename: string; data: Record<string, unknown> }>,
  ),
  mockLoading: vi.fn(() => false),
  mockError: vi.fn(() => null as string | null),
  mockDrafts: vi.fn(() => []),
  mockOutdatedMap: vi.fn(() => ({}) as Record<string, boolean>),
  mockActiveTab: vi.fn(() => 'metadata'),
  mockGetEditorFile: vi.fn(() => null),
  mockSchema: vi.fn(() => null),
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
  backend: {
    get type() {
      return null;
    },
    get ready() {
      return mocks.mockBackendReady();
    },
    get permission() {
      return 'denied';
    },
  },
  content: {
    get list() {
      return mocks.mockContentList();
    },
    get loading() {
      return mocks.mockLoading();
    },
    get error() {
      return mocks.mockError();
    },
  },
  get collections() {
    return mocks.mockCollections();
  },
  storageClient: null,
  drafts: {
    get all() {
      return mocks.mockDrafts();
    },
    get outdated() {
      return mocks.mockOutdatedMap();
    },
  },
  restoreBackend: vi.fn(async () => {}),
  loadCollection: vi.fn(),
  reloadCollection: vi.fn(),
  disconnect: vi.fn(),
  refreshDrafts: vi.fn(async () => {}),
  updateContentItem: vi.fn(),
  pickDirectory: vi.fn(),
  requestPermission: vi.fn(),
  connectGitHub: vi.fn(async () => {}),
}));
vi.mock('../../src/client/js/state/router.svelte', () => ({
  initRouter: vi.fn(),
  nav: {
    get route() {
      return mocks.mockRoute();
    },
  },
  navigate: vi.fn(),
  registerDirtyChecker: vi.fn(),
  adminPath: vi.fn((...segments) =>
    segments.length === 0 ? '/admin' : '/admin/' + segments.join('/'),
  ),
}));
vi.mock('../../src/client/js/state/schema.svelte', () => ({
  fetchSchema: vi.fn(async () => {}),
  schema: {
    get active() {
      return mocks.mockSchema();
    },
  },
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
  editor: {
    get tab() {
      return mocks.mockActiveTab();
    },
    get data() {
      return {};
    },
    get originalFilename() {
      return '';
    },
  },
  setActiveTab: vi.fn(),
  getEditorFile: mocks.mockGetEditorFile,
  loadDraftById: vi.fn(async () => {}),
  setFilename: vi.fn(),
  updateBody: vi.fn(),
  updateFormField: vi.fn(),
  saveDraftToIDB: vi.fn(async () => {}),
  saveFile: vi.fn(async () => {}),
  publishFile: vi.fn(async () => {}),
  deleteCurrentDraft: vi.fn(async () => {}),
  applyEditorState: vi.fn(),
  _getDraftState: vi.fn(() => ({})),
  _setDraftState: vi.fn(),
  changeFileFormat: vi.fn(),
  setDefaultFormat: vi.fn(),
}));
vi.mock('../../src/client/js/handlers/admin', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/client/js/handlers/admin')>();
  return {
    ...actual,
    handleSave: vi.fn(async () => {}),
    handlePublish: vi.fn(async () => ({ status: 'ok' })),
    handleDeleteDraft: vi.fn(async () => {}),
    handleFilenameConfirm: vi.fn(async () => {}),
    computePublishDisabled: mocks.mockComputePublishDisabled,
    // Override buildCollectionItems to read from mockCollections — the
    // module-level getter for `collections` is not a live binding in
    // vitest's browser mode, so the real function would see an empty array.
    buildCollectionItems: () =>
      mocks.mockCollections().map((name: string) => ({
        label: name.charAt(0).toUpperCase() + name.slice(1),
        href: '/admin/' + name,
      })),
  };
});
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
  isReadOnly: vi.fn(() => false),
  isNullable: vi.fn(() => false),
  getProperties: vi.fn(
    (schema: Record<string, unknown>) => schema['properties'],
  ),
  getRequiredFields: vi.fn((schema: Record<string, unknown>) =>
    Array.isArray(schema['required']) ? schema['required'] : [],
  ),
  getLabel: vi.fn((schema: Record<string, unknown>, name: string) =>
    typeof schema['title'] === 'string' ? schema['title'] : name,
  ),
}));
vi.mock('../../src/client/js/drafts/merge.svelte', () => ({
  drafts: {
    get all() {
      return mocks.mockDrafts();
    },
    get outdated() {
      return mocks.mockOutdatedMap();
    },
  },
  mergeDrafts: vi.fn(async () => {}),
  refreshDrafts: vi.fn(async () => {}),
  resetDraftMerge: vi.fn(),
}));

vi.mock('../../src/client/js/state/theme.svelte', () => ({
  initTheme: vi.fn(() => () => {}),
  cycleTheme: vi.fn(),
  theme: { resolved: 'dark', icon: 'brightness_auto', label: 'Auto' },
}));
vi.mock('../../src/client/js/state/dialogs.svelte', () => ({
  dialogs: {
    get filenameOpen() {
      return false;
    },
    get deleteOpen() {
      return false;
    },
  },
  showFilenameDialog: vi.fn(),
  hideFilenameDialog: vi.fn(),
  showDeleteDialog: vi.fn(),
  hideDeleteDialog: vi.fn(),
}));

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => resetMocks(mocks));

describe('Editing', () => {
  it('renders the editor toolbar with file title', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Some content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    // EditorToolbar renders a .toolbar__title inside .editor-area
    const title = container.querySelector('.editor-area .toolbar__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('Hello World');
  });

  it('shows save and publish buttons in the editor toolbar', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content here',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    const saveBtn = container.querySelector('.editor-area .btn--save-outline');
    const publishBtn = container.querySelector('.editor-area .btn--primary');
    expect(saveBtn).not.toBeNull();
    expect(publishBtn).not.toBeNull();
  });

  it('shows dirty indicator when file has unsaved changes', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Modified content',
      formData: { title: 'Hello World' },
      dirty: true,
    });

    const { container } = render(Admin);

    // The bullet indicator gets the --visible class when dirty
    const indicator = container.querySelector('.dirty-indicator--visible');
    expect(indicator).not.toBeNull();
  });

  it('does not show dirty indicator for clean files', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content here',
      formData: { title: 'Hello World' },
      dirty: false,
    });

    const { container } = render(Admin);

    // The indicator element exists but without --visible class
    const indicator = container.querySelector('.dirty-indicator--visible');
    expect(indicator).toBeNull();
  });

  it('renders editor tabs including metadata and body', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    const tabs = container.querySelectorAll('.tabs__tab');
    const tabLabels = Array.from(tabs).map((t) => t.textContent?.trim());
    expect(tabLabels).toContain('Metadata');
    expect(tabLabels).toContain('Body');
  });

  it('shows metadata tab as active by default', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    const activeTab = container.querySelector('.tabs__tab--active');
    expect(activeTab?.textContent?.trim()).toBe('Metadata');
  });

  it('renders editor pane when body tab is active', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });
    mocks.mockActiveTab.mockReturnValue('body');

    const { container } = render(Admin);

    expect(container.querySelector('.editor-wrapper')).not.toBeNull();
  });

  it('falls back to "Untitled Draft" when title is missing', () => {
    configureFileOpen(mocks, 'posts', 'new-draft', {
      filename: '',
      body: '',
      formData: {},
      isNewDraft: true,
      draftId: 'abc-123',
    });

    const { container } = render(Admin);

    const title = container.querySelector('.editor-area .toolbar__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('Untitled Draft');
  });
});

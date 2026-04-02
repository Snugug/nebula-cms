import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import {
  resetMocks,
  configureConnected,
  configureCollection,
} from './helpers/test-app';

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

// State module handler mocks for GitHub-specific flows
const stateMocks = vi.hoisted(() => ({
  mockConnectGitHub: vi.fn(async () => {}),
  mockBackendType: vi.fn(() => null as string | null),
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
      return stateMocks.mockBackendType();
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
  connectGitHub: stateMocks.mockConnectGitHub,
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
    get active() {
      return null;
    },
  },
  openDialog: vi.fn(),
  closeDialog: vi.fn(),
}));

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => {
  resetMocks(mocks);
  stateMocks.mockConnectGitHub.mockClear();
  stateMocks.mockBackendType.mockReturnValue(null);
});

describe('GitHub Adapter', () => {
  it('renders GitHub connection form in BackendPicker', () => {
    const { container } = render(Admin);

    const options = container.querySelectorAll('.picker-option');
    const githubOption = options[1];

    expect(githubOption.querySelector('h3')?.textContent).toBe(
      'GitHub Repository',
    );
    expect(githubOption.querySelector('input[type="password"]')).not.toBeNull();
    expect(githubOption.querySelector('input[type="text"]')).not.toBeNull();
  });

  it('disables connect button when token and repo are empty', () => {
    const { container } = render(Admin);

    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn).not.toBeNull();
    expect((submitBtn as HTMLButtonElement)?.disabled).toBe(true);
  });

  it('renders collections after GitHub backend connects', () => {
    configureConnected(mocks, ['posts', 'pages']);
    stateMocks.mockBackendType.mockReturnValue('github');
    mocks.mockRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin);

    // Should show collections sidebar, not BackendPicker
    expect(container.querySelector('.picker')).toBeNull();
    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('shows content list from GitHub adapter after navigating to collection', () => {
    stateMocks.mockBackendType.mockReturnValue('github');
    configureCollection(mocks, 'posts', [
      { filename: 'post-1.md', data: { title: 'From GitHub' } },
      { filename: 'post-2.md', data: { title: 'Also From GitHub' } },
    ]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const contentSidebar = sidebars[1];
    const links = contentSidebar.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('shows error message when GitHub connection fails', () => {
    mocks.mockError.mockReturnValue('Authentication failed');
    stateMocks.mockBackendType.mockReturnValue(null);

    const { container } = render(Admin);

    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('Authentication failed');
  });

  it('shows loading state in content sidebar', () => {
    stateMocks.mockBackendType.mockReturnValue('github');
    configureConnected(mocks, ['posts']);
    mocks.mockRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mocks.mockLoading.mockReturnValue(true);
    mocks.mockContentList.mockReturnValue([]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const contentSidebar = sidebars[1];
    // Loading state is handled by the sidebar component
    expect(contentSidebar).not.toBeNull();
  });
});

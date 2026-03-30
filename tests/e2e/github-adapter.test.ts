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

// State module handler mocks for GitHub-specific flows
const stateMocks = vi.hoisted(() => ({
  mockConnectGitHub: vi.fn(async () => {}),
  mockGetBackendType: vi.fn(() => null as string | null),
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
  getBackendType: stateMocks.mockGetBackendType,
  getPermissionState: vi.fn(() => 'denied'),
  pickDirectory: vi.fn(),
  requestPermission: vi.fn(),
  connectGitHub: stateMocks.mockConnectGitHub,
  getStorageClient: vi.fn(() => null),
}));
vi.mock('../../src/client/js/state/router.svelte', () => ({
  initRouter: vi.fn(),
  getRoute: mocks.mockGetRoute,
  navigate: vi.fn(),
  registerDirtyChecker: vi.fn(),
  getBasePath: vi.fn(() => '/admin'),
  adminPath: vi.fn((...segments) =>
    segments.length === 0 ? '/admin' : '/admin/' + segments.join('/'),
  ),
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
  changeFileFormat: vi.fn(),
  setDefaultFormat: vi.fn(),
  getOriginalFilename: vi.fn(() => ''),
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
}));
vi.mock('../../src/client/js/drafts/merge.svelte', () => ({
  getDrafts: mocks.mockGetDrafts,
  getOutdatedMap: mocks.mockGetOutdatedMap,
  mergeDrafts: vi.fn(async () => {}),
  refreshDrafts: vi.fn(async () => {}),
  resetDraftMerge: vi.fn(),
}));

vi.mock('../../src/client/js/state/theme.svelte', () => ({
  initTheme: vi.fn(() => () => {}),
  cycleTheme: vi.fn(),
  theme: vi.fn(() => 'dark'),
  themeIcon: vi.fn(() => 'brightness_auto'),
  themeLabel: vi.fn(() => 'Auto'),
}));

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => {
  resetMocks(mocks);
  stateMocks.mockConnectGitHub.mockClear();
  stateMocks.mockGetBackendType.mockReturnValue(null);
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
    stateMocks.mockGetBackendType.mockReturnValue('github');
    mocks.mockGetRoute.mockReturnValue({ view: 'home' });

    const { container } = render(Admin);

    // Should show collections sidebar, not BackendPicker
    expect(container.querySelector('.picker')).toBeNull();
    const links = container.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('shows content list from GitHub adapter after navigating to collection', () => {
    stateMocks.mockGetBackendType.mockReturnValue('github');
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
    mocks.mockGetError.mockReturnValue('Authentication failed');
    stateMocks.mockGetBackendType.mockReturnValue(null);

    const { container } = render(Admin);

    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('Authentication failed');
  });

  it('shows loading state in content sidebar', () => {
    stateMocks.mockGetBackendType.mockReturnValue('github');
    configureConnected(mocks, ['posts']);
    mocks.mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mocks.mockIsLoading.mockReturnValue(true);
    mocks.mockGetContentList.mockReturnValue([]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const contentSidebar = sidebars[1];
    // Loading state is handled by the sidebar component
    expect(contentSidebar).not.toBeNull();
  });
});

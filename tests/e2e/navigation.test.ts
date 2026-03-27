import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import {
  resetMocks,
  configureConnected,
  configureCollection,
  configureFileOpen,
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

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => resetMocks(mocks));

describe('Navigation', () => {
  it('shows both sidebars when a collection is selected', () => {
    configureCollection(mocks, 'posts');

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
  });

  it('does not render editor area in collection view', () => {
    configureCollection(mocks, 'posts');

    const { container } = render(Admin);

    expect(container.querySelector('.editor-area')).toBeNull();
  });

  it('shows content items in the collection sidebar', () => {
    configureCollection(mocks, 'posts', [
      { filename: 'hello-world.md', data: { title: 'Hello World' } },
      { filename: 'second-post.md', data: { title: 'Second Post' } },
    ]);

    const { container } = render(Admin);

    // Second sidebar has the content items
    const sidebars = container.querySelectorAll('.sidebar');
    const contentSidebar = sidebars[1];
    const links = contentSidebar.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(2);
  });

  it('renders content item titles from frontmatter data', () => {
    configureCollection(mocks, 'posts', [
      { filename: 'hello.md', data: { title: 'Hello World' } },
      { filename: 'bye.md', data: { title: 'Goodbye' } },
    ]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const links = sidebars[1].querySelectorAll('.sidebar-link');
    const labels = Array.from(links).map((el) =>
      el.querySelector('.item-label-text')?.textContent?.trim(),
    );
    expect(labels).toContain('Hello World');
    expect(labels).toContain('Goodbye');
  });

  it('falls back to filename when title is missing', () => {
    configureCollection(mocks, 'posts', [
      { filename: 'no-title.md', data: {} },
    ]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const links = sidebars[1].querySelectorAll('.sidebar-link');
    const label = links[0]
      .querySelector('.item-label-text')
      ?.textContent?.trim();
    expect(label).toBe('no-title.md');
  });

  it('renders editor area when a file is open', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Hello content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  it('applies admin--file-open class when editing a file', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Hello content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    expect(container.querySelector('.admin--file-open')).not.toBeNull();
  });

  it('shows both sidebars and editor area in file view', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: '',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    expect(sidebars.length).toBe(2);
    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  it('highlights active collection in the sidebar via aria-current', () => {
    configureCollection(mocks, 'posts');
    mocks.mockGetCollections.mockReturnValue(['pages', 'posts']);

    const { container } = render(Admin);

    // Active collection is marked with aria-current="page"
    const activeLink = container.querySelector(
      '.sidebar-link[aria-current="page"]',
    );
    expect(activeLink).not.toBeNull();
  });
});

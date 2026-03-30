import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import {
  resetMocks,
  configureConnected,
  configureFileOpen,
  configureDraftOpen,
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

// Hoisted handler mocks for assertions
const handlers = vi.hoisted(() => ({
  mockHandleSave: vi.fn(async () => {}),
  mockHandleDeleteDraft: vi.fn(async () => {}),
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
    handleSave: handlers.mockHandleSave,
    handlePublish: vi.fn(async () => ({ status: 'ok' })),
    handleDeleteDraft: handlers.mockHandleDeleteDraft,
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
  theme: { resolved: 'dark', icon: 'brightness_auto', label: 'Auto' },
}));

import Admin from '../../src/client/Admin.svelte';

afterEach(() => cleanup());
beforeEach(() => {
  resetMocks(mocks);
  handlers.mockHandleSave.mockClear();
  handlers.mockHandleDeleteDraft.mockClear();
});

describe('Draft Lifecycle', () => {
  it('renders editor for a new draft', () => {
    configureDraftOpen(mocks, 'posts', 'draft-abc', {
      body: '',
      formData: {},
    });

    const { container } = render(Admin);

    expect(container.querySelector('.editor-area')).not.toBeNull();
  });

  it('shows "Untitled Draft" for drafts without a title', () => {
    configureDraftOpen(mocks, 'posts', 'draft-abc', {
      body: '',
      formData: {},
    });

    const { container } = render(Admin);

    const title = container.querySelector('.editor-area .toolbar__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('Untitled Draft');
  });

  it('shows draft title when formData has a title', () => {
    configureDraftOpen(mocks, 'posts', 'draft-abc', {
      body: 'Draft body',
      formData: { title: 'My Draft Title' },
    });

    const { container } = render(Admin);

    const title = container.querySelector('.editor-area .toolbar__title');
    expect(title).not.toBeNull();
    expect(title?.textContent).toContain('My Draft Title');
  });

  it('calls handleSave when save button is clicked', async () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Modified',
      formData: { title: 'Hello World' },
      dirty: true,
    });

    const { container } = render(Admin);

    const saveBtn = container.querySelector('.editor-area .btn--save');
    expect(saveBtn).not.toBeNull();

    if (saveBtn) await fireEvent.click(saveBtn);
    expect(handlers.mockHandleSave).toHaveBeenCalled();
  });

  it('shows draft chip for items with draft status', () => {
    configureConnected(mocks, ['posts']);
    mocks.mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mocks.mockGetContentList.mockReturnValue([
      { filename: 'hello.md', data: { title: 'Hello' } },
    ]);
    mocks.mockGetDrafts.mockReturnValue([
      {
        id: 'draft-1',
        isNew: false,
        filename: 'hello.md',
        formData: { title: 'Hello' },
        collection: 'posts',
      },
    ]);

    const { container } = render(Admin);

    // DraftChip renders a .chip element with lowercase text
    const chip = container.querySelector('.chip');
    expect(chip).not.toBeNull();
    expect(chip?.textContent?.trim()).toBe('draft');
  });

  it('shows outdated chip when draft is outdated', () => {
    configureConnected(mocks, ['posts']);
    mocks.mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mocks.mockGetContentList.mockReturnValue([
      { filename: 'hello.md', data: { title: 'Hello' } },
    ]);
    mocks.mockGetDrafts.mockReturnValue([
      {
        id: 'draft-1',
        isNew: false,
        filename: 'hello.md',
        formData: { title: 'Hello' },
        collection: 'posts',
      },
    ]);
    mocks.mockGetOutdatedMap.mockReturnValue({ 'draft-1': true });

    const { container } = render(Admin);

    // Both draft and outdated chips render; use the variant-specific class
    const outdatedChip = container.querySelector('.chip--outdated');
    expect(outdatedChip).not.toBeNull();
    expect(outdatedChip?.textContent?.trim()).toBe('outdated');
  });

  it('shows new draft items in the sidebar', () => {
    configureConnected(mocks, ['posts']);
    mocks.mockGetRoute.mockReturnValue({
      view: 'collection',
      collection: 'posts',
    });
    mocks.mockGetContentList.mockReturnValue([]);
    mocks.mockGetDrafts.mockReturnValue([
      {
        id: 'new-draft-1',
        isNew: true,
        filename: null,
        formData: { title: 'Brand New Draft' },
        collection: 'posts',
      },
    ]);

    const { container } = render(Admin);

    const sidebars = container.querySelectorAll('.sidebar');
    const contentSidebar = sidebars[1];
    const links = contentSidebar.querySelectorAll('.sidebar-link');
    expect(links.length).toBe(1);
    expect(links[0].textContent).toContain('Brand New Draft');
  });
});

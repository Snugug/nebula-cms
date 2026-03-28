import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import {
  resetMocks,
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

// Handler mocks for publish assertions
const handlers = vi.hoisted(() => ({
  mockHandlePublish: vi.fn(async () => ({ status: 'ok' as const })),
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
  changeFileFormat: vi.fn(),
  setDefaultFormat: vi.fn(),
  getOriginalFilename: vi.fn(() => ''),
}));
vi.mock('../../src/client/js/handlers/admin', () => ({
  handleSave: vi.fn(async () => {}),
  handlePublish: handlers.mockHandlePublish,
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
beforeEach(() => {
  resetMocks(mocks);
  handlers.mockHandlePublish.mockClear();
  handlers.mockHandlePublish.mockResolvedValue({ status: 'ok' });
});

describe('Publishing', () => {
  it('calls handlePublish when publish button is clicked', async () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });

    const { container } = render(Admin);

    const publishBtn = container.querySelector('.editor-area .btn--publish');
    expect(publishBtn).not.toBeNull();

    if (publishBtn) await fireEvent.click(publishBtn);
    expect(handlers.mockHandlePublish).toHaveBeenCalled();
  });

  it('shows filename dialog when publish returns needs-filename', async () => {
    configureDraftOpen(mocks, 'posts', 'draft-abc', {
      body: 'New content',
      formData: { title: 'New Post' },
    });
    handlers.mockHandlePublish.mockResolvedValue({ status: 'needs-filename' });

    const { container } = render(Admin);

    const publishBtn = container.querySelector('.editor-area .btn--publish');

    if (publishBtn) await fireEvent.click(publishBtn);

    // FilenameDialog renders a <dialog> element
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toBeNull();
  });

  it('disables publish button when computePublishDisabled returns true', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });
    mocks.mockComputePublishDisabled.mockReturnValue(true);

    const { container } = render(Admin);

    const publishBtn = container.querySelector(
      '.editor-area .btn--publish',
    ) as HTMLButtonElement;
    expect(publishBtn).not.toBeNull();
    expect(publishBtn?.disabled).toBe(true);
  });

  it('enables publish button when computePublishDisabled returns false', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
    });
    mocks.mockComputePublishDisabled.mockReturnValue(false);

    const { container } = render(Admin);

    const publishBtn = container.querySelector(
      '.editor-area .btn--publish',
    ) as HTMLButtonElement;
    expect(publishBtn?.disabled).toBe(false);
  });

  it('shows delete draft button when editing a draft', () => {
    configureFileOpen(mocks, 'posts', 'hello-world', {
      filename: 'hello-world.md',
      body: 'Content',
      formData: { title: 'Hello World' },
      draftId: 'draft-1',
    });

    const { container } = render(Admin);

    const deleteBtn = container.querySelector('.editor-area .btn--delete');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent?.trim()).toContain('Delete Draft');
  });
});

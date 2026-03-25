import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// SharedWorker / Worker stubs — must be established BEFORE any module import
//
// state.svelte.ts calls `new SharedWorker(...)` at the module top level.
// vi.hoisted() runs before any import in this file, so the globals are set
// before Vitest resolves the static imports below. Without hoisting,
// vi.stubGlobal() would run after the module's top-level code and the
// constructor call would throw ReferenceError.
//////////////////////////////

const { FakeSharedWorker, FakeWorker } = vi.hoisted(() => {
  /** Minimal MessagePort stub that satisfies the StorageClient constructor. */
  class FakeMessagePort {
    addEventListener = vi.fn();
    postMessage = vi.fn();
    start = vi.fn();
  }

  /** Minimal SharedWorker stub used in place of the real browser API. */
  class FakeSharedWorker {
    port = new FakeMessagePort();
  }

  /** Minimal Worker stub used in place of the real browser API. */
  class FakeWorker {
    addEventListener = vi.fn();
    postMessage = vi.fn();
    terminate = vi.fn();
  }

  vi.stubGlobal('SharedWorker', FakeSharedWorker);
  vi.stubGlobal('Worker', FakeWorker);

  return { FakeSharedWorker, FakeWorker };
});

//////////////////////////////
// Module-level mocks
//
// state.svelte.ts instantiates SharedWorker and StorageClient at the top
// level when the module is first imported. All dependencies that trigger
// side-effects must be mocked via vi.mock() BEFORE any import of the module
// under test. vi.mock() calls are hoisted by Vitest automatically.
//////////////////////////////

vi.mock('virtual:collections', () => ({
  default: {
    posts: 'https://fake.test/posts.schema.json',
    products: 'https://fake.test/products.schema.json',
    articles: 'https://fake.test/articles.schema.json',
  },
}));

vi.mock('../../../../src/client/js/storage/storage', () => ({
  loadBackend: vi.fn(async () => null),
  saveBackend: vi.fn(async () => undefined),
  clearBackend: vi.fn(async () => undefined),
}));

vi.mock('../../../../src/client/js/storage/client', () => {
  /** Stub StorageClient whose methods all resolve immediately. */
  class StorageClient {
    constructor(_port: MessagePort) {}

    /** @return {Promise<void>} */
    async init(_config: unknown): Promise<void> {}

    /** @return {Promise<void>} */
    async teardown(): Promise<void> {}

    /** @return {Promise<never[]>} */
    async listFiles(_collection: string): Promise<never[]> {
      return [];
    }

    /** @return {Promise<string>} */
    async readFile(_collection: string, _filename: string): Promise<string> {
      return '';
    }

    /** @return {Promise<void>} */
    async writeFile(
      _collection: string,
      _filename: string,
      _content: string,
    ): Promise<void> {}

    /** @return {Promise<void>} */
    async writeFiles(_files: unknown[]): Promise<void> {}
  }
  return { StorageClient };
});

vi.mock('../../../../src/client/js/state/router.svelte', () => ({
  getRoute: vi.fn(() => ({ view: 'home' as const })),
  navigate: vi.fn(),
}));

vi.mock('../../../../src/client/js/drafts/merge.svelte', () => ({
  getDrafts: vi.fn(() => []),
  getOutdatedMap: vi.fn(() => ({})),
  mergeDrafts: vi.fn(async () => undefined),
  refreshDrafts: vi.fn(async () => undefined),
  resetDraftMerge: vi.fn(),
}));

//////////////////////////////
// Dynamic imports after stubs are in place
//////////////////////////////

import {
  getCollections,
  isBackendReady,
  getBackendType,
  getPermissionState,
  getContentList,
  getError,
  isLoading,
  disconnect,
  updateContentItem,
} from '../../../../src/client/js/state/state.svelte';

import { clearBackend } from '../../../../src/client/js/storage/storage';
import { navigate } from '../../../../src/client/js/state/router.svelte';
import { resetDraftMerge } from '../../../../src/client/js/drafts/merge.svelte';

//////////////////////////////
// getCollections
//////////////////////////////

describe('getCollections', () => {
  it('returns a sorted list of collection names from virtual:collections', () => {
    const collections = getCollections();
    expect(collections).toEqual(['articles', 'posts', 'products']);
  });

  it('returns a new reference on each call but with the same contents', () => {
    // The module holds a const array — verify it is stable
    expect(getCollections()).toEqual(getCollections());
  });
});

//////////////////////////////
// Initial reactive state
//////////////////////////////

describe('initial state', () => {
  it('isBackendReady returns false before any backend is connected', () => {
    expect(isBackendReady()).toBe(false);
  });

  it('getBackendType returns null before any backend is connected', () => {
    expect(getBackendType()).toBeNull();
  });

  it('getPermissionState returns "denied" initially', () => {
    expect(getPermissionState()).toBe('denied');
  });

  it('getContentList returns an empty array initially', () => {
    expect(getContentList()).toEqual([]);
  });

  it('getError returns null initially', () => {
    expect(getError()).toBeNull();
  });

  it('isLoading returns false initially', () => {
    expect(isLoading()).toBe(false);
  });
});

//////////////////////////////
// disconnect
//////////////////////////////

describe('disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls clearBackend to remove stored credentials', async () => {
    await disconnect();
    expect(clearBackend).toHaveBeenCalled();
  });

  it('calls resetDraftMerge', async () => {
    await disconnect();
    expect(resetDraftMerge).toHaveBeenCalled();
  });

  it('navigates to /admin after disconnecting', async () => {
    await disconnect();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('resets isBackendReady to false', async () => {
    await disconnect();
    expect(isBackendReady()).toBe(false);
  });

  it('resets getBackendType to null', async () => {
    await disconnect();
    expect(getBackendType()).toBeNull();
  });

  it('resets getPermissionState to "denied"', async () => {
    await disconnect();
    expect(getPermissionState()).toBe('denied');
  });

  it('resets getContentList to an empty array', async () => {
    await disconnect();
    expect(getContentList()).toEqual([]);
  });

  it('resets getError to null', async () => {
    await disconnect();
    expect(getError()).toBeNull();
  });

  it('resets isLoading to false', async () => {
    await disconnect();
    expect(isLoading()).toBe(false);
  });
});

//////////////////////////////
// updateContentItem
//////////////////////////////

describe('updateContentItem', () => {
  it('is a callable function (smoke test — content list is empty by default)', () => {
    // updateContentItem operates on the current contentList. With no items
    // loaded it should be a no-op rather than throw.
    expect(() => {
      updateContentItem('some-file.md', { title: 'Updated' });
    }).not.toThrow();
  });

  it('does not change the content list when no matching filename exists', () => {
    updateContentItem('does-not-exist.md', { title: 'X' });
    expect(getContentList()).toEqual([]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// Worker global stub — must exist before any module import
//
// merge.svelte.ts calls `new Worker(new URL(...), ...)` inside ensureDiffWorker()
// when processing candidate drafts. The stub must be in place before the module
// is evaluated so that the constructor does not throw in Node.js.
//////////////////////////////

const { FakeWorker } = vi.hoisted(() => {
  /** Minimal Worker stub that captures message listeners and postMessage calls. */
  class FakeWorker {
    listeners: Array<(event: MessageEvent) => void> = [];
    postMessage = vi.fn();
    terminate = vi.fn();

    /** @param {string} _type - The event type to listen for */
    addEventListener(_type: string, cb: (event: MessageEvent) => void) {
      this.listeners.push(cb);
    }

    /**
     * Simulates a message arriving from the worker.
     * @param {unknown} data - The message data to dispatch
     * @return {void}
     */
    simulateMessage(data: unknown): void {
      for (const l of this.listeners) {
        l({ data } as MessageEvent);
      }
    }
  }

  vi.stubGlobal('Worker', FakeWorker);
  return { FakeWorker };
});

//////////////////////////////
// Module-level mocks
//////////////////////////////

vi.mock('../../../../src/client/js/drafts/storage', () => ({
  loadDrafts: vi.fn(async () => []),
}));

// storageClient is a direct object export (not a getter function), so the
// mock uses a hoisted ref that tests swap between null and a fake client.
const { mockStorageClientRef } = vi.hoisted(() => ({
  mockStorageClientRef: { current: null as any },
}));
vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  get storageClient() {
    return mockStorageClientRef.current;
  },
}));

// js-yaml is a real dependency but we need to control its output in some tests
vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('js-yaml')>();
  return { ...actual };
});

import { loadDrafts } from '../../../../src/client/js/drafts/storage';
// storageClient import removed — tests configure mockStorageClientRef.current directly
import type { Draft } from '../../../../src/client/js/drafts/storage';

/**
 * Builds a minimal Draft fixture for merge tests.
 * @param {Partial<Draft>} overrides - Optional field overrides
 * @return {Draft} A complete Draft object
 */
function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'draft-001',
    collection: 'posts',
    filename: 'post.md',
    isNew: false,
    formData: { title: 'Post' },
    body: 'Body',
    snapshot: '{"body":"original","formData":{"title":"Original"}}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

//////////////////////////////
// drafts / outdatedMap
//////////////////////////////

describe('drafts / outdatedMap — reactive exports', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('drafts is an empty array before mergeDrafts is called', async () => {
    vi.resetModules();
    const { drafts } =
      await import('../../../../src/client/js/drafts/merge.svelte');
    expect(drafts.all).toEqual([]);
  });

  it('outdatedMap is an empty object before mergeDrafts is called', async () => {
    vi.resetModules();
    const { drafts } =
      await import('../../../../src/client/js/drafts/merge.svelte');
    expect(drafts.outdated).toEqual({});
  });
});

//////////////////////////////
// mergeDrafts
//////////////////////////////

describe('mergeDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('populates drafts with the loaded drafts', async () => {
    const drafts = [makeDraft({ id: 'md-01' }), makeDraft({ id: 'md-02' })];
    vi.mocked(loadDrafts).mockResolvedValue(drafts);
    // No storage client — candidates go through the empty-entries path
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.drafts.all).toEqual(drafts);
  });

  it('sets outdatedMap to {} when there are no candidate drafts', async () => {
    // All drafts are new — no candidates for comparison
    vi.mocked(loadDrafts).mockResolvedValue([
      makeDraft({ id: 'new-01', isNew: true, snapshot: null }),
    ]);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.drafts.outdated).toEqual({});
  });

  it('sets outdatedMap to {} when storage client is not available', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([
      makeDraft({ id: 'no-client-01', isNew: false, snapshot: 'snap' }),
    ]);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.drafts.outdated).toEqual({});
  });

  it('calls loadDrafts with the collection name', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([]);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('articles');

    expect(loadDrafts).toHaveBeenCalledWith('articles');
  });

  it('sets outdatedMap to {} when all candidate files are unreadable', async () => {
    // Client exists but readFile throws for every file
    const fakeClient = {
      readFile: vi.fn().mockRejectedValue(new Error('not found')),
    };
    vi.mocked(loadDrafts).mockResolvedValue([
      makeDraft({
        id: 'err-01',
        isNew: false,
        snapshot: 'snap',
        filename: 'x.md',
      }),
    ]);
    mockStorageClientRef.current = fakeClient;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.drafts.outdated).toEqual({});
  });
});

//////////////////////////////
// refreshDrafts
//////////////////////////////

describe('refreshDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('re-loads drafts from storage and updates the reactive list', async () => {
    const initial = [makeDraft({ id: 'rf-01' })];
    const refreshed = [makeDraft({ id: 'rf-01' }), makeDraft({ id: 'rf-02' })];

    vi.mocked(loadDrafts).mockResolvedValueOnce(initial);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');
    expect(mod.drafts.all).toHaveLength(1);

    vi.mocked(loadDrafts).mockResolvedValueOnce(refreshed);
    await mod.refreshDrafts('posts');
    expect(mod.drafts.all).toHaveLength(2);
  });

  it('calls loadDrafts with the correct collection', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([]);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.refreshDrafts('pages');

    expect(loadDrafts).toHaveBeenCalledWith('pages');
  });
});

//////////////////////////////
// resetDraftMerge
//////////////////////////////

describe('resetDraftMerge', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('clears the drafts list', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([makeDraft({ id: 'rst-01' })]);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');
    expect(mod.drafts.all).toHaveLength(1);

    mod.resetDraftMerge();
    expect(mod.drafts.all).toEqual([]);
  });

  it('clears the outdatedMap', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([]);
    mockStorageClientRef.current = null;

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    mod.resetDraftMerge();
    expect(mod.drafts.outdated).toEqual({});
  });

  it('is safe to call multiple times without throwing', async () => {
    vi.resetModules();
    const { resetDraftMerge } =
      await import('../../../../src/client/js/drafts/merge.svelte');
    expect(() => {
      resetDraftMerge();
      resetDraftMerge();
    }).not.toThrow();
  });
});

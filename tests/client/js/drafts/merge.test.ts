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

vi.mock('../../../../src/client/js/state/state.svelte', () => ({
  getStorageClient: vi.fn(() => null),
}));

// js-yaml is a real dependency but we need to control its output in some tests
vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('js-yaml')>();
  return { ...actual };
});

import { loadDrafts } from '../../../../src/client/js/drafts/storage';
import { getStorageClient } from '../../../../src/client/js/state/state.svelte';
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
// getDrafts / getOutdatedMap
//////////////////////////////

describe('getDrafts / getOutdatedMap — reactive getters', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('getDrafts returns empty array before mergeDrafts is called', async () => {
    vi.resetModules();
    const { getDrafts } =
      await import('../../../../src/client/js/drafts/merge.svelte');
    expect(getDrafts()).toEqual([]);
  });

  it('getOutdatedMap returns empty object before mergeDrafts is called', async () => {
    vi.resetModules();
    const { getOutdatedMap } =
      await import('../../../../src/client/js/drafts/merge.svelte');
    expect(getOutdatedMap()).toEqual({});
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

  it('populates getDrafts with the loaded drafts', async () => {
    const drafts = [makeDraft({ id: 'md-01' }), makeDraft({ id: 'md-02' })];
    vi.mocked(loadDrafts).mockResolvedValue(drafts);
    // No storage client — candidates go through the empty-entries path
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.getDrafts()).toEqual(drafts);
  });

  it('sets outdatedMap to {} when there are no candidate drafts', async () => {
    // All drafts are new — no candidates for comparison
    vi.mocked(loadDrafts).mockResolvedValue([
      makeDraft({ id: 'new-01', isNew: true, snapshot: null }),
    ]);
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.getOutdatedMap()).toEqual({});
  });

  it('sets outdatedMap to {} when storage client is not available', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([
      makeDraft({ id: 'no-client-01', isNew: false, snapshot: 'snap' }),
    ]);
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.getOutdatedMap()).toEqual({});
  });

  it('calls loadDrafts with the collection name', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([]);
    vi.mocked(getStorageClient).mockReturnValue(null as any);

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
    vi.mocked(getStorageClient).mockReturnValue(fakeClient as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    expect(mod.getOutdatedMap()).toEqual({});
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
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');
    expect(mod.getDrafts()).toHaveLength(1);

    vi.mocked(loadDrafts).mockResolvedValueOnce(refreshed);
    await mod.refreshDrafts('posts');
    expect(mod.getDrafts()).toHaveLength(2);
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
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');
    expect(mod.getDrafts()).toHaveLength(1);

    mod.resetDraftMerge();
    expect(mod.getDrafts()).toEqual([]);
  });

  it('clears the outdatedMap', async () => {
    vi.mocked(loadDrafts).mockResolvedValue([]);
    vi.mocked(getStorageClient).mockReturnValue(null as any);

    vi.resetModules();
    const mod = await import('../../../../src/client/js/drafts/merge.svelte');
    await mod.mergeDrafts('posts');

    mod.resetDraftMerge();
    expect(mod.getOutdatedMap()).toEqual({});
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

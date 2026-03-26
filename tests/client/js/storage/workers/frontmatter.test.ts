import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// Frontmatter worker tests
//
// The worker registers a self.addEventListener('message', ...) listener that
// handles 'port' and 'parse' message types. We stub self before importing
// the module, capture the handler, then invoke it with plain event-like
// objects rather than real MessageEvent instances.
//
// Real MessageEvent validates that items in the `ports` array are actual
// MessagePort instances — since we cannot construct those in Node.js without
// a real Worker context, we pass plain objects that satisfy the fields the
// worker code actually reads (event.data, event.ports[0]).
//
// StorageClient is mocked via vi.mock so no real port communication occurs.
//////////////////////////////

// ── Mock StorageClient ──────────────────────────────────────────────────────

const mockListFiles = vi.fn();

vi.mock('../../../../../src/client/js/storage/client', () => ({
  // Must use function keyword — arrow functions cannot be used with `new`
  StorageClient: function () {
    return { listFiles: mockListFiles };
  },
}));

// ── Self mock ──────────────────────────────────────────────────────────────

// The handler type uses a loose event shape: real MessageEvent validates
// that ports[] entries are actual MessagePort instances, which we cannot
// construct in Node.js. We type the captured handler loosely and call it
// with plain objects that mirror the fields the worker actually reads.
let messageHandler:
  | ((event: {
      data: Record<string, unknown>;
      ports: unknown[];
    }) => Promise<void>)
  | null = null;
const selfPostMessage = vi.fn();

vi.stubGlobal('self', {
  addEventListener: vi.fn((type: string, handler: unknown) => {
    if (type === 'message') {
      messageHandler = handler as (event: {
        data: Record<string, unknown>;
        ports: unknown[];
      }) => Promise<void>;
    }
  }),
  postMessage: selfPostMessage,
});

// ── Import module (after stubs) ────────────────────────────────────────────

await import('../../../../../src/client/js/storage/workers/frontmatter');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Dispatches a fake event to the captured handler by calling it directly
 * with a plain object. We bypass MessageEvent construction because the
 * constructor validates that ports[] entries are real MessagePort instances.
 * @param {Record<string, unknown>} data - The message data payload
 * @param {unknown[]} ports - Optional port-like objects to include
 * @return {Promise<void>}
 */
async function dispatch(
  data: Record<string, unknown>,
  ports: unknown[] = [],
): Promise<void> {
  await messageHandler!({ data, ports });
}

/**
 * Creates a minimal port-like object that satisfies the worker's StorageClient constructor.
 * @return {unknown} A fake port object
 */
function makeFakePort(): unknown {
  return {
    addEventListener: vi.fn(),
    start: vi.fn(),
    postMessage: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('frontmatter worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers a message listener on self', () => {
    expect(messageHandler).toBeTypeOf('function');
  });

  describe('port message', () => {
    it('does not post a response for a port initialization message', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);
      expect(selfPostMessage).not.toHaveBeenCalled();
    });
  });

  describe('parse message', () => {
    it('posts an error type message when storageClient cannot list files', async () => {
      // The storageClient is module-level state — it may or may not be set
      // depending on test execution order within this file. We trigger a
      // guaranteed error by leaving mockListFiles returning undefined (the
      // vi.clearAllMocks() in beforeEach resets it), which causes a runtime
      // error inside the worker's parse handler. The worker must post an
      // error message regardless of the error source.
      await dispatch({ type: 'parse', collection: 'posts' });
      const errCall = selfPostMessage.mock.calls.find(
        (c) => c[0].type === 'error',
      );
      expect(errCall).toBeDefined();
      expect(typeof errCall[0].message).toBe('string');
    });

    it('parses frontmatter from listed files and posts a result', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'b-post.md', content: '---\ntitle: B Post\n---\nBody B' },
        { filename: 'a-post.md', content: '---\ntitle: A Post\n---\nBody A' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });

      const resultCall = selfPostMessage.mock.calls.find(
        (c) => c[0].type === 'result',
      );
      expect(resultCall).toBeDefined();

      const { collection, items } = resultCall[0];
      expect(collection).toBe('posts');
      // Items should be sorted alphabetically by title
      expect(items[0].filename).toBe('a-post.md');
      expect(items[1].filename).toBe('b-post.md');
      expect(items[0].data.title).toBe('A Post');
    });

    it('falls back to filename for sorting when title is absent', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'z-file.md', content: 'No frontmatter' },
        { filename: 'a-file.md', content: 'No frontmatter' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });

      const resultCall = selfPostMessage.mock.calls.find(
        (c) => c[0].type === 'result',
      );
      expect(resultCall![0].items[0].filename).toBe('a-file.md');
    });

    it('posts an error when listFiles throws', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockRejectedValueOnce(new Error('storage failure'));

      await dispatch({ type: 'parse', collection: 'posts' });

      const errCall = selfPostMessage.mock.calls.find(
        (c) => c[0].type === 'error',
      );
      expect(errCall).toBeDefined();
      expect(errCall[0].message).toBe('storage failure');
    });

    it('includes files with empty frontmatter (data defaults to {})', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'no-fm.md', content: 'No frontmatter here' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });

      const resultCall = selfPostMessage.mock.calls.find(
        (c) => c[0].type === 'result',
      );
      expect(resultCall![0].items[0].data).toEqual({});
    });
  });
});

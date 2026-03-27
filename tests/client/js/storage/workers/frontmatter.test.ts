import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// Orchestrator worker tests
//
// The orchestrator worker registers a self.addEventListener('message', ...)
// listener that handles 'port' and 'parse' message types. It categorises files
// by extension — frontmatter files have their YAML block extracted and sent to
// the YAML parser worker; JSON files are parsed inline; YAML/TOML data files
// are routed to their respective parser workers.
//
// We mock Worker globally to intercept parser worker instantiation and
// simulate parse-batch-result responses. StorageClient is mocked via vi.mock.
//
// IMPORTANT: The orchestrator lazily spawns parser workers and caches them at
// module level. This means once a YAML worker is spawned in one test, all
// subsequent tests reuse it. The spawnedWorkers array is therefore cumulative
// across the entire suite — we do NOT clear it between tests.
//////////////////////////////

// ── Mock StorageClient ──────────────────────────────────────────────────────

const mockListFiles = vi.fn();

vi.mock('../../../../../src/client/js/storage/client', () => ({
  // Must use function keyword — arrow functions cannot be used with `new`
  StorageClient: function () {
    return { listFiles: mockListFiles };
  },
}));

// ── Mock Worker class ────────────────────────────────────────────────────────

/**
 * Tracks all spawned mock workers by URL for assertions.
 * NOT cleared between tests — the orchestrator caches workers at module level.
 */
const spawnedWorkers: MockWorkerInstance[] = [];

/**
 * A minimal mock of Worker that captures postMessage calls and allows
 * simulating onmessage responses from parser workers.
 */
class MockWorkerInstance {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  messages: Array<Record<string, unknown>> = [];

  /**
   * @param {string | URL} url - The URL passed to the Worker constructor
   */
  constructor(url: string | URL) {
    this.url = String(url);
    spawnedWorkers.push(this);
  }

  /**
   * Captures posted messages and auto-responds with parse-batch-result
   * by extracting a title from YAML/TOML-like "title: <value>" lines.
   * @param {Record<string, unknown>} msg - The message sent to the worker
   * @return {void}
   */
  postMessage(msg: Record<string, unknown>): void {
    this.messages.push(msg);

    // Auto-respond to parse-batch with mock results
    if (msg.type === 'parse-batch' && this.onmessage) {
      const items = msg.items as Array<{ key: string; content: string }>;
      const results: Record<string, Record<string, unknown>> = {};
      for (const item of items) {
        // Simulate parsing by creating a data object with the title extracted
        // from a "title: <value>" line in the YAML/TOML content
        const titleMatch = item.content.match(/title:\s*(.+)/);
        results[item.key] = titleMatch ? { title: titleMatch[1].trim() } : {};
      }
      // Respond asynchronously to match real worker behavior
      const id = msg.id as string;
      const handler = this.onmessage;
      queueMicrotask(() => {
        handler({
          data: { type: 'parse-batch-result', id, ok: true, results },
        } as MessageEvent);
      });
    }
  }
}

vi.stubGlobal('Worker', MockWorkerInstance);

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

/**
 * Waits for microtask queue to flush so async parser worker responses resolve.
 * @return {Promise<void>}
 */
async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

/**
 * Finds the latest result message from selfPostMessage calls.
 * @return {Record<string, unknown> | undefined} The result payload, or undefined
 */
function findResult(): Record<string, unknown> | undefined {
  const call = selfPostMessage.mock.calls.find((c) => c[0].type === 'result');
  return call?.[0];
}

/**
 * Finds the latest error message from selfPostMessage calls.
 * @return {Record<string, unknown> | undefined} The error payload, or undefined
 */
function findError(): Record<string, unknown> | undefined {
  const call = selfPostMessage.mock.calls.find((c) => c[0].type === 'error');
  return call?.[0];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('orchestrator worker', () => {
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
    it('posts an error when storageClient is not initialized', async () => {
      // The storageClient is module-level state — it may or may not be set
      // depending on test execution order. We trigger a guaranteed error by
      // leaving mockListFiles returning undefined, which causes a runtime
      // error inside the worker's parse handler.
      await dispatch({ type: 'parse', collection: 'posts' });
      const err = findError();
      expect(err).toBeDefined();
      expect(typeof err!.message).toBe('string');
    });

    it('spawns a YAML worker and extracts YAML block for frontmatter files', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        {
          filename: 'post.md',
          content: '---\ntitle: Hello World\n---\nBody content here',
        },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });
      await flushMicrotasks();

      // A YAML worker should have been spawned
      const yamlWorker = spawnedWorkers.find((w) =>
        w.url.includes('yaml-parser'),
      );
      expect(yamlWorker).toBeDefined();

      // It should have received a parse-batch with the extracted YAML block
      const batchMsg = yamlWorker!.messages.find(
        (m) => m.type === 'parse-batch',
      );
      expect(batchMsg).toBeDefined();

      const items = batchMsg!.items as Array<{ key: string; content: string }>;
      // The YAML block should NOT include the --- delimiters or body
      expect(items[0].content).toBe('title: Hello World');
      expect(items[0].key).toBe('post.md');
    });

    it('sorts frontmatter files alphabetically by title', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'b-post.md', content: '---\ntitle: B Post\n---\nBody B' },
        { filename: 'a-post.md', content: '---\ntitle: A Post\n---\nBody A' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });
      await flushMicrotasks();

      const result = findResult();
      expect(result).toBeDefined();
      expect(result!.collection).toBe('posts');

      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].filename).toBe('a-post.md');
      expect(items[1].filename).toBe('b-post.md');
      expect(items[0].data.title).toBe('A Post');
    });

    it('parses JSON data files inline without spawning a worker', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      const workerCountBefore = spawnedWorkers.length;

      mockListFiles.mockResolvedValueOnce([
        {
          filename: 'config.json',
          content: '{"title": "JSON Config", "count": 42}',
        },
      ]);

      await dispatch({
        type: 'parse',
        collection: 'data',
        extensions: ['.json'],
      });
      await flushMicrotasks();

      const result = findResult();
      expect(result).toBeDefined();

      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].filename).toBe('config.json');
      expect(items[0].data.title).toBe('JSON Config');
      expect(items[0].data.count).toBe(42);

      // No NEW parser workers should have been spawned for JSON-only parsing
      expect(spawnedWorkers.length).toBe(workerCountBefore);
    });

    it('routes YAML data files to the YAML worker', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'settings.yaml', content: 'title: YAML Settings' },
      ]);

      await dispatch({
        type: 'parse',
        collection: 'data',
        extensions: ['.yaml'],
      });
      await flushMicrotasks();

      // The YAML worker should exist (spawned in earlier test or this one)
      const yamlWorker = spawnedWorkers.find((w) =>
        w.url.includes('yaml-parser'),
      );
      expect(yamlWorker).toBeDefined();

      // Find the batch message containing YAML data file content
      const batchMsg = yamlWorker!.messages.find((m) => {
        if (m.type !== 'parse-batch') return false;
        const batchItems = m.items as Array<{
          key: string;
          content: string;
        }>;
        return batchItems.some((i) => i.key === 'settings.yaml');
      });
      expect(batchMsg).toBeDefined();

      const batchItems = batchMsg!.items as Array<{
        key: string;
        content: string;
      }>;
      const settingsItem = batchItems.find((i) => i.key === 'settings.yaml');
      // YAML data files send full content, not extracted block
      expect(settingsItem!.content).toBe('title: YAML Settings');

      const result = findResult();
      expect(result).toBeDefined();
      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].data.title).toBe('YAML Settings');
    });

    it('routes TOML data files to the TOML worker', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'config.toml', content: 'title = "TOML Config"' },
      ]);

      await dispatch({
        type: 'parse',
        collection: 'data',
        extensions: ['.toml'],
      });
      await flushMicrotasks();

      // A TOML worker should have been spawned
      const tomlWorker = spawnedWorkers.find((w) =>
        w.url.includes('toml-parser'),
      );
      expect(tomlWorker).toBeDefined();

      const batchMsg = tomlWorker!.messages.find(
        (m) => m.type === 'parse-batch',
      );
      expect(batchMsg).toBeDefined();

      const result = findResult();
      expect(result).toBeDefined();
    });

    it('falls back to filename for sorting when title is absent', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'z-file.md', content: 'No frontmatter' },
        { filename: 'a-file.md', content: 'No frontmatter' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });
      await flushMicrotasks();

      const result = findResult();
      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].filename).toBe('a-file.md');
    });

    it('posts an error when listFiles throws', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockRejectedValueOnce(new Error('storage failure'));

      await dispatch({ type: 'parse', collection: 'posts' });
      await flushMicrotasks();

      const err = findError();
      expect(err).toBeDefined();
      expect(err!.message).toBe('storage failure');
    });

    it('includes files with empty frontmatter (data defaults to {})', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'no-fm.md', content: 'No frontmatter here' },
      ]);

      await dispatch({ type: 'parse', collection: 'posts' });
      await flushMicrotasks();

      const result = findResult();
      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].data).toEqual({});
    });

    it('sorts correctly across mixed file types', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'z-post.md', content: '---\ntitle: Zebra\n---\nbody' },
        {
          filename: 'config.json',
          content: '{"title": "Alpha Config"}',
        },
        { filename: 'middle.yaml', content: 'title: Middle Entry' },
      ]);

      await dispatch({
        type: 'parse',
        collection: 'mixed',
        extensions: ['.md', '.json', '.yaml'],
      });
      await flushMicrotasks();

      const result = findResult();
      expect(result).toBeDefined();
      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      // Alpha Config < Middle Entry < Zebra
      expect(items[0].data.title).toBe('Alpha Config');
      expect(items[1].data.title).toBe('Middle Entry');
      expect(items[2].data.title).toBe('Zebra');
    });

    it('handles invalid JSON gracefully with empty data', async () => {
      await dispatch({ type: 'port' }, [makeFakePort()]);

      mockListFiles.mockResolvedValueOnce([
        { filename: 'bad.json', content: '{ invalid json' },
      ]);

      await dispatch({
        type: 'parse',
        collection: 'data',
        extensions: ['.json'],
      });
      await flushMicrotasks();

      const result = findResult();
      expect(result).toBeDefined();
      const items = result!.items as Array<{
        filename: string;
        data: Record<string, unknown>;
      }>;
      expect(items[0].data).toEqual({});
    });
  });
});

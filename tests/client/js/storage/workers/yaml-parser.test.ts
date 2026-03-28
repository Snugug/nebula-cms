import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// YAML parser worker tests
//
// The worker registers a self.addEventListener('message', ...) listener that
// handles 'parse', 'parse-batch', and 'stringify' message types. We stub self
// before importing the module, capture the handler, then invoke it with plain
// event-like objects rather than real MessageEvent instances.
//
// Real MessageEvent validates that items in the `ports` array are actual
// MessagePort instances — since we cannot construct those in Node.js without
// a real Worker context, we pass plain objects that satisfy the fields the
// worker code actually reads (event.data).
//////////////////////////////

// ── Self mock ──────────────────────────────────────────────────────────────

// The handler type uses a loose event shape: real MessageEvent validates
// that ports[] entries are actual MessagePort instances, which we cannot
// construct in Node.js. We type the captured handler loosely and call it
// with plain objects that mirror the fields the worker actually reads.
let messageHandler:
  | ((event: { data: Record<string, unknown> }) => Promise<void>)
  | null = null;
const selfPostMessage = vi.fn();

vi.stubGlobal('self', {
  addEventListener: vi.fn((type: string, handler: unknown) => {
    if (type === 'message') {
      messageHandler = handler as (event: {
        data: Record<string, unknown>;
      }) => Promise<void>;
    }
  }),
  postMessage: selfPostMessage,
});

// ── Import module (after stubs) ────────────────────────────────────────────

await import('../../../../../src/client/js/storage/workers/yaml-parser');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Dispatches a fake event to the captured handler by calling it directly
 * with a plain object. We bypass MessageEvent construction because the
 * constructor validates that ports[] entries are real MessagePort instances.
 * @param {Record<string, unknown>} data - The message data payload
 * @return {Promise<void>}
 */
async function dispatch(data: Record<string, unknown>): Promise<void> {
  await messageHandler!({ data });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('yaml-parser worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('registers a message listener on self', () => {
    expect(messageHandler).toBeTypeOf('function');
  });

  describe('parse message', () => {
    it('parses a valid YAML string and posts a parse-result with ok: true', async () => {
      await dispatch({
        type: 'parse',
        id: 'req-1',
        content: 'title: Hello World\ncount: 42',
      });

      expect(selfPostMessage).toHaveBeenCalledOnce();
      const msg = selfPostMessage.mock.calls[0][0];
      expect(msg.type).toBe('parse-result');
      expect(msg.id).toBe('req-1');
      expect(msg.ok).toBe(true);
      expect(msg.data).toEqual({ title: 'Hello World', count: 42 });
    });

    it('posts a parse-result with ok: false for invalid YAML', async () => {
      await dispatch({
        type: 'parse',
        id: 'req-err',
        // Intentionally malformed: tab characters are not allowed in YAML
        content: 'key:\n\t- bad',
      });

      expect(selfPostMessage).toHaveBeenCalledOnce();
      const msg = selfPostMessage.mock.calls[0][0];
      expect(msg.type).toBe('parse-result');
      expect(msg.id).toBe('req-err');
      expect(msg.ok).toBe(false);
      expect(typeof msg.error).toBe('string');
    });
  });

  describe('parse-batch message', () => {
    it('parses a batch of YAML strings and posts a parse-batch-result with ok: true', async () => {
      await dispatch({
        type: 'parse-batch',
        id: 'batch-1',
        items: [
          { key: 'file-a', content: 'title: File A' },
          { key: 'file-b', content: 'title: File B\nactive: true' },
        ],
      });

      expect(selfPostMessage).toHaveBeenCalledOnce();
      const msg = selfPostMessage.mock.calls[0][0];
      expect(msg.type).toBe('parse-batch-result');
      expect(msg.id).toBe('batch-1');
      expect(msg.ok).toBe(true);
      expect(msg.results).toEqual({
        'file-a': { title: 'File A' },
        'file-b': { title: 'File B', active: true },
      });
    });

    it('posts a parse-batch-result with ok: false when any item has invalid YAML', async () => {
      await dispatch({
        type: 'parse-batch',
        id: 'batch-err',
        items: [
          { key: 'good', content: 'title: Good' },
          { key: 'bad', content: 'key:\n\t- bad' },
        ],
      });

      expect(selfPostMessage).toHaveBeenCalledOnce();
      const msg = selfPostMessage.mock.calls[0][0];
      expect(msg.type).toBe('parse-batch-result');
      expect(msg.id).toBe('batch-err');
      expect(msg.ok).toBe(false);
      expect(typeof msg.error).toBe('string');
    });
  });

  describe('stringify message', () => {
    it('serializes an object to a YAML string and posts a stringify-result with ok: true', async () => {
      await dispatch({
        type: 'stringify',
        id: 'str-1',
        data: { title: 'My Post', tags: ['a', 'b'], count: 7 },
      });

      expect(selfPostMessage).toHaveBeenCalledOnce();
      const msg = selfPostMessage.mock.calls[0][0];
      expect(msg.type).toBe('stringify-result');
      expect(msg.id).toBe('str-1');
      expect(msg.ok).toBe(true);
      expect(typeof msg.content).toBe('string');
      // Verify the serialized YAML round-trips back to the original data
      const { load } = await import('js-yaml');
      expect(load(msg.content)).toEqual({
        title: 'My Post',
        tags: ['a', 'b'],
        count: 7,
      });
    });
  });
});

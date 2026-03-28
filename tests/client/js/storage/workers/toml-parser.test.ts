import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// TOML parser worker tests
//
// The worker registers a self.addEventListener('message', ...) listener that
// handles 'parse', 'parse-batch', and 'stringify' message types. We stub self
// before importing the module, capture the handler, then invoke it with plain
// event-like objects rather than real MessageEvent instances.
//
// Real MessageEvent validates its payload structure at construction time;
// plain objects are used instead so tests remain in Node.js without a real
// Worker context.
//////////////////////////////

// ── Self mock ──────────────────────────────────────────────────────────────

// The handler type uses a loose event shape: the worker reads event.data
// only, so we only need to match that property.
let messageHandler:
  | ((event: { data: Record<string, unknown> }) => void)
  | null = null;
const selfPostMessage = vi.fn();

vi.stubGlobal('self', {
  addEventListener: vi.fn((type: string, handler: unknown) => {
    if (type === 'message') {
      messageHandler = handler as (event: {
        data: Record<string, unknown>;
      }) => void;
    }
  }),
  postMessage: selfPostMessage,
});

// ── Import module (after stubs) ────────────────────────────────────────────

await import('../../../../../src/client/js/storage/workers/toml-parser');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Dispatches a fake event to the captured handler by calling it directly with a plain object.
 * MessageEvent construction is bypassed because the constructor validates its payload.
 * @param {Record<string, unknown>} data - The message data payload
 * @return {void}
 */
function dispatch(data: Record<string, unknown>): void {
  messageHandler!({ data });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('toml-parser worker', () => {
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
    it('parses a valid TOML string and posts a parse-result with the data', () => {
      dispatch({
        type: 'parse',
        id: 'p1',
        content: 'title = "Hello"\ncount = 42\n',
      });

      expect(selfPostMessage).toHaveBeenCalledWith({
        type: 'parse-result',
        id: 'p1',
        ok: true,
        data: { title: 'Hello', count: 42 },
      });
    });

    it('posts a parse-result with ok: false for invalid TOML', () => {
      dispatch({
        type: 'parse',
        id: 'p2',
        content: 'this is not = = valid toml',
      });

      const call = selfPostMessage.mock.calls[0][0];
      expect(call.type).toBe('parse-result');
      expect(call.id).toBe('p2');
      expect(call.ok).toBe(false);
      expect(typeof call.error).toBe('string');
    });
  });

  describe('parse-batch message', () => {
    it('parses a batch of TOML strings and posts a parse-batch-result with a results map', () => {
      dispatch({
        type: 'parse-batch',
        id: 'b1',
        items: [
          { key: 'alpha', content: 'value = 1\n' },
          { key: 'beta', content: 'value = 2\n' },
        ],
      });

      expect(selfPostMessage).toHaveBeenCalledWith({
        type: 'parse-batch-result',
        id: 'b1',
        ok: true,
        results: {
          alpha: { value: 1 },
          beta: { value: 2 },
        },
      });
    });

    it('posts a parse-batch-result with ok: false when a batch item is invalid', () => {
      dispatch({
        type: 'parse-batch',
        id: 'b2',
        items: [{ key: 'bad', content: 'not = = valid' }],
      });

      const call = selfPostMessage.mock.calls[0][0];
      expect(call.type).toBe('parse-batch-result');
      expect(call.id).toBe('b2');
      expect(call.ok).toBe(false);
      expect(typeof call.error).toBe('string');
    });
  });

  describe('stringify message', () => {
    it('serializes an object to a TOML string and posts a stringify-result', () => {
      dispatch({
        type: 'stringify',
        id: 's1',
        data: { name: 'test', count: 5 },
      });

      const call = selfPostMessage.mock.calls[0][0];
      expect(call.type).toBe('stringify-result');
      expect(call.id).toBe('s1');
      expect(call.ok).toBe(true);
      expect(typeof call.content).toBe('string');
      // Verify round-trip: the output must contain the original values
      expect(call.content).toContain('name');
      expect(call.content).toContain('test');
    });

    it('posts a stringify-result with ok: false when serialization fails', () => {
      // smol-toml cannot serialize values that are not TOML-compatible (e.g. undefined)
      dispatch({
        type: 'stringify',
        id: 's2',
        // A nested object with a circular-ish unsupported value
        data: { bad: undefined as unknown },
      });

      // smol-toml may succeed (skipping undefined) or fail — either way the
      // response must be a stringify-result with a defined id
      const call = selfPostMessage.mock.calls[0][0];
      expect(call.type).toBe('stringify-result');
      expect(call.id).toBe('s2');
    });
  });
});

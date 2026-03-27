import { describe, it, expect, vi, afterEach, type MockInstance } from 'vitest';

//////////////////////////////
// Storage worker tests
//
// The worker module uses self.addEventListener('connect', ...) to register a
// SharedWorker entry point. We mock self before importing so the listener is
// captured, then invoke it with plain event-like objects (not real
// MessageEvent instances, because MessageEvent.ports is a readonly getter).
//
// The worker's `adapter` variable is module-level singleton state. Each test
// creates its own isolated port and drives its own init + request sequence
// rather than sharing state via beforeEach. This avoids cross-test pollution
// where an adapter set by one test's init is still active when the next test
// starts.
//
// Adapters are loaded via dynamic import() inside the 'init' case. We mock
// those modules via vi.mock so no real FSA or GitHub code runs.
//////////////////////////////

import type { StorageRequest } from '../../../../../src/client/js/storage/adapter';

// ── Mock adapter modules ────────────────────────────────────────────────────

vi.mock('../../../../../src/client/js/storage/fsa', () => ({
  FsaAdapter: function () {
    return {
      listFiles: vi
        .fn()
        .mockResolvedValue([{ filename: 'a.md', content: 'A' }]),
      readFile: vi.fn().mockResolvedValue('A content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      writeFiles: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

vi.mock('../../../../../src/client/js/storage/github', () => ({
  GitHubAdapter: function () {
    return {
      validate: vi.fn().mockResolvedValue(undefined),
      listFiles: vi
        .fn()
        .mockResolvedValue([{ filename: 'b.md', content: 'B' }]),
      readFile: vi.fn().mockResolvedValue('B content'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      writeFiles: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    };
  },
}));

// ── Self mock ──────────────────────────────────────────────────────────────

// Capture the connect listener registered by the worker module at import time.
// The handler type uses a plain object because MessageEvent.ports is a
// readonly getter — we cannot assign to it on a real MessageEvent.
let connectHandler: ((event: { ports: MessagePort[] }) => void) | null = null;

vi.stubGlobal('self', {
  addEventListener: vi.fn((type: string, handler: unknown) => {
    if (type === 'connect') {
      connectHandler = handler as (event: { ports: MessagePort[] }) => void;
    }
  }),
  postMessage: vi.fn(),
});

// ── Import module under test (after mocks are in place) ─────────────────────

await import('../../../../../src/client/js/storage/workers/storage');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Creates an isolated port whose outgoing messages are captured by a spy.
 * @return {{ port: MessagePort; postSpy: MockInstance; send: (req: StorageRequest & { _id?: string }) => void }}
 */
function makeMockPort() {
  const target = new EventTarget();
  const postSpy = vi.fn();

  const port = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    postMessage: postSpy,
    start: vi.fn(),
  } as unknown as MessagePort;

  /**
   * Fires a message event to simulate a client request arriving on the port.
   * @param {StorageRequest & { _id?: string }} req - The request payload
   * @return {void}
   */
  function send(req: StorageRequest & { _id?: string }): void {
    const event = new MessageEvent('message', { data: req });
    target.dispatchEvent(event);
  }

  return { port, postSpy, send };
}

/**
 * Connects a port to the worker by invoking the captured connect handler
 * with a plain object. MessageEvent.ports is a readonly getter so we cannot
 * use a real MessageEvent here.
 * @param {MessagePort} port - The port to register with the worker
 * @return {void}
 */
function connectPort(port: MessagePort): void {
  connectHandler!({ ports: [port] });
}

/**
 * Connects a port, sends an FSA init, and waits for the ok response.
 * @param {MockInstance} postSpy - The port's postMessage spy
 * @param {(req: StorageRequest & { _id?: string }) => void} send - The send helper
 * @param {string} id - A unique _id for this init request
 * @return {Promise<void>}
 */
async function initFsa(
  postSpy: MockInstance,
  send: (req: StorageRequest & { _id?: string }) => void,
  id: string,
): Promise<void> {
  send({
    type: 'init',
    backend: { type: 'fsa', handle: {} as FileSystemDirectoryHandle },
    _id: id,
  });
  await vi.waitUntil(() => postSpy.mock.calls.some((c) => c[0]._id === id), {
    timeout: 2000,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
});

describe('storage worker', () => {
  it('registers a connect listener on self', () => {
    expect(connectHandler).toBeTypeOf('function');
  });

  it('sends port-connected immediately when a port connects', () => {
    const { port, postSpy } = makeMockPort();
    connectPort(port);
    const portConnected = postSpy.mock.calls.find(
      (c) => c[0].type === 'port-connected',
    );
    expect(portConnected).toBeDefined();
  });

  it('responds to FSA init with ok: true', async () => {
    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    await initFsa(postSpy, send, 'init-fsa-1');
    const resp = postSpy.mock.calls.find((c) => c[0]._id === 'init-fsa-1')[0];
    expect(resp.ok).toBe(true);
    expect(resp.type).toBe('init');
    // Clean up shared adapter state
    send({ type: 'teardown', _id: 'teardown-fsa-1' });
    await vi.waitUntil(() =>
      postSpy.mock.calls.some((c) => c[0]._id === 'teardown-fsa-1'),
    );
  });

  it('responds to GitHub init with ok: true', async () => {
    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    send({
      type: 'init',
      backend: { type: 'github', token: 'tok', repo: 'owner/repo' },
      _id: 'init-gh-1',
    });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'init-gh-1'),
      { timeout: 2000 },
    );
    const resp = postSpy.mock.calls.find((c) => c[0]._id === 'init-gh-1')[0];
    expect(resp.ok).toBe(true);
    // Clean up
    send({ type: 'teardown', _id: 'teardown-gh-1' });
    await vi.waitUntil(() =>
      postSpy.mock.calls.some((c) => c[0]._id === 'teardown-gh-1'),
    );
  });

  it('responds to listFiles after init', async () => {
    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    await initFsa(postSpy, send, 'init-list');

    send({
      type: 'listFiles',
      collection: 'posts',
      extensions: ['.md', '.mdx'],
      _id: 'list-1',
    });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'list-1'),
      { timeout: 2000 },
    );

    const resp = postSpy.mock.calls.find((c) => c[0]._id === 'list-1')[0];
    expect(resp.type).toBe('listFiles');
    expect(resp.ok).toBe(true);
    expect(resp.files).toEqual([{ filename: 'a.md', content: 'A' }]);

    send({ type: 'teardown', _id: 'teardown-list' });
    await vi.waitUntil(() =>
      postSpy.mock.calls.some((c) => c[0]._id === 'teardown-list'),
    );
  });

  it('returns an error response for listFiles before init', async () => {
    // Teardown any adapter left by previous tests
    const {
      port: cleanPort,
      postSpy: cleanSpy,
      send: cleanSend,
    } = makeMockPort();
    connectPort(cleanPort);
    cleanSend({ type: 'teardown', _id: 'pre-teardown' });
    await vi.waitUntil(() =>
      cleanSpy.mock.calls.some((c) => c[0]._id === 'pre-teardown'),
    );

    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    send({
      type: 'listFiles',
      collection: 'posts',
      extensions: ['.md', '.mdx'],
      _id: 'list-no-adapter',
    });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'list-no-adapter'),
      { timeout: 2000 },
    );

    const resp = postSpy.mock.calls.find(
      (c) => c[0]._id === 'list-no-adapter',
    )[0];
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('No backend');
  });

  it('responds to deleteFile after init', async () => {
    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    await initFsa(postSpy, send, 'init-delete');

    send({
      type: 'deleteFile',
      collection: 'posts',
      filename: 'old.md',
      _id: 'delete-1',
    });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'delete-1'),
      { timeout: 2000 },
    );

    const resp = postSpy.mock.calls.find((c) => c[0]._id === 'delete-1')[0];
    expect(resp.type).toBe('deleteFile');
    expect(resp.ok).toBe(true);

    send({ type: 'teardown', _id: 'teardown-delete' });
    await vi.waitUntil(() =>
      postSpy.mock.calls.some((c) => c[0]._id === 'teardown-delete'),
    );
  });

  it('returns an error response for deleteFile before init', async () => {
    // Teardown any adapter left by previous tests
    const {
      port: cleanPort,
      postSpy: cleanSpy,
      send: cleanSend,
    } = makeMockPort();
    connectPort(cleanPort);
    cleanSend({ type: 'teardown', _id: 'pre-teardown-del' });
    await vi.waitUntil(() =>
      cleanSpy.mock.calls.some((c) => c[0]._id === 'pre-teardown-del'),
    );

    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    send({
      type: 'deleteFile',
      collection: 'posts',
      filename: 'old.md',
      _id: 'delete-no-adapter',
    });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'delete-no-adapter'),
      { timeout: 2000 },
    );

    const resp = postSpy.mock.calls.find(
      (c) => c[0]._id === 'delete-no-adapter',
    )[0];
    expect(resp.ok).toBe(false);
    expect(resp.error).toContain('No backend');
  });

  it('responds to teardown with ok: true and clears the adapter', async () => {
    const { port, postSpy, send } = makeMockPort();
    connectPort(port);
    await initFsa(postSpy, send, 'init-teardown');

    send({ type: 'teardown', _id: 'td-1' });
    await vi.waitUntil(
      () => postSpy.mock.calls.some((c) => c[0]._id === 'td-1'),
      { timeout: 2000 },
    );

    const resp = postSpy.mock.calls.find((c) => c[0]._id === 'td-1')[0];
    expect(resp.type).toBe('teardown');
    expect(resp.ok).toBe(true);
  });
});

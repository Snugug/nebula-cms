import { describe, it, expect, vi, beforeEach } from 'vitest';

//////////////////////////////
// StorageClient tests
//
// StorageClient wraps a MessagePort with request/response correlation.
// We simulate the port with a plain EventTarget + a manual postMessage spy
// so we can fire synthetic message events and verify that calls are
// matched back to their originating promise.
//////////////////////////////

import { StorageClient } from '../../../../src/client/js/storage/client';
import type { StorageResponse } from '../../../../src/client/js/storage/adapter';

// ── Mock port factory ────────────────────────────────────────────────────────

/**
 * Creates a fake MessagePort that captures outgoing messages and exposes a
 * helper to simulate an incoming response from the "worker" side.
 * @return {{ port: MessagePort; postSpy: ReturnType<typeof vi.fn>; respond: (data: StorageResponse & { _id?: string }) => void }}
 */
function makeMockPort() {
  const target = new EventTarget();
  const postSpy = vi.fn();

  const port = {
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
    postMessage: postSpy,
    start: vi.fn(),
  } as unknown as MessagePort;

  /**
   * Fires a message event on the port, simulating a response from the worker.
   * @param {StorageResponse & { _id?: string }} data - The response payload
   * @return {void}
   */
  function respond(data: StorageResponse & { _id?: string }): void {
    const event = new MessageEvent('message', { data });
    target.dispatchEvent(event);
  }

  return { port, postSpy, respond };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StorageClient', () => {
  let postSpy: ReturnType<typeof vi.fn>;
  let respond: (data: StorageResponse & { _id?: string }) => void;
  let client: StorageClient;

  beforeEach(() => {
    const mock = makeMockPort();
    postSpy = mock.postSpy;
    respond = mock.respond;
    client = new StorageClient(mock.port);
  });

  it('calls port.start() in the constructor', () => {
    const mock = makeMockPort();
    // start() is called during construction
    new StorageClient(mock.port);
    expect(
      (mock.port.start as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(1);
  });

  describe('init', () => {
    it('sends an init message and resolves when a matching ok response arrives', async () => {
      const promise = client.init({
        type: 'init',
        backend: { type: 'github', token: 'tok', repo: 'owner/repo' },
      });

      // Grab the _id from the sent message
      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({ type: 'init', ok: true, _id: sentMsg._id } as any);

      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects when the worker responds with ok: false', async () => {
      const promise = client.init({
        type: 'init',
        backend: { type: 'github', token: 'tok', repo: 'owner/repo' },
      });

      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({
        type: 'init',
        ok: false,
        error: 'bad credentials',
        _id: sentMsg._id,
      } as any);

      await expect(promise).rejects.toThrow('bad credentials');
    });
  });

  describe('listFiles', () => {
    it('resolves with the files array from the worker response', async () => {
      const files = [{ filename: 'a.md', content: 'A' }];
      const promise = client.listFiles('posts', ['.md', '.mdx']);

      const sentMsg = postSpy.mock.calls[0][0] as {
        _id: string;
        type: string;
        collection: string;
        extensions: string[];
      };
      expect(sentMsg.type).toBe('listFiles');
      expect(sentMsg.collection).toBe('posts');
      expect(sentMsg.extensions).toEqual(['.md', '.mdx']);

      respond({
        type: 'listFiles',
        ok: true,
        files,
        _id: sentMsg._id,
      } as any);

      const result = await promise;
      expect(result).toEqual(files);
    });

    it('rejects on error response', async () => {
      const promise = client.listFiles('posts', ['.md', '.mdx']);
      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({
        type: 'listFiles',
        ok: false,
        error: 'storage error',
        _id: sentMsg._id,
      } as any);
      await expect(promise).rejects.toThrow('storage error');
    });
  });

  describe('deleteFile', () => {
    it('resolves when the worker responds with ok: true', async () => {
      const promise = client.deleteFile('posts', 'old.md');
      const sentMsg = postSpy.mock.calls[0][0] as {
        _id: string;
        type: string;
        collection: string;
        filename: string;
      };
      expect(sentMsg.type).toBe('deleteFile');
      expect(sentMsg.collection).toBe('posts');
      expect(sentMsg.filename).toBe('old.md');
      respond({ type: 'deleteFile', ok: true, _id: sentMsg._id } as any);
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects on error response', async () => {
      const promise = client.deleteFile('posts', 'missing.md');
      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({
        type: 'deleteFile',
        ok: false,
        error: 'File not found',
        _id: sentMsg._id,
      } as any);
      await expect(promise).rejects.toThrow('File not found');
    });
  });

  describe('readFile', () => {
    it('resolves with the content from the worker response', async () => {
      const promise = client.readFile('posts', 'hello.md');

      const sentMsg = postSpy.mock.calls[0][0] as {
        _id: string;
        collection: string;
        filename: string;
      };
      expect(sentMsg.collection).toBe('posts');
      expect(sentMsg.filename).toBe('hello.md');

      respond({
        type: 'readFile',
        ok: true,
        content: '# Hello',
        _id: sentMsg._id,
      } as any);

      const result = await promise;
      expect(result).toBe('# Hello');
    });
  });

  describe('writeFile', () => {
    it('resolves when the worker responds with ok: true', async () => {
      const promise = client.writeFile('posts', 'test.md', 'body');
      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({ type: 'writeFile', ok: true, _id: sentMsg._id } as any);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('writeFiles', () => {
    it('sends the files array and resolves on ok response', async () => {
      const files = [
        { collection: 'posts', filename: 'a.md', content: 'A' },
        { collection: 'posts', filename: 'b.md', content: 'B' },
      ];
      const promise = client.writeFiles(files);

      const sentMsg = postSpy.mock.calls[0][0] as {
        _id: string;
        type: string;
        files: typeof files;
      };
      expect(sentMsg.type).toBe('writeFiles');
      expect(sentMsg.files).toEqual(files);

      respond({ type: 'writeFiles', ok: true, _id: sentMsg._id } as any);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('teardown', () => {
    it('sends a teardown message and resolves on ok response', async () => {
      const promise = client.teardown();
      const sentMsg = postSpy.mock.calls[0][0] as {
        _id: string;
        type: string;
      };
      expect(sentMsg.type).toBe('teardown');
      respond({ type: 'teardown', ok: true, _id: sentMsg._id } as any);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('message correlation', () => {
    it('ignores broadcast messages without an _id', async () => {
      // port-connected has no _id and should not reject any pending promise
      const promise = client.listFiles('posts', ['.md', '.mdx']);
      respond({ type: 'port-connected' } as any);
      // Promise should still be pending — resolve it now with a proper response
      const sentMsg = postSpy.mock.calls[0][0] as { _id: string };
      respond({
        type: 'listFiles',
        ok: true,
        files: [],
        _id: sentMsg._id,
      } as any);
      await expect(promise).resolves.toEqual([]);
    });

    it('increments _id for each request so concurrent calls are independent', async () => {
      const p1 = client.listFiles('posts', ['.md', '.mdx']);
      const p2 = client.readFile('posts', 'a.md');

      const msg1 = postSpy.mock.calls[0][0] as { _id: string };
      const msg2 = postSpy.mock.calls[1][0] as { _id: string };
      expect(msg1._id).not.toBe(msg2._id);

      // Resolve in reverse order to prove there's no ordering dependency
      respond({
        type: 'readFile',
        ok: true,
        content: 'content',
        _id: msg2._id,
      } as any);
      respond({
        type: 'listFiles',
        ok: true,
        files: [{ filename: 'x.md', content: 'x' }],
        _id: msg1._id,
      } as any);

      const list = await p1;
      const read = await p2;
      expect(list[0].filename).toBe('x.md');
      expect(read).toBe('content');
    });
  });
});

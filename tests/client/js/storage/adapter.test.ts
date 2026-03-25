import { describe, it, expect } from 'vitest';

//////////////////////////////
// adapter.ts type-export tests
//
// adapter.ts is a pure type/interface file — there is no runtime code to
// exercise. These tests confirm that the named exports are importable and
// that the module resolves without errors, providing a compile-time
// regression guard.
//////////////////////////////

import type {
  FileEntry,
  FileWrite,
  StorageAdapter,
  StorageRequest,
  StorageResponse,
} from '../../../../src/client/js/storage/adapter';

describe('adapter type exports', () => {
  it('FileEntry type is usable as a value shape', () => {
    // Constructing a conformant object validates the type at compile time
    const entry: FileEntry = { filename: 'post.md', content: '# Hello' };
    expect(entry.filename).toBe('post.md');
    expect(entry.content).toBe('# Hello');
  });

  it('FileWrite type is usable as a value shape', () => {
    const write: FileWrite = {
      collection: 'posts',
      filename: 'post.md',
      content: '# Hello',
    };
    expect(write.collection).toBe('posts');
  });

  it('StorageAdapter interface shape has the expected method names', () => {
    // Verify the interface contract can be satisfied by a plain object
    const adapter: StorageAdapter = {
      listFiles: async () => [],
      readFile: async () => '',
      writeFile: async () => undefined,
      writeFiles: async () => undefined,
    };
    expect(typeof adapter.listFiles).toBe('function');
    expect(typeof adapter.readFile).toBe('function');
    expect(typeof adapter.writeFile).toBe('function');
    expect(typeof adapter.writeFiles).toBe('function');
  });

  it('StorageRequest union members resolve without type errors', () => {
    const init: StorageRequest = {
      type: 'init',
      backend: { type: 'github', token: 'tok', repo: 'owner/repo' },
    };
    const list: StorageRequest = { type: 'listFiles', collection: 'posts' };
    const read: StorageRequest = {
      type: 'readFile',
      collection: 'posts',
      filename: 'a.md',
    };
    const write: StorageRequest = {
      type: 'writeFile',
      collection: 'posts',
      filename: 'a.md',
      content: 'body',
    };
    const writeMany: StorageRequest = {
      type: 'writeFiles',
      files: [{ collection: 'posts', filename: 'a.md', content: 'body' }],
    };
    const teardown: StorageRequest = { type: 'teardown' };

    expect(init.type).toBe('init');
    expect(list.type).toBe('listFiles');
    expect(read.type).toBe('readFile');
    expect(write.type).toBe('writeFile');
    expect(writeMany.type).toBe('writeFiles');
    expect(teardown.type).toBe('teardown');
  });

  it('StorageResponse union members resolve without type errors', () => {
    const ok: StorageResponse = { type: 'init', ok: true };
    const fail: StorageResponse = {
      type: 'init',
      ok: false,
      error: 'bad token',
    };
    const portConn: StorageResponse = { type: 'port-connected' };

    expect(ok.type).toBe('init');
    expect(fail.ok).toBe(false);
    expect(portConn.type).toBe('port-connected');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';

//////////////////////////////
// FsaAdapter tests
//
// The File System Access API is not available in Node.js, so we build a
// minimal in-memory mock of FileSystemDirectoryHandle / FileSystemFileHandle
// that mirrors the FSA contract expected by FsaAdapter.
//////////////////////////////

import { FsaAdapter } from '../../../../src/client/js/storage/fsa';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Writable mock that stores text and returns it via text().
 */
interface MockFile {
  _content: string;
  text(): Promise<string>;
}

/**
 * Creates a minimal File mock.
 * @param {string} content - The file content
 * @return {MockFile} A mock File object
 */
function makeFile(content: string): MockFile {
  return {
    _content: content,
    text: async () => content,
  };
}

/**
 * Creates a mock FileSystemWritableFileStream.
 * @param {MockFileHandle} owner - The handle that owns this stream
 * @return {object} A mock writable stream
 */
function makeWritable(owner: MockFileHandle) {
  return {
    write: vi.fn(async (data: string) => {
      owner._content = data;
    }),
    close: vi.fn(async () => undefined),
  };
}

/**
 * Mock FileSystemFileHandle backed by an in-memory string.
 */
class MockFileHandle {
  kind = 'file' as const;
  _content: string;

  /**
   * @param {string} content - Initial file content
   */
  constructor(content = '') {
    this._content = content;
  }

  /**
   * Returns the mock File for this handle.
   * @return {Promise<MockFile>} The file object
   */
  async getFile(): Promise<MockFile> {
    return makeFile(this._content);
  }

  /**
   * Returns a writable stream for this handle.
   * @return {Promise<ReturnType<typeof makeWritable>>} The writable stream
   */
  async createWritable() {
    return makeWritable(this);
  }
}

/**
 * Builds a mock FileSystemDirectoryHandle that holds a flat map of name → entry.
 * @param {Record<string, MockFileHandle | MockDirHandle>} children - The directory's children
 * @return {MockDirHandle} A mock directory handle
 */
class MockDirHandle {
  kind = 'directory' as const;
  private children: Map<string, MockFileHandle | MockDirHandle>;

  /**
   * @param {Record<string, MockFileHandle | MockDirHandle>} entries - Initial children map
   */
  constructor(entries: Record<string, MockFileHandle | MockDirHandle> = {}) {
    this.children = new Map(Object.entries(entries));
  }

  /**
   * Returns a child directory handle by name.
   * @param {string} name - The directory name
   * @return {Promise<MockDirHandle>} The directory handle
   */
  async getDirectoryHandle(name: string): Promise<MockDirHandle> {
    const entry = this.children.get(name);
    if (!entry || entry.kind !== 'directory') {
      throw new DOMException(`${name} not found`, 'NotFoundError');
    }
    return entry as MockDirHandle;
  }

  /**
   * Returns a child file handle, optionally creating it.
   * @param {string} name - The file name
   * @param {{ create?: boolean }} options - Options object
   * @return {Promise<MockFileHandle>} The file handle
   */
  async getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<MockFileHandle> {
    if (!this.children.has(name)) {
      if (options?.create) {
        const newHandle = new MockFileHandle('');
        this.children.set(name, newHandle);
        return newHandle;
      }
      throw new DOMException(`${name} not found`, 'NotFoundError');
    }
    return this.children.get(name) as MockFileHandle;
  }

  /**
   * Removes a child entry by name.
   * @param {string} name - The entry name to remove
   * @return {Promise<void>}
   */
  async removeEntry(name: string): Promise<void> {
    if (!this.children.has(name)) {
      throw new DOMException(`${name} not found`, 'NotFoundError');
    }
    this.children.delete(name);
  }

  /**
   * Async generator that yields [name, entry] pairs for all children.
   * @return {AsyncIterable<[string, MockFileHandle | MockDirHandle]>}
   */
  async *entries(): AsyncIterable<[string, MockFileHandle | MockDirHandle]> {
    for (const [name, entry] of this.children) {
      yield [name, entry];
    }
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Builds a root handle pre-populated with src/content/posts containing
 * two .md files, one .mdx file, and a directory entry (to be skipped).
 * @return {MockDirHandle} The mock root handle
 */
function makeRoot(): MockDirHandle {
  const postsDir = new MockDirHandle({
    'hello.md': new MockFileHandle('---\ntitle: Hello\n---\n'),
    'world.md': new MockFileHandle('---\ntitle: World\n---\n'),
    'page.mdx': new MockFileHandle('---\ntitle: Page\n---\n'),
    subdir: new MockDirHandle(),
  });
  const contentDir = new MockDirHandle({ posts: postsDir });
  const srcDir = new MockDirHandle({ content: contentDir });
  return new MockDirHandle({ src: srcDir });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FsaAdapter', () => {
  let root: MockDirHandle;
  let adapter: FsaAdapter;

  beforeEach(() => {
    root = makeRoot();
    adapter = new FsaAdapter(root as unknown as FileSystemDirectoryHandle);
  });

  describe('listFiles', () => {
    it('returns all .md and .mdx files with their content', async () => {
      const files = await adapter.listFiles('posts', ['.md', '.mdx']);
      const names = files.map((f) => f.filename).sort();
      expect(names).toEqual(['hello.md', 'page.mdx', 'world.md']);
    });

    it('returns the correct content for each file', async () => {
      const files = await adapter.listFiles('posts', ['.md', '.mdx']);
      const hello = files.find((f) => f.filename === 'hello.md');
      expect(hello?.content).toBe('---\ntitle: Hello\n---\n');
    });

    it('skips directory entries', async () => {
      const files = await adapter.listFiles('posts', ['.md', '.mdx']);
      const names = files.map((f) => f.filename);
      expect(names).not.toContain('subdir');
    });

    it('returns an empty array for an empty collection directory', async () => {
      const emptyDir = new MockDirHandle();
      const contentDir = new MockDirHandle({ empty: emptyDir });
      const srcDir = new MockDirHandle({ content: contentDir });
      const emptyRoot = new MockDirHandle({ src: srcDir });
      const emptyAdapter = new FsaAdapter(
        emptyRoot as unknown as FileSystemDirectoryHandle,
      );
      const files = await emptyAdapter.listFiles('empty', ['.md', '.mdx']);
      expect(files).toEqual([]);
    });

    it('filters by the given extensions', async () => {
      const mdOnly = await adapter.listFiles('posts', ['.md']);
      const names = mdOnly.map((f) => f.filename).sort();
      expect(names).toEqual(['hello.md', 'world.md']);
      expect(names).not.toContain('page.mdx');
    });

    it('returns nothing when no files match the extensions', async () => {
      const files = await adapter.listFiles('posts', ['.yaml']);
      expect(files).toEqual([]);
    });
  });

  describe('readFile', () => {
    it('returns the file content for a known file', async () => {
      const content = await adapter.readFile('posts', 'hello.md');
      expect(content).toBe('---\ntitle: Hello\n---\n');
    });

    it('throws when the file does not exist', async () => {
      await expect(adapter.readFile('posts', 'missing.md')).rejects.toThrow();
    });
  });

  describe('writeFile', () => {
    it('writes content to an existing file', async () => {
      await adapter.writeFile('posts', 'hello.md', 'new content');
      const content = await adapter.readFile('posts', 'hello.md');
      expect(content).toBe('new content');
    });

    it('creates a new file when it does not exist', async () => {
      await adapter.writeFile('posts', 'brand-new.md', 'fresh content');
      const content = await adapter.readFile('posts', 'brand-new.md');
      expect(content).toBe('fresh content');
    });
  });

  describe('deleteFile', () => {
    it('removes an existing file from the collection', async () => {
      await adapter.deleteFile('posts', 'hello.md');
      const files = await adapter.listFiles('posts', ['.md', '.mdx']);
      const names = files.map((f) => f.filename);
      expect(names).not.toContain('hello.md');
    });

    it('throws when the file does not exist', async () => {
      await expect(
        adapter.deleteFile('posts', 'nonexistent.md'),
      ).rejects.toThrow();
    });
  });

  describe('writeFiles', () => {
    it('writes all files sequentially', async () => {
      await adapter.writeFiles([
        { collection: 'posts', filename: 'hello.md', content: 'updated hello' },
        { collection: 'posts', filename: 'world.md', content: 'updated world' },
      ]);
      const hello = await adapter.readFile('posts', 'hello.md');
      const world = await adapter.readFile('posts', 'world.md');
      expect(hello).toBe('updated hello');
      expect(world).toBe('updated world');
    });

    it('is a no-op for an empty array', async () => {
      // Should resolve without throwing
      await expect(adapter.writeFiles([])).resolves.toBeUndefined();
    });
  });
});

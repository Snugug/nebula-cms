import { vi } from 'vitest';
import type {
  FileEntry,
  FileWrite,
  StorageAdapter,
} from '../../../src/client/js/storage/adapter';

//////////////////////////////
// Sample content for pre-populated collections
//////////////////////////////

/** Sample posts used to pre-populate the mock adapter. */
const SAMPLE_POSTS: FileEntry[] = [
  {
    filename: 'hello-world.md',
    content: [
      '---',
      'title: Hello World',
      'published: 2024-01-15T10:00:00Z',
      'draft: false',
      '---',
      '',
      'Welcome to the blog. This is the first post.',
    ].join('\n'),
  },
  {
    filename: 'second-post.md',
    content: [
      '---',
      'title: Second Post',
      'published: 2024-02-20T14:30:00Z',
      'draft: false',
      '---',
      '',
      'This is the second post with more content.',
    ].join('\n'),
  },
  {
    filename: 'draft-ideas.md',
    content: [
      '---',
      'title: Draft Ideas',
      'published: 2024-03-01T09:00:00Z',
      'draft: true',
      '---',
      '',
      'Some ideas for future posts.',
    ].join('\n'),
  },
];

/** Sample pages for a second collection. */
const SAMPLE_PAGES: FileEntry[] = [
  {
    filename: 'about.md',
    content: ['---', 'title: About', '---', '', 'This is the about page.'].join(
      '\n',
    ),
  },
];

/**
 * Creates an in-memory StorageAdapter backed by a Map. Pre-populated with
 * sample "posts" and "pages" collections containing markdown files with
 * YAML frontmatter.
 * @return {{ adapter: StorageAdapter, store: Map<string, Map<string, string>> }} The adapter and its backing store for assertions
 */
export function createMockAdapter(): {
  adapter: StorageAdapter;
  store: Map<string, Map<string, string>>;
} {
  // Outer map: collection name -> inner map (filename -> content)
  const store = new Map<string, Map<string, string>>();

  // Pre-populate posts
  const postsMap = new Map<string, string>();
  for (const entry of SAMPLE_POSTS) {
    postsMap.set(entry.filename, entry.content);
  }
  store.set('posts', postsMap);

  // Pre-populate pages
  const pagesMap = new Map<string, string>();
  for (const entry of SAMPLE_PAGES) {
    pagesMap.set(entry.filename, entry.content);
  }
  store.set('pages', pagesMap);

  /**
   * Gets or creates the inner map for a collection.
   * @param {string} collection - The collection name
   * @return {Map<string, string>} The file map for the collection
   */
  function getCollection(collection: string): Map<string, string> {
    let col = store.get(collection);
    if (!col) {
      col = new Map<string, string>();
      store.set(collection, col);
    }
    return col;
  }

  const adapter: StorageAdapter = {
    listFiles: vi.fn(
      async (
        collection: string,
        extensions: string[],
      ): Promise<FileEntry[]> => {
        const col = store.get(collection);
        if (!col) return [];
        return Array.from(col.entries())
          .filter(([filename]) =>
            extensions.some((ext) => filename.endsWith(ext)),
          )
          .map(([filename, content]) => ({
            filename,
            content,
          }));
      },
    ),

    readFile: vi.fn(
      async (collection: string, filename: string): Promise<string> => {
        const col = store.get(collection);
        if (!col) throw new Error(`Collection "${collection}" not found`);
        const content = col.get(filename);
        if (content === undefined)
          throw new Error(`File "${filename}" not found in "${collection}"`);
        return content;
      },
    ),

    writeFile: vi.fn(
      async (
        collection: string,
        filename: string,
        content: string,
      ): Promise<void> => {
        const col = getCollection(collection);
        col.set(filename, content);
      },
    ),

    writeFiles: vi.fn(async (files: FileWrite[]): Promise<void> => {
      for (const file of files) {
        const col = getCollection(file.collection);
        col.set(file.filename, file.content);
      }
    }),

    deleteFile: vi.fn(
      async (collection: string, filename: string): Promise<void> => {
        const col = store.get(collection);
        if (!col) throw new Error(`Collection "${collection}" not found`);
        if (!col.has(filename))
          throw new Error(`File "${filename}" not found in "${collection}"`);
        col.delete(filename);
      },
    ),
  };

  return { adapter, store };
}

/** Exported sample data for test assertions. */
export { SAMPLE_POSTS, SAMPLE_PAGES };

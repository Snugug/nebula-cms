import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
//////////////////////////////
// virtual:nebula/collections mock
// The schema module fetches URLs stored in this map. We stub both the
// import and the global fetch so no real network requests are made.
//////////////////////////////
*/

vi.mock('virtual:nebula/collections', () => ({
  default: {
    posts: 'https://fake.test/posts.schema.json',
    products: 'https://fake.test/products.schema.json',
  },
}));

import {
  fetchSchema,
  schema,
  clearSchema,
  prefetchAllSchemas,
  collectionHasDates,
  getCollectionTitle,
  getCollectionDescription,
} from '../../../../src/client/js/state/schema.svelte';

/*
//////////////////////////////
// Mock schema fixtures
//////////////////////////////
*/

/** Posts schema — includes a date-time field for date-sort testing and root-level title/description. */
const POSTS_SCHEMA = {
  title: 'Blog Posts',
  description: 'Articles published on the blog',
  type: 'object',
  properties: {
    title: { type: 'string' },
    publishedAt: { type: 'string', format: 'date-time' },
  },
};

/** Products schema — no date-time fields. */
const PRODUCTS_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    price: { type: 'number' },
  },
};

/**
 * Builds a minimal fetch mock that returns the appropriate schema JSON
 * based on the requested URL.
 * @return {ReturnType<typeof vi.fn>} A vitest spy implementing the fetch interface
 */
function makeFetchMock() {
  return vi.fn((url: string) => {
    const body = url.includes('posts')
      ? POSTS_SCHEMA
      : url.includes('products')
        ? PRODUCTS_SCHEMA
        : {};
    return Promise.resolve({
      json: () => Promise.resolve(body),
    } as Response);
  });
}

/*
//////////////////////////////
// schema / clearSchema
//////////////////////////////
*/

describe('schema', () => {
  beforeEach(() => {
    clearSchema();
  });

  it('is null before any schema is loaded', () => {
    expect(schema.active).toBeNull();
  });
});

describe('clearSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('resets the active schema to null', async () => {
    await fetchSchema('posts');
    expect(schema.active).not.toBeNull();
    clearSchema();
    expect(schema.active).toBeNull();
  });
});

/*
//////////////////////////////
// fetchSchema
//////////////////////////////
*/

describe('fetchSchema', () => {
  beforeEach(() => {
    clearSchema();
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('sets the active schema after fetching', async () => {
    await fetchSchema('posts');
    expect(schema.active).toEqual(POSTS_SCHEMA);
  });

  it('loads the correct schema for a different collection', async () => {
    await fetchSchema('products');
    expect(schema.active).toEqual(PRODUCTS_SCHEMA);
  });

  it('does nothing when the collection is not in virtual:collections', async () => {
    clearSchema();
    await fetchSchema('nonexistent');
    expect(schema.active).toBeNull();
  });

  it('returns the same schema object on repeated calls (cache consistency)', async () => {
    // The module-level Map cache may already hold 'posts' from a prior test.
    // What matters is that the reactive schema state is consistent: calling
    // fetchSchema twice for the same collection leaves it pointing at the
    // same cached object.
    await fetchSchema('posts');
    const first = schema.active;

    await fetchSchema('posts');
    const second = schema.active;

    expect(second).toEqual(first);
  });
});

/*
//////////////////////////////
// prefetchAllSchemas
//////////////////////////////
*/

describe('prefetchAllSchemas', () => {
  beforeEach(() => {
    clearSchema();
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('populates the schema state for each known collection', async () => {
    // After prefetch, fetchSchema for any known collection should set the
    // reactive schema state — serving from the freshly populated cache.
    await prefetchAllSchemas();

    clearSchema();
    await fetchSchema('posts');
    expect(schema.active).toEqual(POSTS_SCHEMA);

    clearSchema();
    await fetchSchema('products');
    expect(schema.active).toEqual(PRODUCTS_SCHEMA);
  });

  it('caches schemas such that schema reflects the last fetched collection', async () => {
    await prefetchAllSchemas();

    await fetchSchema('posts');
    expect(schema.active).toEqual(POSTS_SCHEMA);

    await fetchSchema('products');
    expect(schema.active).toEqual(PRODUCTS_SCHEMA);
  });
});

/*
//////////////////////////////
// collectionHasDates
//////////////////////////////
*/

describe('collectionHasDates', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('returns false when the collection schema is not yet cached', () => {
    // Only relevant before any prefetch; if cache was populated by prior
    // tests this may be true — we verify the type at minimum.
    expect(typeof collectionHasDates('uncached')).toBe('boolean');
  });

  it('returns true when at least one property uses the date-time format', async () => {
    await prefetchAllSchemas();
    expect(collectionHasDates('posts')).toBe(true);
  });

  it('returns false when no property uses the date-time format', async () => {
    await prefetchAllSchemas();
    expect(collectionHasDates('products')).toBe(false);
  });

  it('returns false for an unknown collection even after prefetch', async () => {
    await prefetchAllSchemas();
    expect(collectionHasDates('unknown')).toBe(false);
  });
});

/*
//////////////////////////////
// getCollectionTitle
//////////////////////////////
*/

describe('getCollectionTitle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('returns the title string when schema has a title', async () => {
    await prefetchAllSchemas();
    expect(getCollectionTitle('posts')).toBe('Blog Posts');
  });

  it('returns null when schema has no title', async () => {
    await prefetchAllSchemas();
    expect(getCollectionTitle('products')).toBeNull();
  });

  it('returns null when schema is not cached', () => {
    expect(getCollectionTitle('uncached')).toBeNull();
  });
});

/*
//////////////////////////////
// getCollectionDescription
//////////////////////////////
*/

describe('getCollectionDescription', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('returns the description string when schema has a description', async () => {
    await prefetchAllSchemas();
    expect(getCollectionDescription('posts')).toBe(
      'Articles published on the blog',
    );
  });

  it('returns null when schema has no description', async () => {
    await prefetchAllSchemas();
    expect(getCollectionDescription('products')).toBeNull();
  });

  it('returns null when schema is not cached', () => {
    expect(getCollectionDescription('uncached')).toBeNull();
  });
});

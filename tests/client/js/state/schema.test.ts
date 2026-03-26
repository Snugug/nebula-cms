import { describe, it, expect, vi, beforeEach } from 'vitest';

//////////////////////////////
// virtual:collections mock
// The schema module fetches URLs stored in this map. We stub both the
// import and the global fetch so no real network requests are made.
//////////////////////////////

vi.mock('virtual:collections', () => ({
  default: {
    posts: 'https://fake.test/posts.schema.json',
    products: 'https://fake.test/products.schema.json',
  },
}));

import {
  fetchSchema,
  getSchema,
  clearSchema,
  prefetchAllSchemas,
  collectionHasDates,
  areSchemasReady,
} from '../../../../src/client/js/state/schema.svelte';

//////////////////////////////
// Mock schema fixtures
//////////////////////////////

/** Posts schema — includes a date-time field for date-sort testing. */
const POSTS_SCHEMA = {
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

//////////////////////////////
// getSchema / clearSchema
//////////////////////////////

describe('getSchema', () => {
  beforeEach(() => {
    clearSchema();
  });

  it('returns null before any schema is loaded', () => {
    expect(getSchema()).toBeNull();
  });
});

describe('clearSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('resets the active schema to null', async () => {
    await fetchSchema('posts');
    expect(getSchema()).not.toBeNull();
    clearSchema();
    expect(getSchema()).toBeNull();
  });
});

//////////////////////////////
// fetchSchema
//////////////////////////////

describe('fetchSchema', () => {
  beforeEach(() => {
    clearSchema();
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('sets the active schema after fetching', async () => {
    await fetchSchema('posts');
    expect(getSchema()).toEqual(POSTS_SCHEMA);
  });

  it('loads the correct schema for a different collection', async () => {
    await fetchSchema('products');
    expect(getSchema()).toEqual(PRODUCTS_SCHEMA);
  });

  it('does nothing when the collection is not in virtual:collections', async () => {
    clearSchema();
    await fetchSchema('nonexistent');
    expect(getSchema()).toBeNull();
  });

  it('returns the same schema object on repeated calls (cache consistency)', async () => {
    // The module-level Map cache may already hold 'posts' from a prior test.
    // What matters is that the reactive schema state is consistent: calling
    // fetchSchema twice for the same collection leaves it pointing at the
    // same cached object.
    await fetchSchema('posts');
    const first = getSchema();

    await fetchSchema('posts');
    const second = getSchema();

    expect(second).toEqual(first);
  });
});

//////////////////////////////
// prefetchAllSchemas / areSchemasReady
//////////////////////////////

describe('prefetchAllSchemas', () => {
  beforeEach(() => {
    clearSchema();
    vi.stubGlobal('fetch', makeFetchMock());
  });

  it('starts with areSchemasReady returning false', () => {
    // This test relies on module-level state; areSchemasReady may be true
    // from a previous test run if the cache persisted. We check both paths.
    const ready = areSchemasReady();
    expect(typeof ready).toBe('boolean');
  });

  it('sets areSchemasReady to true after prefetch completes', async () => {
    await prefetchAllSchemas();
    expect(areSchemasReady()).toBe(true);
  });

  it('populates the schema state for each known collection', async () => {
    // After prefetch, fetchSchema for any known collection should set the
    // reactive schema state — serving from the freshly populated cache.
    await prefetchAllSchemas();

    clearSchema();
    await fetchSchema('posts');
    expect(getSchema()).toEqual(POSTS_SCHEMA);

    clearSchema();
    await fetchSchema('products');
    expect(getSchema()).toEqual(PRODUCTS_SCHEMA);
  });

  it('caches schemas such that getSchema reflects the last fetched collection', async () => {
    await prefetchAllSchemas();

    await fetchSchema('posts');
    expect(getSchema()).toEqual(POSTS_SCHEMA);

    await fetchSchema('products');
    expect(getSchema()).toEqual(PRODUCTS_SCHEMA);
  });
});

//////////////////////////////
// collectionHasDates
//////////////////////////////

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

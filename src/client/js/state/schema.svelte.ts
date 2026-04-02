import schemas from 'virtual:collections';
import { getExtensionsForSchema } from '../utils/file-types';

// JSON Schema object type.
type JsonSchema = Record<string, unknown>;

// Cache of fetched schemas keyed by collection name
const cache = new Map<string, JsonSchema>();

// Currently active schema for the selected collection
let activeSchema = $state<JsonSchema | null>(null);

export const schema = {
  // The loaded JSON Schema for the active collection, or null.
  get active(): JsonSchema | null {
    return activeSchema;
  },
};

/**
 * Fetches all collection schemas in parallel and caches them.
 * Call once on app startup so schema-derived state is available before the first collection renders.
 * @return {Promise<void>}
 */
export async function prefetchAllSchemas(): Promise<void> {
  const entries = Object.entries(schemas);
  const results = await Promise.all(
    entries.map(async ([name, url]) => {
      const response = await fetch(url);
      const data = (await response.json()) as JsonSchema;
      return [name, data] as const;
    }),
  );
  for (const [name, data] of results) {
    cache.set(name, data);
  }
}

/**
 * Fetches and caches the JSON Schema for a collection, then sets the reactive schema state.
 * @param {string} collection - The collection name to fetch the schema for
 * @return {Promise<void>}
 */
export async function fetchSchema(collection: string): Promise<void> {
  const cached = cache.get(collection);
  if (cached) {
    activeSchema = cached;
    return;
  }

  const url = schemas[collection];
  if (!url) return;

  const response = await fetch(url);
  const data = (await response.json()) as JsonSchema;
  cache.set(collection, data);
  activeSchema = data;
}

/**
 * Returns true if the collection's schema has a date-time property, indicating it supports date-based sorting.
 * Requires prefetchAllSchemas to have been called; returns false if the schema isn't cached yet.
 * @param {string} collection - The collection name to check
 * @return {boolean} True if any property in the schema uses the date-time format
 */
export function collectionHasDates(collection: string): boolean {
  const s = cache.get(collection);
  if (!s) return false;
  const props = s['properties'] as Record<string, JsonSchema> | undefined;
  if (!props) return false;
  return Object.values(props).some((p) => p['format'] === 'date-time');
}

/**
 * Reads a top-level string field from a collection's cached schema.
 * Returns null if the schema isn't cached or the field is absent/non-string.
 * @param {string} collection - The collection name
 * @param {string} field - The schema field to read (e.g. 'title', 'description')
 * @return {string | null} The field value, or null
 */
function getStringField(collection: string, field: string): string | null {
  const s = cache.get(collection);
  if (!s) return null;
  const value = s[field];
  return typeof value === 'string' ? value : null;
}

/**
 * Returns the display title for a collection from its cached schema.
 * Returns null if the schema hasn't been fetched or has no title.
 * @param {string} collection - The collection name
 * @return {string | null} The schema title, or null
 */
export function getCollectionTitle(collection: string): string | null {
  return getStringField(collection, 'title');
}

/**
 * Returns the description for a collection from its cached schema.
 * Returns null if the schema hasn't been fetched or has no description.
 * @param {string} collection - The collection name
 * @return {string | null} The schema description, or null
 */
export function getCollectionDescription(collection: string): string | null {
  return getStringField(collection, 'description');
}

/*
 * Known race condition: if a caller invokes getSchemaExtensions before
 * prefetchAllSchemas() has completed, the schema won't be cached yet and the
 * fallback is returned. The caller (dispatchWorker in state.svelte.ts)
 * mitigates this by awaiting initPromise, which includes prefetchAllSchemas().
 * If the ordering changes, callers should await prefetchAllSchemas() first.
 */

/**
 * Returns the resolved file extensions for a collection from its cached schema.
 * Falls back to ['.md', '.mdx'] if the schema hasn't been fetched or declares no files.
 * @param {string} collection - The collection name
 * @return {string[]} Array of file extensions
 */
export function getSchemaExtensions(collection: string): string[] {
  const s = cache.get(collection);
  if (!s) return ['.md', '.mdx'];
  const extensions = getExtensionsForSchema(s);
  return extensions.length > 0 ? extensions : ['.md', '.mdx'];
}

/**
 * Clears the active schema.
 * @return {void}
 */
export function clearSchema(): void {
  activeSchema = null;
}

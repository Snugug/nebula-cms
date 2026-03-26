// Database name for admin CMS persistence
const DB_NAME = 'cms-admin';
// Current database version — bumped from 1 to add the drafts store
const DB_VERSION = 2;

// Cached database promise — opened once, reused by all callers
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Opens (or returns the cached) shared IndexedDB database, creating or upgrading stores as needed.
 * The connection is opened once and reused, avoiding a new indexedDB.open() round-trip per call.
 * Version 1: handles store only. Version 2: adds drafts store.
 * @return {Promise<IDBDatabase>} Promise resolving to the database instance
 */
export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      // Reset cache so the next caller retries instead of getting a stale rejection
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

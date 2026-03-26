import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';

//////////////////////////////
// openDB tests
//
// Uses fake-indexeddb (polyfilled via the setup file) to exercise the
// actual IDB open/upgrade logic in a Node.js environment.
//////////////////////////////

import { openDB } from '../../../../src/client/js/storage/db';

describe('openDB', () => {
  it('resolves to an IDBDatabase instance', async () => {
    const db = await openDB();
    expect(db).toBeDefined();
    expect(typeof db.transaction).toBe('function');
  });

  it('creates a "handles" object store', async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains('handles')).toBe(true);
  });

  it('creates a "drafts" object store', async () => {
    const db = await openDB();
    expect(db.objectStoreNames.contains('drafts')).toBe(true);
  });

  it('returns a usable database that can perform readwrite transactions on "handles"', async () => {
    const db = await openDB();
    // A successful transaction confirms the store was created with correct configuration
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put({ test: true }, 'probe-key');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });

  it('returns a usable database that can perform readwrite transactions on "drafts"', async () => {
    const db = await openDB();
    // The drafts store uses { keyPath: 'id' }, so the object must include an id field
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put({ id: 'probe-draft', data: 'x' });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  });

  it('subsequent calls return a database with the same stores', async () => {
    const db1 = await openDB();
    const db2 = await openDB();
    expect(db2.objectStoreNames.contains('handles')).toBe(true);
    expect(db2.objectStoreNames.contains('drafts')).toBe(true);
    db1.close();
    db2.close();
  });
});

import { describe, it, expect } from 'vitest';

//////////////////////////////
// IDB backend persistence tests
//
// Uses fake-indexeddb (polyfilled via the setup file) to exercise the
// actual IDB read/write logic without a browser. The FileSystemDirectoryHandle
// type is unavailable in Node.js, so FSA tests use a plain object cast —
// fake-indexeddb stores arbitrary values without type enforcement.
//////////////////////////////

import {
  saveBackend,
  loadBackend,
  clearBackend,
} from '../../../../src/client/js/storage/storage';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('saveBackend / loadBackend', () => {
  it('persists a github backend config and retrieves it', async () => {
    const config = {
      type: 'github' as const,
      token: 'tok',
      repo: 'owner/repo',
    };
    await saveBackend(config);
    const result = await loadBackend();
    expect(result).toEqual(config);
  });

  it('persists an fsa backend config and retrieves it', async () => {
    // Use a plain object cast — fake-indexeddb doesn't enforce the actual type
    const fakeHandle = { kind: 'directory', name: 'root' };
    const config = {
      type: 'fsa' as const,
      handle: fakeHandle as unknown as FileSystemDirectoryHandle,
    };
    await saveBackend(config);
    const result = await loadBackend();
    expect(result?.type).toBe('fsa');
  });

  it('overwrites a previous config when called again', async () => {
    const first = { type: 'github' as const, token: 'first', repo: 'o/r' };
    const second = { type: 'github' as const, token: 'second', repo: 'o/r' };
    await saveBackend(first);
    await saveBackend(second);
    const result = await loadBackend();
    expect((result as typeof second).token).toBe('second');
  });
});

describe('loadBackend', () => {
  it('returns null when no backend has been saved', async () => {
    // Clear any state from previous tests
    await clearBackend();
    const result = await loadBackend();
    expect(result).toBeNull();
  });
});

describe('clearBackend', () => {
  it('removes the stored config so loadBackend returns null', async () => {
    const config = { type: 'github' as const, token: 'tok', repo: 'o/r' };
    await saveBackend(config);
    await clearBackend();
    const result = await loadBackend();
    expect(result).toBeNull();
  });

  it('is safe to call when no config is stored', async () => {
    await clearBackend();
    // Calling again should not throw
    await expect(clearBackend()).resolves.toBeUndefined();
  });
});

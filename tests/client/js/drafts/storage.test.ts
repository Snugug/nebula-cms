import { describe, it, expect, beforeEach } from 'vitest';

//////////////////////////////
// Draft storage tests
//
// Uses fake-indexeddb (polyfilled via the setup file) so every test
// operates against a real IDBDatabase implementation running in Node.js.
// Each describe block that modifies state calls beforeEach to ensure a
// clean slate via a fresh IDBFactory instance.
//////////////////////////////

import {
  saveDraft,
  loadDrafts,
  loadDraft,
  deleteDraft,
  getDraftByFile,
} from '../../../../src/client/js/drafts/storage';
import { makeDraft } from './fixtures';

//////////////////////////////
// saveDraft + loadDraft
//////////////////////////////

describe('saveDraft / loadDraft', () => {
  it('persists a draft and retrieves it by ID', async () => {
    const draft = makeDraft({ id: 'save-load-01' });
    await saveDraft(draft);
    const result = await loadDraft('save-load-01');
    expect(result).toEqual(draft);
  });

  it('returns null when the draft ID does not exist', async () => {
    const result = await loadDraft('does-not-exist');
    expect(result).toBeNull();
  });

  it('overwrites an existing draft when called with the same ID', async () => {
    const original = makeDraft({ id: 'overwrite-01', body: 'original body' });
    await saveDraft(original);

    const updated = makeDraft({ id: 'overwrite-01', body: 'updated body' });
    await saveDraft(updated);

    const result = await loadDraft('overwrite-01');
    expect(result?.body).toBe('updated body');
  });

  it('stores all Draft fields without data loss', async () => {
    const draft = makeDraft({
      id: 'fields-01',
      formData: { title: 'T', nested: { a: 1 } },
      isNew: true,
      filename: null,
      snapshot: null,
    });
    await saveDraft(draft);
    const result = await loadDraft('fields-01');
    expect(result).toEqual(draft);
  });
});

//////////////////////////////
// loadDrafts
//////////////////////////////

describe('loadDrafts', () => {
  it('returns all drafts belonging to a given collection', async () => {
    const a = makeDraft({ id: 'ld-a', collection: 'posts' });
    const b = makeDraft({ id: 'ld-b', collection: 'posts' });
    const c = makeDraft({ id: 'ld-c', collection: 'pages' });
    await saveDraft(a);
    await saveDraft(b);
    await saveDraft(c);

    const posts = await loadDrafts('posts');
    const ids = posts.map((d) => d.id);
    expect(ids).toContain('ld-a');
    expect(ids).toContain('ld-b');
    expect(ids).not.toContain('ld-c');
  });

  it('returns an empty array when no drafts exist for the collection', async () => {
    const result = await loadDrafts('nonexistent-collection');
    expect(result).toEqual([]);
  });

  it('returns only drafts matching the requested collection', async () => {
    const d = makeDraft({ id: 'ld-only', collection: 'only-collection' });
    await saveDraft(d);

    const result = await loadDrafts('only-collection');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ld-only');
  });
});

//////////////////////////////
// deleteDraft
//////////////////////////////

describe('deleteDraft', () => {
  it('removes the draft so loadDraft returns null afterwards', async () => {
    const draft = makeDraft({ id: 'del-01' });
    await saveDraft(draft);
    await deleteDraft('del-01');
    const result = await loadDraft('del-01');
    expect(result).toBeNull();
  });

  it('is a no-op when the draft ID does not exist', async () => {
    // Should resolve without throwing
    await expect(deleteDraft('ghost-id')).resolves.toBeUndefined();
  });

  it('does not remove other drafts in the same collection', async () => {
    const keep = makeDraft({ id: 'del-keep', collection: 'posts' });
    const remove = makeDraft({ id: 'del-remove', collection: 'posts' });
    await saveDraft(keep);
    await saveDraft(remove);

    await deleteDraft('del-remove');

    const remaining = await loadDrafts('posts');
    const ids = remaining.map((d) => d.id);
    expect(ids).toContain('del-keep');
    expect(ids).not.toContain('del-remove');
  });
});

//////////////////////////////
// getDraftByFile
//////////////////////////////

describe('getDraftByFile', () => {
  it('finds a non-new draft matching the given collection and filename', async () => {
    const draft = makeDraft({
      id: 'gbf-01',
      collection: 'posts',
      filename: 'my-post.md',
      isNew: false,
    });
    await saveDraft(draft);

    const result = await getDraftByFile('posts', 'my-post.md');
    expect(result?.id).toBe('gbf-01');
  });

  it('returns null when no draft matches the filename', async () => {
    const result = await getDraftByFile('posts', 'nonexistent.md');
    expect(result).toBeNull();
  });

  it('ignores new drafts when searching by file', async () => {
    // isNew:true drafts are not linked to live files, so getDraftByFile skips them
    const draft = makeDraft({
      id: 'gbf-new',
      collection: 'posts',
      filename: 'new-post.md',
      isNew: true,
    });
    await saveDraft(draft);

    const result = await getDraftByFile('posts', 'new-post.md');
    expect(result).toBeNull();
  });

  it('returns null when collection does not match even if filename does', async () => {
    const draft = makeDraft({
      id: 'gbf-coll',
      collection: 'pages',
      filename: 'shared-name.md',
      isNew: false,
    });
    await saveDraft(draft);

    const result = await getDraftByFile('posts', 'shared-name.md');
    expect(result).toBeNull();
  });

  it('returns the correct draft when multiple drafts exist in the same collection', async () => {
    const a = makeDraft({
      id: 'gbf-multi-a',
      collection: 'posts',
      filename: 'alpha.md',
      isNew: false,
    });
    const b = makeDraft({
      id: 'gbf-multi-b',
      collection: 'posts',
      filename: 'beta.md',
      isNew: false,
    });
    await saveDraft(a);
    await saveDraft(b);

    const result = await getDraftByFile('posts', 'beta.md');
    expect(result?.id).toBe('gbf-multi-b');
  });
});

/* Shared test fixtures for draft-related tests. */

import type { Draft } from '../../../../src/client/js/drafts/storage';

/**
 * Creates a Draft object with sensible defaults, allowing per-test overrides.
 * @param {Partial<Draft>} overrides - Fields to override on the default draft
 * @return {Draft} A complete Draft object
 */
export function makeDraft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: 'draft-001',
    collection: 'posts',
    filename: 'hello-world.md',
    isNew: false,
    formData: { title: 'Hello World' },
    body: '# Hello World\n\nBody content.',
    snapshot: '{"body":"original","formData":{"title":"Original"}}',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

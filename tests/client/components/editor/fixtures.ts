/* Shared test fixtures for editor component tests. */

/**
 * Builds a minimal EditorFile fixture with sensible defaults.
 * @param {Partial<Record<string, unknown>>} overrides - Fields to override on the default file
 * @return {Record<string, unknown>} A minimal EditorFile-like object
 */
export function makeEditorFile(
  overrides: Partial<{
    filename: string;
    dirty: boolean;
    saving: boolean;
    draftId: string | null;
    formData: Record<string, unknown>;
    body: string;
    bodyLoaded: boolean;
    isNewDraft: boolean;
  }> = {},
) {
  return {
    filename: 'my-post.md',
    dirty: false,
    saving: false,
    draftId: null,
    formData: {},
    body: '',
    bodyLoaded: true,
    isNewDraft: false,
    ...overrides,
  };
}

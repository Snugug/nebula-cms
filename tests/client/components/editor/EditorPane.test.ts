import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import EditorPane from '../../../../src/client/components/editor/EditorPane.svelte';
import { makeEditorFile } from './fixtures';

/**
 * Tests for the EditorPane component.
 * Full editing behaviour (CodeMirror interactions, live text changes) is deferred to E2E tests.
 * These tests verify that the component mounts and unmounts without error under
 * common file states, and that the expected container elements are present in the DOM.
 *
 * @codemirror/* and @lezer/* imports are redirected to tests/stubs/codemirror.ts
 * via the resolve.alias setting in vitest.config.ts (components project), so no
 * explicit vi.mock calls are needed for those packages.
 *
 * editor.svelte is mocked to avoid Svelte 5 rune initialization in jsdom.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run.
const { mockGetEditorFile } = vi.hoisted(() => ({
  mockGetEditorFile: vi.fn(() => null),
}));

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  getEditorFile: mockGetEditorFile,
  updateBody: vi.fn(),
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('EditorPane', () => {
  /*
  //////////////////////////////
  // DOM structure
  //////////////////////////////
  */

  it('renders the outer wrapper element', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { container } = render(EditorPane, { props: {} });
    expect(container.querySelector('.editor-wrapper')).not.toBeNull();
  });

  it('renders the editor box element', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { container } = render(EditorPane, { props: {} });
    expect(container.querySelector('.editor-box')).not.toBeNull();
  });

  it('renders the editor pane container element', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { container } = render(EditorPane, { props: {} });
    expect(container.querySelector('.editor-pane')).not.toBeNull();
  });

  /*
  //////////////////////////////
  // Mount/unmount without error
  //////////////////////////////
  */

  it('mounts without error when no file is open', () => {
    mockGetEditorFile.mockReturnValue(null);

    expect(() => render(EditorPane, { props: {} })).not.toThrow();
  });

  it('mounts without error when a file with body is open', () => {
    mockGetEditorFile.mockReturnValue(
      makeEditorFile({ body: '# Hello', filename: 'post.md' }),
    );

    expect(() => render(EditorPane, { props: {} })).not.toThrow();
  });

  it('mounts without error when body is not yet loaded', () => {
    mockGetEditorFile.mockReturnValue(
      makeEditorFile({ bodyLoaded: false, filename: 'post.md' }),
    );

    expect(() => render(EditorPane, { props: {} })).not.toThrow();
  });

  it('unmounts without error', () => {
    mockGetEditorFile.mockReturnValue(null);

    const { unmount } = render(EditorPane, { props: {} });
    expect(() => unmount()).not.toThrow();
  });
});

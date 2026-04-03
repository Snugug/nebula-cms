<script lang="ts">
  /*
   * CodeMirror editor pane with language compartment and toolbar.
   * Renders the EditorBodyToolbar above the CodeMirror mount point and
   * uses a Compartment to swap the language extension at runtime when
   * the file type changes (e.g. switching from .md to .mdx).
   */
  import { EditorView, keymap } from '@codemirror/view';
  import { Compartment, EditorState } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { getEditorFile, updateBody } from '../../js/editor/editor.svelte';
  import {
    getTypeForFilename,
    stripExtension,
  } from '../../js/utils/file-types';
  import { getLanguageExtension } from '../../js/editor/languages';
  import { linkWrapPlugin } from '../../js/editor/link-wrap';
  import {
    markdownShortcutsKeymap,
    markdownShortcutsExtensions,
  } from '../../js/editor/markdown-shortcuts';
  import EditorBodyToolbar from './EditorBodyToolbar.svelte';

  // Container element for CodeMirror
  let container: HTMLDivElement;
  // The CodeMirror EditorView instance
  let view: EditorView | undefined;
  // Compartment isolating the language extension for runtime reconfiguration
  const langCompartment = new Compartment();

  // Base editor theme matching the admin color scheme
  const editorTheme = EditorView.theme({
    '&': {
      fontSize: '1rem',
    },
    '.cm-content': {
      fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      caretColor: 'var(--editor-caret)',
      padding: '1rem',
    },
    '.cm-scroller': {
      overflow: 'auto',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-line': {
      padding: '0 0.25rem',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--editor-caret)',
    },
    '.cm-selectionBackground': {
      background: 'var(--plum) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      background: 'var(--plum) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--editor-active-line)',
    },
    '.cm-gutters': {
      display: 'none',
    },
  });

  /**
   * Creates the full set of CodeMirror extensions. The language extension
   * is wrapped in a Compartment so it can be swapped at runtime without
   * rebuilding the entire editor state.
   * @param {string} fileType - The file type identifier for language selection
   * @return {import('@codemirror/state').Extension[]} The array of CodeMirror extensions
   */
  function createExtensions(fileType: string) {
    return [
      editorTheme,
      history(),
      keymap.of([
        ...markdownShortcutsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      langCompartment.of(getLanguageExtension(fileType)),
      EditorView.lineWrapping,
      linkWrapPlugin,
      ...markdownShortcutsExtensions,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          updateBody(update.state.doc.toString());
        }
      }),
      EditorView.contentAttributes.of({ 'aria-label': 'Content editor' }),
    ];
  }

  // Track the last loaded file identity to detect file changes
  let lastFileKey = '';
  // Track the last configured language type to avoid redundant compartment reconfigures
  let lastLangType = '';

  $effect(() => {
    const file = getEditorFile();

    if (!file) {
      // No file open — destroy editor if it exists
      if (view) {
        view.destroy();
        view = undefined;
        lastFileKey = '';
      }
      return;
    }

    // Wait for body to load before creating/updating CodeMirror
    if (!file.bodyLoaded) return;

    // Use slug (without extension) so format changes don't trigger a rebuild
    const fileKey = file.draftId ?? stripExtension(file.filename);

    if (!view && container) {
      // First mount — create the editor
      const fileType = getTypeForFilename(file.filename) ?? 'md';
      lastFileKey = fileKey;
      lastLangType = fileType;
      const state = EditorState.create({
        doc: file.body,
        extensions: createExtensions(fileType),
      });
      view = new EditorView({ state, parent: container });
    } else if (view && fileKey !== lastFileKey) {
      // Different file selected — replace document
      const fileType = getTypeForFilename(file.filename) ?? 'md';
      lastFileKey = fileKey;
      lastLangType = fileType;
      view.setState(
        EditorState.create({
          doc: file.body,
          extensions: createExtensions(fileType),
        }),
      );
    }
  });

  // Reconfigure the language compartment when the file type changes
  $effect(() => {
    if (!view) return;
    const file = getEditorFile();
    if (!file?.filename) return;
    const fileType = getTypeForFilename(file.filename) ?? 'md';
    // Skip if the language is already configured (avoids redundant reconfigure on initial mount)
    if (fileType === lastLangType) return;
    lastLangType = fileType;
    view.dispatch({
      effects: langCompartment.reconfigure(getLanguageExtension(fileType)),
    });
  });

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      view?.destroy();
      view = undefined;
    };
  });
</script>

<div class="editor-wrapper">
  <div class="editor-box">
    <EditorBodyToolbar />
    <div class="editor-pane" bind:this={container}></div>
  </div>
</div>

<style>
  .editor-wrapper {
    padding: 1.5rem;
    max-width: 80ch;
    margin: 0 auto;
  }

  .editor-box {
    display: grid;
    grid-template-rows: auto 1fr;
    border: 1px solid var(--cms-border);
    border-radius: 4px;
    overflow: hidden;
    /* Subtract the toolbar, tabs, and wrapper padding from viewport height */
    height: calc(100dvh - 9rem);
  }

  .editor-pane {
    height: 100%;
    overflow: auto;
  }

  /*
   * Fill the entire editor box so clicking anywhere starts editing, even on empty documents.
   * cm-editor uses display:flex column by default — min-height stretches the container,
   * and flex-grow on cm-scroller makes the scrollable/clickable area fill it.
   */
  .editor-pane :global(.cm-editor) {
    min-height: 100%;
  }

  .editor-pane :global(.cm-scroller) {
    flex-grow: 1;
    /*
     * CodeMirror sets align-items: flex-start which prevents cm-content from stretching
     * vertically. Override to stretch so the editable area fills the entire scroller.
     */
    align-items: stretch !important;
  }

  /*
   * Forces .cm-content to shrink below its longest word so overflow-wrap can break long URLs.
   * min-height fills the scroller so the entire editor area is clickable on empty documents.
   * Both need !important to override CodeMirror's inline theme styles.
   */
  .editor-pane :global(.cm-content) {
    min-width: 0 !important;
    min-height: 100% !important;
  }

  /* Wraps long URLs at word boundaries where possible, breaking mid-word only when necessary */
  .editor-pane :global(.cm-link-wrap) {
    overflow-wrap: break-word;
    word-break: break-all;
  }

  .editor-pane :global(.cm-link-wrap span:nth-of-type(2)) {
    word-break: break-word;
  }
</style>

/**
 * Stub module for all @codemirror/* and @lezer/* imports used in the component test environment.
 * These packages are runtime-only dependencies not installed as devDependencies.
 * The vitest.config.ts components project redirects every @codemirror/* and @lezer/*
 * specifier here so EditorPane can be imported without resolution failures.
 */

/**
 * Noop class standing in for CodeMirror's EditorView.
 * Static members cover all call sites in EditorPane, link-wrap, and markdown-shortcuts.
 */
export class EditorView {
  static theme = () => ({});
  static lineWrapping = {};
  static updateListener = { of: () => ({}) };
  static contentAttributes = { of: () => ({}) };
  // Used by markdown-shortcuts to register a paste event handler
  static domEventHandlers = () => ({});
  // Used by markdown-shortcuts for bracket/quote wrapping
  static inputHandler = { of: () => ({}) };

  /**
   * Noop replacement for EditorView.destroy().
   * @return {void}
   */
  destroy() {}

  /**
   * Noop replacement for EditorView.setState().
   * @param {unknown} _state - Ignored
   * @return {void}
   */
  setState(_state?: unknown) {}

  /**
   * Noop replacement for EditorView.dispatch().
   * @param {unknown} _tr - Ignored
   * @return {void}
   */
  dispatch(_tr?: unknown) {}

  /**
   * Stub getter returning a minimal EditorState-like shape.
   * @return {{ selection: { main: { from: number, to: number, empty: boolean } }, changeByRange: Function, sliceDoc: Function }}
   */
  get state() {
    return {
      selection: { main: { from: 0, to: 0, empty: true } },
      changeByRange: () => ({ changes: [], selection: {} }),
      sliceDoc: () => '',
    };
  }
}

// Noop standing in for EditorState
export const EditorState = {
  create: () => ({}),
};

// Minimal keymap stub
export const keymap = { of: () => ({}) };

// Command stubs
export const defaultKeymap: unknown[] = [];

/**
 * Noop replacement for CodeMirror's history extension.
 * @return {Record<string, never>} Empty object
 */
export function history() {
  return {};
}
export const historyKeymap: unknown[] = [];

/**
 * Noop replacement for CodeMirror's markdown language extension.
 * @return {Record<string, never>} Empty object
 */
export function markdown() {
  return {};
}
export const markdownLanguage = {};

// Language data stub
export const languages: unknown[] = [];

/**
 * Noop replacement for CodeMirror's syntaxHighlighting extension.
 * @return {Record<string, never>} Empty object
 */
export function syntaxHighlighting() {
  return {};
}
export const HighlightStyle = {
  define: () => ({}),
};

// ViewPlugin stub (used by link-wrap and markdown-shortcuts)
// Both .define() and .fromClass() are used across the editor modules.
export const ViewPlugin = {
  define: () => ({}),
  fromClass: () => ({}),
};

// Decoration stub (used by link-wrap)
export const Decoration = {
  mark: () => ({}),
  none: {},
  set: () => ({}),
};

/**
 * Noop replacement for CodeMirror's RangeSetBuilder.
 * Used by link-wrap to build decoration sets.
 */
export class RangeSetBuilder {
  /**
   * Noop replacement for RangeSetBuilder.add().
   * @param {unknown} _from - Ignored
   * @param {unknown} _to - Ignored
   * @param {unknown} _value - Ignored
   * @return {void}
   */
  add(_from?: unknown, _to?: unknown, _value?: unknown) {}

  /**
   * Noop replacement for RangeSetBuilder.finish().
   * @return {Record<string, never>} Empty object standing in for a DecorationSet
   */
  finish() {
    return {};
  }
}

// EditorSelection stub (used by markdown-shortcuts)
export const EditorSelection = {
  cursor: () => ({}),
  range: () => ({}),
};

// Tags stub — returns a proxy so any tag property access is valid
export const tags = new Proxy(
  {},
  {
    get: () =>
      new Proxy(() => ({}), {
        get: () => () => ({}),
        apply: () => ({}),
      }),
  },
);

/**
 * Noop replacement for CodeMirror's syntaxTree function.
 * Used by link-wrap and markdown-shortcuts for AST traversal.
 * @return {{ cursor: Function }} Minimal tree stub
 */
export function syntaxTree() {
  return { cursor: () => ({ next: () => false }) };
}

/**
 * Stub for url-utils isURL. Always returns false in the test environment.
 * @return {boolean} Always false
 */
export function isURL() {
  return false;
}

/**
 * Stub type standing in for CodeMirror's KeyBinding interface.
 */
export type KeyBinding = unknown;

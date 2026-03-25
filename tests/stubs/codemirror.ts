/**
 * Stub module for all @codemirror/* and @lezer/* imports used in the component test environment.
 * These packages are runtime-only dependencies not installed as devDependencies.
 * The vitest.config.ts components project redirects every @codemirror/* and @lezer/*
 * specifier here so EditorPane can be imported without resolution failures.
 */

// Noop class standing in for EditorView
// Static members must cover all call sites in EditorPane, link-wrap, and markdown-shortcuts.
export class EditorView {
  static theme = () => ({});
  static lineWrapping = {};
  static updateListener = { of: () => ({}) };
  static contentAttributes = { of: () => ({}) };
  // Used by markdown-shortcuts to register a paste event handler
  static domEventHandlers = () => ({});
  // Used by markdown-shortcuts for bracket/quote wrapping
  static inputHandler = { of: () => ({}) };
  destroy() {}
  setState() {}
  dispatch() {}
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
export function history() {
  return {};
}
export const historyKeymap: unknown[] = [];

// Markdown language stubs
export function markdown() {
  return {};
}
export const markdownLanguage = {};

// Language data stub
export const languages: unknown[] = [];

// Highlight stubs
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

// RangeSetBuilder stub (used by link-wrap)
export class RangeSetBuilder {
  add() {}
  finish() {
    return {};
  }
}

// Svelte selection stub (used by markdown-shortcuts)
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

// syntaxTree stub (used by link-wrap and markdown-shortcuts)
export function syntaxTree() {
  return { cursor: () => ({ next: () => false }) };
}

// isUrl stub (used by markdown-shortcuts)
export function isUrl() {
  return false;
}

// KeyBinding type — only used as a TypeScript type, no runtime value needed
export type KeyBinding = unknown;

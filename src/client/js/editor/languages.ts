/*
 * Language extension registry for the CodeMirror editor.
 * Provides lazy-loaded language extensions keyed by file type identifier.
 * Today all body formats use the same markdown parser — the registry
 * exists so MDX/Markdoc-specific parsers can drop in later without
 * changing EditorPane.
 */

import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

// Highlight style for the editor — headings are sized, syntax markers are dimmed.
const editorHighlight = HighlightStyle.define([
  // Headings — larger, bold
  {
    tag: t.heading1,
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: 'var(--cms-fg)',
  },
  {
    tag: t.heading2,
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: 'var(--cms-fg)',
  },
  {
    tag: t.heading3,
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'var(--cms-fg)',
  },
  // Emphasis
  { tag: t.strong, fontWeight: 'bold', color: 'var(--cms-fg)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--cms-fg)' },
  // Inline code
  { tag: t.monospace, color: 'var(--light-orange)' },
  // Links
  { tag: t.link, color: 'var(--light-teal)', textDecoration: 'underline' },
  { tag: t.url, color: 'var(--light-green)' },
  // Syntax markers — dimmed
  { tag: t.processingInstruction, color: 'var(--cms-muted)' },
  { tag: t.labelName, color: 'var(--light-teal)' },
  // Code block language tag
  { tag: t.tagName, color: 'var(--light-purple)' },
  // Lists
  { tag: t.list, color: 'var(--light-teal)' },
  // Blockquotes
  { tag: t.quote, color: 'var(--cms-muted)', fontStyle: 'italic' },
  // Code block contents — language-specific highlighting
  { tag: t.keyword, color: 'var(--light-plum)' },
  { tag: t.string, color: 'var(--light-orange)' },
  { tag: t.variableName, color: 'var(--light-teal)' },
  { tag: t.function(t.variableName), color: 'var(--gold)' },
  { tag: t.typeName, color: 'var(--light-green)' },
  { tag: t.number, color: 'var(--light-purple)' },
  { tag: t.bool, color: 'var(--light-purple)' },
  { tag: t.comment, color: 'var(--cms-muted)', fontStyle: 'italic' },
  { tag: t.operator, color: 'var(--light-red)' },
  { tag: t.punctuation, color: 'var(--cms-muted)' },
  { tag: t.meta, color: 'var(--cms-muted)' },
]);

/*
 * Cached extensions per file type — avoids re-creating parser instances and
 * lets CodeMirror short-circuit its extension diff via reference equality.
 */
const cache = new Map<string, Extension>();

/**
 * Returns the composed language extension (parser + syntax highlighting)
 * for a given file type. Results are cached per type so repeated calls
 * return the same reference. Today all body formats use the same markdown
 * extension — individual entries can diverge when custom parsers are added.
 * @param {string} fileType - Type identifier from the file type registry (e.g. 'md', 'mdx', 'markdoc')
 * @return {Extension} The composed CodeMirror language extension
 */
export function getLanguageExtension(fileType: string): Extension {
  let ext = cache.get(fileType);
  if (ext) return ext;

  /*
   * All body formats currently use the same markdown parser.
   * When MDX/Markdoc-specific parsers are built, add branches here.
   */
  ext = [
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    syntaxHighlighting(editorHighlight),
  ];
  cache.set(fileType, ext);
  return ext;
}

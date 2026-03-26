import { syntaxTree } from '@codemirror/language';
import { EditorSelection, type EditorState } from '@codemirror/state';
import { EditorView, type KeyBinding } from '@codemirror/view';
import { isUrl } from '../utils/url-utils';

//////////////////////////////
// Bracket/Quote Pair Map
//////////////////////////////

// Maps opening characters to their closing counterparts for selection wrapping
const wrapPairs: Record<string, string> = {
  '[': ']',
  '{': '}',
  '(': ')',
  "'": "'",
  '"': '"',
};

//////////////////////////////
// Formatting Toggle Helpers
//////////////////////////////

/**
 * Finds the innermost syntax tree node of the given type that contains the
 * given position. Returns the node's from/to range, or null if not found.
 * @param {EditorState} state - The current editor state
 * @param {number} pos - The document position to check
 * @param {string} nodeType - The syntax tree node name to search for
 * @return {{ from: number, to: number } | null} The node range, or null
 */
function findWrappingNode(
  state: EditorState,
  pos: number,
  nodeType: string,
): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  syntaxTree(state).iterate({
    from: pos,
    to: pos,
    enter(node) {
      if (node.name === nodeType) {
        result = { from: node.from, to: node.to };
      }
    },
  });
  return result;
}

/**
 * Creates a CodeMirror command that toggles a markdown formatting marker
 * (e.g., ** for bold, _ for italic) using syntax tree detection.
 * When inside the target node type, it unwraps. Otherwise, it wraps
 * the selection or inserts empty markers with the cursor between them.
 * @param {string} marker - The markdown marker string (e.g., "**" or "_")
 * @param {string} nodeType - The syntax tree node name (e.g., "StrongEmphasis" or "Emphasis")
 * @return {(view: EditorView) => boolean} A CodeMirror command function
 */
function toggleMarker(
  marker: string,
  nodeType: string,
): (view: EditorView) => boolean {
  return (view: EditorView): boolean => {
    const { state } = view;
    const changes = state.changeByRange((range) => {
      // Check if cursor/selection is inside the target node
      const node = findWrappingNode(state, range.from, nodeType);

      if (node) {
        // Unwrap — remove markers from both ends of the node.
        // Post-change coordinates: removing the opening marker shifts everything
        // left by len, and removing the closing marker doesn't affect earlier positions.
        // So the inner text spans from node.from to node.to - len * 2.
        const len = marker.length;
        // Preserve cursor vs selection: if the user had a cursor (no selection),
        // keep it as a cursor inside the unwrapped text rather than selecting all of it.
        // Clamp the post-change cursor: if the cursor was at or before the opening marker,
        // it lands at the start of the unwrapped text (node.from).
        const innerEnd = node.to - len * 2;
        const postRange = range.empty
          ? EditorSelection.cursor(
              Math.max(node.from, Math.min(range.from - len, innerEnd)),
            )
          : EditorSelection.range(node.from, innerEnd);
        return {
          range: postRange,
          changes: [
            { from: node.from, to: node.from + len, insert: '' },
            { from: node.to - len, to: node.to, insert: '' },
          ],
        };
      }

      if (range.empty) {
        // No selection — insert empty markers and place cursor between them
        const insert = marker + marker;
        return {
          range: EditorSelection.cursor(range.from + marker.length),
          changes: { from: range.from, insert },
        };
      }

      // Wrap selection in markers, keep text selected
      return {
        range: EditorSelection.range(
          range.from + marker.length,
          range.to + marker.length,
        ),
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
      };
    });

    view.dispatch(changes);
    return true;
  };
}

//////////////////////////////
// Link Insertion Command
//////////////////////////////

/**
 * Inserts a markdown link. With a selection, wraps as [text]() and places the
 * cursor in the URL parentheses. Without a selection, inserts []() and places
 * the cursor in the link text brackets. Does nothing inside existing Link nodes.
 * @param {EditorView} view - The CodeMirror editor view
 * @return {boolean} True if the command was handled
 */
function insertLink(view: EditorView): boolean {
  const { state } = view;

  // Don't re-wrap existing links — check the primary selection
  if (findWrappingNode(state, state.selection.main.from, 'Link')) return false;

  const changes = state.changeByRange((range) => {
    if (range.empty) {
      // No selection — insert []() with cursor inside []
      return {
        range: EditorSelection.cursor(range.from + 1),
        changes: { from: range.from, insert: '[]()' },
      };
    }

    // Wrap selection as [text]() with cursor inside ()
    const selectedText = state.sliceDoc(range.from, range.to);
    const replacement = `[${selectedText}]()`;
    return {
      // Cursor between the parentheses: [text](|)
      range: EditorSelection.cursor(range.from + selectedText.length + 3),
      changes: { from: range.from, to: range.to, insert: replacement },
    };
  });

  view.dispatch(changes);
  return true;
}

//////////////////////////////
// Keymap Export
//////////////////////////////

/** Keymap bindings for markdown formatting shortcuts (bold, italic, link) */
export const markdownShortcutsKeymap: KeyBinding[] = [
  { key: 'Mod-b', run: toggleMarker('**', 'StrongEmphasis') },
  { key: 'Mod-i', run: toggleMarker('_', 'Emphasis') },
  { key: 'Mod-k', run: insertLink },
];

//////////////////////////////
// Smart Paste Handler
//////////////////////////////

// Intercepts paste events to wrap selected text as a markdown link when
// the clipboard contains a URL. Only activates when text is selected.
const smartPasteHandler = EditorView.domEventHandlers({
  paste(event: ClipboardEvent, view: EditorView) {
    const { from, to, empty } = view.state.selection.main;
    if (empty) return false;

    const clipboardText = event.clipboardData?.getData('text/plain') ?? '';
    if (!isUrl(clipboardText)) return false;

    const url = clipboardText.trim();
    const selectedText = view.state.sliceDoc(from, to);
    const replacement = `[${selectedText}](${url})`;

    event.preventDefault();
    view.dispatch({
      changes: { from, to, insert: replacement },
      selection: EditorSelection.cursor(from + replacement.length),
    });

    return true;
  },
});

//////////////////////////////
// Bracket/Quote Wrap Handler
//////////////////////////////

// Intercepts single-character input to wrap selected text in matching
// bracket or quote pairs. Only activates when text is selected and
// the typed character is a recognized opening bracket or quote.
const bracketWrapHandler = EditorView.inputHandler.of(
  (view: EditorView, from: number, to: number, text: string) => {
    const closing = wrapPairs[text];
    if (!closing) return false;

    const { main } = view.state.selection;
    if (main.empty) return false;

    const selectedText = view.state.sliceDoc(main.from, main.to);
    view.dispatch({
      changes: {
        from: main.from,
        to: main.to,
        insert: text + selectedText + closing,
      },
      selection: EditorSelection.range(
        main.from + 1,
        main.from + 1 + selectedText.length,
      ),
    });

    return true;
  },
);

//////////////////////////////
// Extensions Export
//////////////////////////////

/** Non-keymap extensions: smart paste URL handler and bracket/quote wrapping */
export const markdownShortcutsExtensions = [
  smartPasteHandler,
  bracketWrapHandler,
];

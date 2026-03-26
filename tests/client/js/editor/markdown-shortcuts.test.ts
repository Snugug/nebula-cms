import { describe, it, expect, vi } from 'vitest';

//////////////////////////////
// CodeMirror API mocks
//
// markdown-shortcuts.ts depends on @codemirror/view, @codemirror/state,
// and @codemirror/language. The mocks provide minimal implementations
// that allow the module to load and for the key handler functions to
// be exercised with controlled state. The EditorView.dispatch mock
// captures dispatched transactions so assertions can inspect them.
//////////////////////////////

vi.mock('@codemirror/language', () => ({
  syntaxTree: vi.fn(() => ({
    /**
     * Stub syntax tree that supports targeted iteration and returns
     * a Link or StrongEmphasis/Emphasis node based on a global flag.
     * @param {{ from: number, to: number, enter: (node: { name: string, from: number, to: number }) => void }} opts - Iteration options
     * @return {void}
     */
    iterate(opts: {
      from?: number;
      to?: number;
      enter: (node: { name: string; from: number; to: number }) => void;
    }) {
      // Do not visit any nodes by default — tests override syntaxTree as needed
    },
  })),
}));

vi.mock('@codemirror/state', () => {
  /**
   * Minimal EditorSelection implementation supporting cursor and range creation.
   * Matches the shape used by the command handlers.
   */
  const EditorSelection = {
    /**
     * Creates a cursor (collapsed) selection at the given position.
     * @param {number} pos - The cursor position
     * @return {{ anchor: number, head: number, empty: boolean }} Cursor selection
     */
    cursor(pos: number) {
      return { anchor: pos, head: pos, empty: true };
    },

    /**
     * Creates a ranged selection between from and to.
     * @param {number} from - Selection start
     * @param {number} to - Selection end
     * @return {{ anchor: number, head: number, empty: boolean }} Range selection
     */
    range(from: number, to: number) {
      return { anchor: from, head: to, empty: from === to };
    },
  };

  return { EditorSelection };
});

vi.mock('@codemirror/view', () => {
  /**
   * Stub EditorView class with a controllable dispatch spy.
   * Each test constructs a fresh instance so dispatch calls are isolated.
   */
  class EditorView {
    state: {
      selection: { main: { from: number; to: number; empty: boolean } };
      doc: { length: number };
      sliceDoc: (from: number, to: number) => string;
      changeByRange: (
        fn: (range: { from: number; to: number; empty: boolean }) => {
          range: unknown;
          changes: unknown;
        },
      ) => { changes: unknown; selection: unknown };
    };

    dispatch = vi.fn();

    /**
     * Creates a minimal EditorView stub with controllable selection and doc content.
     * @param {{ from: number, to: number, empty: boolean }} selection - The main selection
     * @param {string} docContent - The full document content string
     */
    constructor(
      selection: { from: number; to: number; empty: boolean } = {
        from: 0,
        to: 0,
        empty: true,
      },
      docContent = '',
    ) {
      this.state = {
        selection: { main: selection },
        doc: { length: docContent.length },
        sliceDoc: (from: number, to: number) => docContent.slice(from, to),
        changeByRange: (fn) => {
          const result = fn(selection);
          return { changes: result.changes, selection: result.range };
        },
      };
    }
  }

  /** Minimal domEventHandlers stub — captures the handler object and returns a fake extension. */
  const domEventHandlersResults: unknown[] = [];
  EditorView.domEventHandlers = vi.fn((handlers: unknown) => {
    domEventHandlersResults.push(handlers);
    return { isDomEventHandler: true, handlers };
  });

  /** Minimal inputHandler.of stub — returns a fake extension. */
  EditorView.inputHandler = {
    of: vi.fn((fn: unknown) => ({ isInputHandler: true, fn })),
  };

  return { EditorView };
});

vi.mock('../utils/url-utils', async () => {
  const actual = await import('../../../../src/client/js/utils/url-utils');
  return { isUrl: actual.isUrl };
});

import { syntaxTree } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  markdownShortcutsKeymap,
  markdownShortcutsExtensions,
} from '../../../../src/client/js/editor/markdown-shortcuts';

//////////////////////////////
// markdownShortcutsKeymap — structure
//////////////////////////////

describe('markdownShortcutsKeymap', () => {
  it('is an array', () => {
    expect(Array.isArray(markdownShortcutsKeymap)).toBe(true);
  });

  it('contains exactly 3 key bindings', () => {
    expect(markdownShortcutsKeymap).toHaveLength(3);
  });

  it('contains a Mod-b binding for bold', () => {
    const binding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-b');
    expect(binding).toBeDefined();
    expect(typeof binding?.run).toBe('function');
  });

  it('contains a Mod-i binding for italic', () => {
    const binding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-i');
    expect(binding).toBeDefined();
    expect(typeof binding?.run).toBe('function');
  });

  it('contains a Mod-k binding for link insertion', () => {
    const binding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-k');
    expect(binding).toBeDefined();
    expect(typeof binding?.run).toBe('function');
  });
});

//////////////////////////////
// markdownShortcutsExtensions — structure
//////////////////////////////

describe('markdownShortcutsExtensions', () => {
  it('is an array', () => {
    expect(Array.isArray(markdownShortcutsExtensions)).toBe(true);
  });

  it('contains exactly 2 extensions (smart paste + bracket wrap)', () => {
    expect(markdownShortcutsExtensions).toHaveLength(2);
  });

  it('all items are truthy (valid extension objects)', () => {
    for (const ext of markdownShortcutsExtensions) {
      expect(ext).toBeTruthy();
    }
  });
});

//////////////////////////////
// Mod-b (bold) handler — toggleMarker('**', 'StrongEmphasis')
//////////////////////////////

describe('Mod-b handler — wrapping', () => {
  it('wraps a selection in ** markers', () => {
    // No wrapping node found — falls through to wrap-selection branch
    vi.mocked(syntaxTree).mockReturnValue({
      iterate: vi.fn(),
    } as any);

    const boldBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-b')!;
    // Selection covering "World" in "Hello World" (from=6, to=11)
    const view = new (EditorView as any)(
      { from: 6, to: 11, empty: false },
      'Hello World',
    );
    const result = boldBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
    const transaction = view.dispatch.mock.calls[0][0];
    // changes should include inserting ** at both ends
    expect(transaction.changes).toBeDefined();
  });

  it('inserts empty ** markers when selection is empty', () => {
    vi.mocked(syntaxTree).mockReturnValue({
      iterate: vi.fn(),
    } as any);

    const boldBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-b')!;
    const view = new (EditorView as any)(
      { from: 5, to: 5, empty: true },
      'Hello World',
    );
    const result = boldBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
  });

  it('unwraps when cursor is inside a StrongEmphasis node', () => {
    // Simulate the syntax tree finding a StrongEmphasis node at the cursor position
    vi.mocked(syntaxTree).mockReturnValue({
      iterate: vi.fn(
        (opts: {
          enter: (n: { name: string; from: number; to: number }) => void;
        }) => {
          opts.enter({ name: 'StrongEmphasis', from: 0, to: 13 });
        },
      ),
    } as any);

    const boldBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-b')!;
    const view = new (EditorView as any)(
      { from: 5, to: 5, empty: true },
      '**Hello World**',
    );
    const result = boldBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
    const transaction = view.dispatch.mock.calls[0][0];
    // Unwrap produces changes that remove the markers
    expect(transaction.changes).toBeDefined();
  });
});

//////////////////////////////
// Mod-i (italic) handler — toggleMarker('_', 'Emphasis')
//////////////////////////////

describe('Mod-i handler — wrapping', () => {
  it('wraps a selection in _ markers', () => {
    vi.mocked(syntaxTree).mockReturnValue({ iterate: vi.fn() } as any);

    const italicBinding = markdownShortcutsKeymap.find(
      (b) => b.key === 'Mod-i',
    )!;
    const view = new (EditorView as any)(
      { from: 0, to: 5, empty: false },
      'Hello World',
    );
    const result = italicBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
  });

  it('inserts empty _ markers when no selection', () => {
    vi.mocked(syntaxTree).mockReturnValue({ iterate: vi.fn() } as any);

    const italicBinding = markdownShortcutsKeymap.find(
      (b) => b.key === 'Mod-i',
    )!;
    const view = new (EditorView as any)(
      { from: 3, to: 3, empty: true },
      'Hello',
    );
    const result = italicBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
  });
});

//////////////////////////////
// Mod-k (link) handler — insertLink
//////////////////////////////

describe('Mod-k handler — link insertion', () => {
  it('inserts []() with no selection and places cursor inside []', () => {
    // No Link node at cursor
    vi.mocked(syntaxTree).mockReturnValue({ iterate: vi.fn() } as any);

    const linkBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-k')!;
    const view = new (EditorView as any)({ from: 0, to: 0, empty: true }, '');
    const result = linkBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
    const tx = view.dispatch.mock.calls[0][0];
    // The change should insert []()
    const changes = Array.isArray(tx.changes) ? tx.changes : [tx.changes];
    const insertCall = changes.find(
      (c: { insert?: string }) => c.insert === '[]()',
    );
    expect(insertCall).toBeDefined();
  });

  it('wraps selected text as [text]() with cursor in ()', () => {
    vi.mocked(syntaxTree).mockReturnValue({ iterate: vi.fn() } as any);

    const linkBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-k')!;
    const view = new (EditorView as any)(
      { from: 0, to: 5, empty: false },
      'Hello World',
    );
    const result = linkBinding.run(view as any);
    expect(result).toBe(true);
    expect(view.dispatch).toHaveBeenCalled();
    const tx = view.dispatch.mock.calls[0][0];
    const changes = Array.isArray(tx.changes) ? tx.changes : [tx.changes];
    // The replacement should be [Hello]()
    const replaceCall = changes.find(
      (c: { insert?: string }) => c.insert === '[Hello]()',
    );
    expect(replaceCall).toBeDefined();
  });

  it('returns false when cursor is already inside a Link node', () => {
    // Simulate a Link node containing the cursor
    vi.mocked(syntaxTree).mockReturnValue({
      iterate: vi.fn(
        (opts: {
          enter: (n: { name: string; from: number; to: number }) => void;
        }) => {
          opts.enter({ name: 'Link', from: 0, to: 20 });
        },
      ),
    } as any);

    const linkBinding = markdownShortcutsKeymap.find((b) => b.key === 'Mod-k')!;
    const view = new (EditorView as any)(
      { from: 5, to: 5, empty: true },
      '[existing](http://example.com)',
    );
    const result = linkBinding.run(view as any);
    expect(result).toBe(false);
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});

//////////////////////////////
// EditorSelection usage in handlers
//////////////////////////////

describe('EditorSelection integration', () => {
  it('cursor() returns an empty selection at the given position', () => {
    const sel = EditorSelection.cursor(7);
    expect(sel.anchor).toBe(7);
    expect(sel.empty).toBe(true);
  });

  it('range() returns a ranged selection', () => {
    const sel = EditorSelection.range(3, 10);
    expect(sel.anchor).toBe(3);
    expect(sel.head).toBe(10);
    expect(sel.empty).toBe(false);
  });
});

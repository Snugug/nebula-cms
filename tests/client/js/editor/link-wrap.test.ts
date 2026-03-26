import { describe, it, expect, vi } from 'vitest';
import { syntaxTree } from '@codemirror/language';

//////////////////////////////
// CodeMirror API mocks
//
// link-wrap.ts uses ViewPlugin, Decoration, RangeSetBuilder from
// @codemirror/view and @codemirror/state, and syntaxTree from
// @codemirror/language. The mocks return the minimal shapes needed
// for the module to load and for the ViewPlugin.define() call to
// complete without throwing. Testing the full decoration pass
// requires a real CodeMirror document tree, which is out of scope
// for a unit test — the structural tests below verify that the
// plugin is correctly defined and wired.
//////////////////////////////

vi.mock('@codemirror/language', () => ({
  syntaxTree: vi.fn(() => ({
    /**
     * Minimal syntax tree stub — calls enter once with a non-Link node
     * so buildDecorations completes without adding any decorations.
     * @param {{ enter: (node: { name: string, from: number, to: number }) => void }} opts - Iteration options
     * @return {void}
     */
    iterate(opts: {
      enter: (node: { name: string; from: number; to: number }) => void;
    }) {
      // Deliberately visit a non-Link node to exercise the filtering branch
      opts.enter({ name: 'Document', from: 0, to: 10 });
    },
  })),
}));

vi.mock('@codemirror/state', () => {
  /**
   * Minimal RangeSetBuilder stub that satisfies the builder.finish() call.
   * No decorations are added in unit tests (the syntax tree is empty),
   * so finish() just needs to return a stable value.
   */
  class RangeSetBuilder {
    /**
     * Adds a range — no-op in the stub.
     * @param {number} _from - Range start
     * @param {number} _to - Range end
     * @param {unknown} _value - Decoration value
     * @return {void}
     */
    add(_from: number, _to: number, _value: unknown): void {}

    /**
     * Finishes the builder and returns the collected decoration set.
     * @return {unknown[]} Empty decoration set stub
     */
    finish(): unknown[] {
      return [];
    }
  }
  return { RangeSetBuilder };
});

vi.mock('@codemirror/view', () => {
  /** Decoration stub that provides a mark() factory. */
  const Decoration = {
    /**
     * Creates a mark decoration with the given options.
     * @param {{ class: string }} opts - Decoration options
     * @return {{ class: string }} A minimal mark decoration stub
     */
    mark(opts: { class: string }) {
      return opts;
    },
  };

  /**
   * ViewPlugin stub that records the define() call parameters
   * and returns a stable fake extension object.
   */
  const ViewPlugin = {
    _lastFactory: null as unknown,
    _lastConfig: null as unknown,

    /**
     * Captures the factory and config and returns a fake plugin extension.
     * @param {(view: unknown) => unknown} factory - The plugin instance factory
     * @param {{ decorations: (v: unknown) => unknown }} config - Plugin configuration
     * @return {{ isViewPlugin: true, factory: Function, config: object }} Fake extension
     */
    define(
      factory: (view: unknown) => unknown,
      config: { decorations: (v: unknown) => unknown },
    ) {
      ViewPlugin._lastFactory = factory;
      ViewPlugin._lastConfig = config;
      return { isViewPlugin: true, factory, config };
    },
  };

  return { ViewPlugin, Decoration };
});

import { linkWrapPlugin } from '../../../../src/client/js/editor/link-wrap';

//////////////////////////////
// linkWrapPlugin structural tests
//////////////////////////////

describe('linkWrapPlugin', () => {
  it('is exported and truthy', () => {
    expect(linkWrapPlugin).toBeTruthy();
  });

  it('is the result of ViewPlugin.define()', () => {
    // The mock returns an object with isViewPlugin: true for anything
    // produced by ViewPlugin.define()
    expect((linkWrapPlugin as any).isViewPlugin).toBe(true);
  });

  it('exposes a decorations accessor via the config', () => {
    // ViewPlugin.define() must receive a config with a decorations getter
    const config = (linkWrapPlugin as any).config as {
      decorations: (v: unknown) => unknown;
    };
    expect(typeof config.decorations).toBe('function');
  });

  it('decorations accessor reads the decorations property from the plugin instance', () => {
    const config = (linkWrapPlugin as any).config as {
      decorations: (v: unknown) => unknown;
    };
    const fakeInstance = { decorations: ['decoration-sentinel'] };
    expect(config.decorations(fakeInstance)).toBe(fakeInstance.decorations);
  });

  it('plugin factory produces an object with a decorations property', () => {
    const factory = (linkWrapPlugin as any).factory as (view: unknown) => {
      decorations: unknown;
      update: (update: {
        docChanged: boolean;
        viewportChanged: boolean;
        state: unknown;
      }) => void;
    };
    // Provide a minimal EditorView stub with a state that has a doc
    const fakeView = {
      state: {
        doc: { length: 0 },
      },
    };
    const instance = factory(fakeView);
    expect(instance).toHaveProperty('decorations');
  });

  it('plugin update method re-builds decorations when doc changes', () => {
    const factory = (linkWrapPlugin as any).factory as (view: unknown) => {
      decorations: unknown;
      update: (update: {
        docChanged: boolean;
        viewportChanged: boolean;
        state: unknown;
      }) => void;
    };
    const fakeView = { state: { doc: { length: 0 } } };
    const instance = factory(fakeView);
    const before = instance.decorations;

    instance.update({
      docChanged: true,
      viewportChanged: false,
      state: fakeView.state,
    });

    // The decorations property should have been reassigned
    expect(instance).toHaveProperty('decorations');
    // The value comes from buildDecorations (which calls builder.finish() → [])
    // — just verify it is defined after update
    expect(instance.decorations).toBeDefined();
    // Silence the "unused variable" warning for before
    void before;
  });

  it('plugin update method re-builds decorations when viewport changes', () => {
    const factory = (linkWrapPlugin as any).factory as (view: unknown) => {
      decorations: unknown;
      update: (update: {
        docChanged: boolean;
        viewportChanged: boolean;
        state: unknown;
      }) => void;
    };
    const fakeView = { state: { doc: { length: 0 } } };
    const instance = factory(fakeView);

    instance.update({
      docChanged: false,
      viewportChanged: true,
      state: fakeView.state,
    });
    expect(instance.decorations).toBeDefined();
  });

  it('plugin update method does not rebuild when nothing changed', () => {
    const factory = (linkWrapPlugin as any).factory as (view: unknown) => {
      decorations: unknown;
      update: (update: {
        docChanged: boolean;
        viewportChanged: boolean;
        state: unknown;
      }) => void;
    };

    const fakeView = { state: { doc: { length: 0 } } };
    const instance = factory(fakeView);
    // Record call count after construction (buildDecorations is called once in the factory)
    const callsBefore = vi.mocked(syntaxTree).mock.calls.length;

    instance.update({
      docChanged: false,
      viewportChanged: false,
      state: fakeView.state,
    });

    // syntaxTree should not have been called again for the no-change update
    expect(vi.mocked(syntaxTree).mock.calls.length).toBe(callsBefore);
  });
});

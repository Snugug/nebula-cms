import { describe, it, expect } from 'vitest';
import { stableStringify } from '../../../../src/client/js/utils/stable-stringify';

describe('stableStringify', () => {
  it('produces the same output regardless of key insertion order', () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { a: 2, m: 3, z: 1 };
    expect(stableStringify(objA)).toBe(stableStringify(objB));
  });

  it('sorts keys alphabetically at the top level', () => {
    const obj = { z: 1, a: 2, m: 3 };
    expect(stableStringify(obj)).toBe('{"a":2,"m":3,"z":1}');
  });

  it('sorts keys recursively in nested objects', () => {
    const obj = { b: { y: 1, x: 2 }, a: { q: 3, p: 4 } };
    expect(stableStringify(obj)).toBe('{"a":{"p":4,"q":3},"b":{"x":2,"y":1}}');
  });

  it('preserves array element order (arrays are not sorted)', () => {
    const obj = { items: [3, 1, 2] };
    expect(stableStringify(obj)).toBe('{"items":[3,1,2]}');
  });

  it('handles null values correctly', () => {
    const obj = { a: null, b: 'text' };
    expect(stableStringify(obj)).toBe('{"a":null,"b":"text"}');
  });

  it('handles a top-level null', () => {
    expect(stableStringify(null)).toBe('null');
  });

  it('serializes an empty object', () => {
    expect(stableStringify({})).toBe('{}');
  });

  it('serializes an empty array', () => {
    expect(stableStringify([])).toBe('[]');
  });

  it('serializes primitive string values', () => {
    expect(stableStringify('hello')).toBe('"hello"');
  });

  it('serializes primitive number values', () => {
    expect(stableStringify(42)).toBe('42');
  });

  it('serializes boolean values', () => {
    expect(stableStringify(true)).toBe('true');
    expect(stableStringify(false)).toBe('false');
  });

  it('handles arrays containing objects with sorted keys', () => {
    const arr = [
      { b: 2, a: 1 },
      { d: 4, c: 3 },
    ];
    expect(stableStringify(arr)).toBe('[{"a":1,"b":2},{"c":3,"d":4}]');
  });

  it('is deterministic across multiple calls', () => {
    const obj = { x: { q: 1, p: 2 }, a: [3, 2, 1] };
    expect(stableStringify(obj)).toBe(stableStringify(obj));
  });
});

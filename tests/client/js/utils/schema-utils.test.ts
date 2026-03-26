import { describe, it, expect } from 'vitest';
import {
  resolveFieldType,
  createDefaultValue,
  extractTabs,
  getFieldsForTab,
  getByPath,
  setByPath,
} from '../../../../src/client/js/utils/schema-utils';

//////////////////////////////
// resolveFieldType
//////////////////////////////

describe('resolveFieldType', () => {
  it('resolves type: string to kind: string', () => {
    expect(resolveFieldType({ type: 'string' })).toEqual({ kind: 'string' });
  });

  it('resolves type: number to kind: number', () => {
    expect(resolveFieldType({ type: 'number' })).toEqual({ kind: 'number' });
  });

  it('resolves type: integer to kind: number', () => {
    expect(resolveFieldType({ type: 'integer' })).toEqual({ kind: 'number' });
  });

  it('resolves type: boolean to kind: boolean', () => {
    expect(resolveFieldType({ type: 'boolean' })).toEqual({ kind: 'boolean' });
  });

  it('resolves type: array to kind: array', () => {
    expect(resolveFieldType({ type: 'array' })).toEqual({ kind: 'array' });
  });

  it('resolves type: object to kind: object', () => {
    expect(resolveFieldType({ type: 'object' })).toEqual({ kind: 'object' });
  });

  it('resolves string with format: date-time to kind: date', () => {
    expect(resolveFieldType({ type: 'string', format: 'date-time' })).toEqual({
      kind: 'date',
    });
  });

  it('resolves string with enum values to kind: enum with options', () => {
    const result = resolveFieldType({ type: 'string', enum: ['a', 'b', 'c'] });
    expect(result).toEqual({ kind: 'enum', options: ['a', 'b', 'c'] });
  });

  it('resolves unknown type to kind: unknown', () => {
    expect(resolveFieldType({ type: 'bogus' })).toEqual({ kind: 'unknown' });
  });

  it('resolves schema with no type to kind: unknown', () => {
    expect(resolveFieldType({})).toEqual({ kind: 'unknown' });
  });

  it('unwraps nullable anyOf and marks nullable: true', () => {
    const schema = {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    };
    expect(resolveFieldType(schema)).toEqual({
      kind: 'string',
      nullable: true,
    });
  });

  it('unwraps nullable anyOf for date-time and marks nullable: true', () => {
    const schema = {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
    };
    expect(resolveFieldType(schema)).toEqual({ kind: 'date', nullable: true });
  });

  it('date-time format takes precedence over enum when both present', () => {
    // format is checked before enum in the implementation
    const result = resolveFieldType({
      type: 'string',
      format: 'date-time',
      enum: ['x'],
    });
    expect(result.kind).toBe('date');
  });
});

//////////////////////////////
// createDefaultValue
//////////////////////////////

describe('createDefaultValue', () => {
  it('returns an explicit schema default when present', () => {
    expect(createDefaultValue({ type: 'string', default: 'hello' })).toBe(
      'hello',
    );
  });

  it('returns an explicit default of false (falsy default honoured)', () => {
    expect(createDefaultValue({ type: 'boolean', default: false })).toBe(false);
  });

  it('returns empty string for type: string', () => {
    expect(createDefaultValue({ type: 'string' })).toBe('');
  });

  it('returns 0 for type: number', () => {
    expect(createDefaultValue({ type: 'number' })).toBe(0);
  });

  it('returns 0 for type: integer', () => {
    expect(createDefaultValue({ type: 'integer' })).toBe(0);
  });

  it('returns false for type: boolean', () => {
    expect(createDefaultValue({ type: 'boolean' })).toBe(false);
  });

  it('returns [] for type: array', () => {
    expect(createDefaultValue({ type: 'array' })).toEqual([]);
  });

  it('returns {} for type: object with no properties', () => {
    expect(createDefaultValue({ type: 'object' })).toEqual({});
  });

  it('recursively builds defaults for object properties', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        count: { type: 'number' },
        active: { type: 'boolean' },
      },
    };
    expect(createDefaultValue(schema)).toEqual({
      name: '',
      count: 0,
      active: false,
    });
  });

  it('returns null for a nullable anyOf schema', () => {
    const schema = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    expect(createDefaultValue(schema)).toBeNull();
  });

  it('returns null for an unrecognised type', () => {
    expect(createDefaultValue({ type: 'bogus' })).toBeNull();
  });

  it('returns null for an empty schema', () => {
    expect(createDefaultValue({})).toBeNull();
  });
});

//////////////////////////////
// extractTabs
//////////////////////////////

describe('extractTabs', () => {
  it('returns an empty array when the schema has no properties', () => {
    expect(extractTabs({})).toEqual([]);
  });

  it('returns an empty array when no fields have a tab array', () => {
    const schema = { properties: { title: { type: 'string' } } };
    expect(extractTabs(schema)).toEqual([]);
  });

  it('returns sorted, deduplicated tab names', () => {
    const schema = {
      properties: {
        title: { type: 'string', tab: ['Content'] },
        slug: { type: 'string', tab: ['SEO', 'Content'] },
        date: { type: 'string', tab: ['Metadata'] },
      },
    };
    expect(extractTabs(schema)).toEqual(['Content', 'Metadata', 'SEO']);
  });

  it('deduplicates tab names appearing across multiple fields', () => {
    const schema = {
      properties: {
        a: { tab: ['Shared'] },
        b: { tab: ['Shared'] },
      },
    };
    expect(extractTabs(schema)).toEqual(['Shared']);
  });

  it('ignores fields whose tab value is not an array', () => {
    const schema = {
      properties: {
        a: { tab: 'not-an-array' },
        b: { tab: ['Real'] },
      },
    };
    expect(extractTabs(schema)).toEqual(['Real']);
  });
});

//////////////////////////////
// getFieldsForTab
//////////////////////////////

describe('getFieldsForTab', () => {
  const schema = {
    properties: {
      title: { type: 'string', tab: ['Content'] },
      slug: { type: 'string', tab: ['SEO'] },
      date: { type: 'string', tab: ['Metadata', 'Content'] },
      $schema: { type: 'string' },
    },
  };

  it('returns all field names (excluding $schema) when tab is null', () => {
    const result = getFieldsForTab(schema, null);
    expect(result).toContain('title');
    expect(result).toContain('slug');
    expect(result).toContain('date');
    expect(result).not.toContain('$schema');
  });

  it('returns only fields belonging to the given tab', () => {
    expect(getFieldsForTab(schema, 'Content')).toEqual(['title', 'date']);
  });

  it('returns the correct subset for SEO tab', () => {
    expect(getFieldsForTab(schema, 'SEO')).toEqual(['slug']);
  });

  it('returns an empty array for a tab with no matching fields', () => {
    expect(getFieldsForTab(schema, 'NonExistent')).toEqual([]);
  });

  it('returns an empty array when the schema has no properties', () => {
    expect(getFieldsForTab({}, 'Content')).toEqual([]);
  });
});

//////////////////////////////
// getByPath
//////////////////////////////

describe('getByPath', () => {
  it('returns the root object for an empty path', () => {
    const obj = { a: 1 };
    expect(getByPath(obj, [])).toBe(obj);
  });

  it('reads a top-level property by key', () => {
    expect(getByPath({ name: 'Alice' }, ['name'])).toBe('Alice');
  });

  it('traverses nested objects', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getByPath(obj, ['a', 'b', 'c'])).toBe(42);
  });

  it('reads array elements by numeric index', () => {
    const obj = { items: ['x', 'y', 'z'] };
    expect(getByPath(obj, ['items', 1])).toBe('y');
  });

  it('returns undefined when a segment is missing', () => {
    expect(getByPath({ a: 1 }, ['b', 'c'])).toBeUndefined();
  });

  it('returns undefined when traversing through null', () => {
    expect(getByPath({ a: null }, ['a', 'b'])).toBeUndefined();
  });

  it('returns undefined when traversing through undefined', () => {
    expect(getByPath({ a: undefined }, ['a', 'b'])).toBeUndefined();
  });
});

//////////////////////////////
// setByPath
//////////////////////////////

describe('setByPath', () => {
  it('sets a top-level property', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, ['name'], 'Alice');
    expect(obj['name']).toBe('Alice');
  });

  it('sets a deeply nested property, creating intermediates', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, ['a', 'b', 'c'], 99);
    expect((obj['a'] as Record<string, unknown>)['b']).toEqual({ c: 99 });
  });

  it('overwrites an existing value', () => {
    const obj = { score: 1 };
    setByPath(obj, ['score'], 100);
    expect(obj['score']).toBe(100);
  });

  it('sets a value at a numeric array index', () => {
    const obj: Record<string, unknown> = { items: ['a', 'b', 'c'] };
    setByPath(obj, ['items', 1], 'X');
    expect((obj['items'] as string[])[1]).toBe('X');
  });

  it('does nothing for an empty path', () => {
    const obj = { a: 1 };
    setByPath(obj, [], 'should-not-apply');
    expect(obj).toEqual({ a: 1 });
  });

  it('creates missing intermediate objects', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, ['x', 'y'], 'deep');
    expect(obj).toEqual({ x: { y: 'deep' } });
  });
});

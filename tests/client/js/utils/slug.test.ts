import { describe, it, expect } from 'vitest';
import { slugify } from '../../../../src/client/js/utils/slug';

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar baz')).toBe('foo-bar-baz');
  });

  it('replaces special characters with hyphens', () => {
    expect(slugify('hello! world?')).toBe('hello-world');
  });

  it('collapses consecutive hyphens into one', () => {
    expect(slugify('foo---bar')).toBe('foo-bar');
  });

  it('trims leading hyphens', () => {
    expect(slugify('---foo')).toBe('foo');
  });

  it('trims trailing hyphens', () => {
    expect(slugify('foo---')).toBe('foo');
  });

  it('handles unicode characters by replacing them with hyphens', () => {
    expect(slugify('café')).toBe('caf');
  });

  it('handles strings with only special characters', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('leaves an already-slugified string unchanged', () => {
    expect(slugify('already-a-slug')).toBe('already-a-slug');
  });

  it('handles numeric characters', () => {
    expect(slugify('Post 42')).toBe('post-42');
  });

  it('handles mixed alphanumeric and special characters', () => {
    expect(slugify('My Post: The (2024) Edition!')).toBe(
      'my-post-the-2024-edition',
    );
  });

  it('preserves existing hyphens in the middle of words', () => {
    expect(slugify('well-known')).toBe('well-known');
  });
});

import { describe, it, expect } from 'vitest';
import { isUrl } from '../../../../src/client/js/utils/url-utils';

describe('isUrl', () => {
  // Valid absolute URLs
  it('returns true for an https URL', () => {
    expect(isUrl('https://example.com')).toBe(true);
  });

  it('returns true for an http URL', () => {
    expect(isUrl('http://example.com')).toBe(true);
  });

  it('returns true for an https URL with a path', () => {
    expect(isUrl('https://example.com/some/path')).toBe(true);
  });

  it('returns true for an https URL with query params', () => {
    expect(isUrl('https://example.com/search?q=test&page=2')).toBe(true);
  });

  it('returns true for a mailto: URL', () => {
    expect(isUrl('mailto:user@example.com')).toBe(true);
  });

  // Absolute paths
  it('returns true for an absolute path starting with /', () => {
    expect(isUrl('/some/path')).toBe(true);
  });

  it('returns true for the root path /', () => {
    expect(isUrl('/')).toBe(true);
  });

  // Non-URLs
  it('returns false for plain text', () => {
    expect(isUrl('hello world')).toBe(false);
  });

  it('returns false for a relative path without leading slash', () => {
    expect(isUrl('some/relative/path')).toBe(false);
  });

  it('returns false for a word that looks like a domain but has no scheme', () => {
    expect(isUrl('example.com')).toBe(false);
  });

  it('returns true for a protocol-relative URL — it starts with / so the absolute-path branch accepts it', () => {
    // //example.com/path starts with /, so new URL('//example.com/path', 'https://a.com')
    // resolves successfully. The function accepts absolute paths without requiring a scheme.
    expect(isUrl('//example.com/path')).toBe(true);
  });

  // Edge cases
  it('returns false for an empty string', () => {
    expect(isUrl('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isUrl('   ')).toBe(false);
  });

  it('trims whitespace before validation — valid URL with surrounding spaces', () => {
    expect(isUrl('  https://example.com  ')).toBe(true);
  });

  it('trims whitespace before validation — plain text with surrounding spaces', () => {
    expect(isUrl('  hello  ')).toBe(false);
  });
});

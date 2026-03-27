import { describe, it, expect } from 'vitest';
import { isURL } from '../../../../src/client/js/utils/url-utils';

describe('isURL', () => {
  // Valid absolute URLs
  it('returns true for an https URL', () => {
    expect(isURL('https://example.com')).toBe(true);
  });

  it('returns true for an http URL', () => {
    expect(isURL('http://example.com')).toBe(true);
  });

  it('returns true for an https URL with a path', () => {
    expect(isURL('https://example.com/some/path')).toBe(true);
  });

  it('returns true for an https URL with query params', () => {
    expect(isURL('https://example.com/search?q=test&page=2')).toBe(true);
  });

  it('returns true for a mailto: URL', () => {
    expect(isURL('mailto:user@example.com')).toBe(true);
  });

  // Absolute paths
  it('returns true for an absolute path starting with /', () => {
    expect(isURL('/some/path')).toBe(true);
  });

  it('returns true for the root path /', () => {
    expect(isURL('/')).toBe(true);
  });

  // Non-URLs
  it('returns false for plain text', () => {
    expect(isURL('hello world')).toBe(false);
  });

  it('returns false for a relative path without leading slash', () => {
    expect(isURL('some/relative/path')).toBe(false);
  });

  it('returns false for a word that looks like a domain but has no scheme', () => {
    expect(isURL('example.com')).toBe(false);
  });

  it('returns true for a protocol-relative URL — it starts with / so the absolute-path branch accepts it', () => {
    // //example.com/path starts with /, so new URL('//example.com/path', 'https://a.com')
    // resolves successfully. The function accepts absolute paths without requiring a scheme.
    expect(isURL('//example.com/path')).toBe(true);
  });

  // Edge cases
  it('returns false for an empty string', () => {
    expect(isURL('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isURL('   ')).toBe(false);
  });

  it('trims whitespace before validation — valid URL with surrounding spaces', () => {
    expect(isURL('  https://example.com  ')).toBe(true);
  });

  it('trims whitespace before validation — plain text with surrounding spaces', () => {
    expect(isURL('  hello  ')).toBe(false);
  });
});

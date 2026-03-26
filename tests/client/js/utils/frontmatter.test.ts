import { describe, it, expect } from 'vitest';
import { splitFrontmatter } from '../../../../src/client/js/utils/frontmatter';

describe('splitFrontmatter', () => {
  it('splits valid YAML frontmatter and body', () => {
    const content = '---\ntitle: Hello\n---\nBody text here.';
    const result = splitFrontmatter(content);
    // slice(4, closeIndex) stops before the \n that precedes ---
    expect(result.rawFrontmatter).toBe('title: Hello');
    expect(result.body).toBe('Body text here.');
  });

  it('returns an empty body when there is only frontmatter', () => {
    const content = '---\ntitle: No Body\n---\n';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('title: No Body');
    expect(result.body).toBe('');
  });

  it('handles frontmatter with no trailing newline (ends with ---)', () => {
    // endsWith('\n---') branch: slice(4, length - 4) trims the leading newline of the delimiter
    const content = '---\ntitle: EOF\n---';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('title: EOF');
    expect(result.body).toBe('');
  });

  it('returns empty frontmatter and full content when no frontmatter delimiter is present', () => {
    const content = 'Just plain body text.';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('');
    expect(result.body).toBe('Just plain body text.');
  });

  it('returns empty frontmatter and full content for an empty string', () => {
    const result = splitFrontmatter('');
    expect(result.rawFrontmatter).toBe('');
    expect(result.body).toBe('');
  });

  it('rejects a horizontal rule (----) at the start — not treated as frontmatter', () => {
    const content = '----\ntitle: Nope\n---\nBody.';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('');
    expect(result.body).toBe(content);
  });

  it('strips a leading BOM character before processing', () => {
    const content = '\uFEFF---\ntitle: BOM\n---\nBody.';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('title: BOM');
    expect(result.body).toBe('Body.');
  });

  it('normalises CRLF line endings before processing', () => {
    const content = '---\r\ntitle: CRLF\r\n---\r\nBody.';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('title: CRLF');
    expect(result.body).toBe('Body.');
  });

  it('returns empty frontmatter when the closing delimiter is missing', () => {
    // No closing --- so the entire content is treated as body
    const content = '---\ntitle: Unclosed';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('');
    expect(result.body).toBe(content);
  });

  it('treats content starting with --- but missing a newline as a non-match', () => {
    // "---" without an immediate newline is not a valid opening delimiter
    const content = '--- title: Inline';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe('');
    expect(result.body).toBe(content);
  });

  it('handles multiline frontmatter with body correctly', () => {
    const content =
      '---\ntitle: Multi\nauthor: Jane\ntags:\n  - a\n  - b\n---\n# Heading\n\nParagraph.';
    const result = splitFrontmatter(content);
    expect(result.rawFrontmatter).toBe(
      'title: Multi\nauthor: Jane\ntags:\n  - a\n  - b',
    );
    expect(result.body).toBe('# Heading\n\nParagraph.');
  });
});

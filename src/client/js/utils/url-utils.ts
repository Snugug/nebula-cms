/*
 * URL validation utilities for the editor's smart paste handler.
 */

/**
 * Checks whether a string is a valid URL (absolute with scheme, or absolute path).
 * Used by the smart paste handler to determine whether clipboard content should
 * be auto-wrapped as a markdown link rather than inserted as plain text.
 * Trims whitespace before validating. Rejects plain words and relative paths
 * without a leading slash to avoid false positives on normal text.
 * @param {string} text - The string to validate
 * @return {boolean} True if the text is a valid URL or absolute path
 */
export function isURL(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // Absolute URL with scheme (https://, mailto:, etc.)
  try {
    new URL(trimmed);
    return true;
  } catch {
    // Not an absolute URL — fall through
  }

  // Absolute path starting with /
  if (trimmed.startsWith('/')) {
    try {
      // Dummy base required by URL constructor to resolve absolute paths
      new URL(trimmed, 'https://a.com');
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

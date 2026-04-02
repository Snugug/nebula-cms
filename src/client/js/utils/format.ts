/*
 * Display formatting utilities for property names and labels.
 */

/**
 * Converts a property name string to Title Case for display in form labels.
 * Splits on camelCase boundaries, hyphens, and underscores, then capitalizes each word.
 * @param {string} str - The raw property name to convert (e.g., "firstName", "last-name", "zip_code")
 * @return {string} The title-cased display string (e.g., "First Name", "Last Name", "Zip Code")
 */
export function toTitleCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

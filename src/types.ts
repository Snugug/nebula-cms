/*
 * Configuration options for the nebula-cms Astro integration.
 */
export interface NebulaCMSConfig {
  /**
   * URL prefix for the admin SPA.
   * Accepts a relative or absolute path. Normalized automatically: leading `/`
   * prepended if missing, consecutive slashes collapsed, trailing `/` stripped.
   * After normalization, must contain only segments of letters, digits, hyphens,
   * and underscores — or be `/` for root mount.
   * @default '/admin'
   */
  basePath?: string;

  /**
   * URL prefix under which collection schema files are served.
   * Accepts a relative or absolute path. Normalized automatically: leading `/`
   * prepended if missing, consecutive slashes collapsed, trailing `/` stripped.
   * After normalization, must contain only segments of letters, digits, hyphens,
   * and underscores. Cannot be `/` (root) — collections require at least one
   * path segment.
   * @default '/collections'
   */
  collectionsPath?: string;
}

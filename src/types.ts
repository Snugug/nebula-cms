/*
 * Configuration options for the nebula-cms Astro integration.
 */
export interface NebulaCMSConfig {
  /**
   * URL prefix for the admin SPA.
   * Must be an absolute path (leading `/`).
   * Normalized automatically: leading `/` prepended if missing, trailing `/` stripped.
   * @default '/admin'
   */
  basePath?: string;

  /**
   * URL prefix under which collection schema files are served.
   * Must be an absolute path (leading `/`).
   * Normalized automatically: leading `/` prepended if missing, trailing `/` stripped.
   * @default '/collections'
   */
  collectionsPath?: string;
}

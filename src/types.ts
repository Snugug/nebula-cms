/*
 * Configuration options for the nebula-cms Astro integration.
 */
export interface NebulaCMSConfig {
  /**
   * Folder name inside `public/` where the collections symlink is placed.
   * Also determines the URL prefix for schema files in the virtual module.
   * Must be a bare path segment (no leading `/`, no `..`, no absolute paths).
   * @default 'collections'
   */
  collectionsPath?: string;
}

//////////////////////////////
// File Type Registry
// Central source of truth for supported file formats. All other modules
// (storage adapters, orchestrator worker, editor, publish handler) derive
// extension lists, category, and serialization format from this registry.
//////////////////////////////

/**
 * Configuration for a single supported file type.
 */
export type FileTypeConfig = {
  /** All file extensions associated with this type, first entry is the default. */
  extensions: string[];
  /** Whether this type has a body editor (markdown/MDX/Markdoc). */
  hasBody: boolean;
  /** Whether the file holds frontmatter+body or pure data. */
  category: 'frontmatter' | 'data';
  /** For data files, which serialization format to use. */
  dataFormat?: 'json' | 'yaml' | 'toml';
};

/**
 * Registry mapping type identifiers (as used in schema `files` arrays) to their config.
 */
export const FILE_TYPES: Record<string, FileTypeConfig> = {
  md: {
    extensions: ['.md', '.markdown'],
    hasBody: true,
    category: 'frontmatter',
  },
  mdx: {
    extensions: ['.mdx'],
    hasBody: true,
    category: 'frontmatter',
  },
  markdoc: {
    extensions: ['.mdoc', '.markdoc'],
    hasBody: true,
    category: 'frontmatter',
  },
  json: {
    extensions: ['.json'],
    hasBody: false,
    category: 'data',
    dataFormat: 'json',
  },
  yaml: {
    extensions: ['.yml', '.yaml'],
    hasBody: false,
    category: 'data',
    dataFormat: 'yaml',
  },
  toml: {
    extensions: ['.toml'],
    hasBody: false,
    category: 'data',
    dataFormat: 'toml',
  },
};

//////////////////////////////
// Extension reverse-lookup map
// Built once at module load for O(1) extension-to-config lookups.
//////////////////////////////

/** Maps each known extension to its FileTypeConfig. */
const extensionMap = new Map<string, FileTypeConfig>();

for (const config of Object.values(FILE_TYPES)) {
  for (const ext of config.extensions) {
    extensionMap.set(ext, config);
  }
}

//////////////////////////////
// Helper: extract extension
//////////////////////////////

/**
 * Extracts the last dot-prefixed extension from a filename, or an empty string if none.
 * @param {string} filename - The filename to extract the extension from
 * @return {string} The extension including the leading dot (e.g. '.md'), or ''
 */
function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return '';
  return filename.slice(idx);
}

//////////////////////////////
// Exported helpers
//////////////////////////////

/**
 * Resolves a schema's `files` array of type identifiers to a flat list of file extensions.
 * Used by storage adapters for file discovery filtering.
 * @param {Record<string, unknown>} schema - A collection JSON Schema with an optional `files` array
 * @return {string[]} Ordered list of extensions (e.g. ['.md', '.markdown', '.json'])
 */
export function getExtensionsForSchema(
  schema: Record<string, unknown>,
): string[] {
  const files = schema['files'];
  if (!Array.isArray(files)) return [];

  const extensions: string[] = [];
  for (const typeId of files as string[]) {
    const config = FILE_TYPES[typeId];
    if (config) {
      extensions.push(...config.extensions);
    }
  }
  return extensions;
}

/**
 * Returns whether a file should show the body editor panel.
 * True for markdown, MDX, and Markdoc files; false for pure data files.
 * @param {string} filename - The filename to check
 * @return {boolean} True if the file type has a body editor
 */
export function hasBodyEditor(filename: string): boolean {
  const config = extensionMap.get(getExtension(filename));
  return config?.hasBody ?? false;
}

/**
 * Returns the category of a file based on its extension.
 * Used to determine whether to render frontmatter fields or data-only fields.
 * @param {string} filename - The filename to categorise
 * @return {'frontmatter' | 'data' | null} The file category, or null for unrecognised extensions
 */
export function getFileCategory(
  filename: string,
): 'frontmatter' | 'data' | null {
  const config = extensionMap.get(getExtension(filename));
  return config?.category ?? null;
}

/**
 * Returns the serialization format for a data file.
 * Returns null for frontmatter files and unrecognised extensions.
 * @param {string} filename - The filename to inspect
 * @return {'json' | 'yaml' | 'toml' | null} The data format, or null if not a data file
 */
export function getDataFormat(
  filename: string,
): 'json' | 'yaml' | 'toml' | null {
  const config = extensionMap.get(getExtension(filename));
  return config?.dataFormat ?? null;
}

/**
 * Strips the file extension from a filename when the extension is a known type.
 * Returns the filename unchanged if the extension is not recognised.
 * Used for generating URL slugs from filenames.
 * @param {string} filename - The filename to strip the extension from
 * @return {string} The filename without its known extension, or the original filename
 */
export function stripExtension(filename: string): string {
  const ext = getExtension(filename);
  if (ext && extensionMap.has(ext)) {
    return filename.slice(0, filename.length - ext.length);
  }
  return filename;
}

/**
 * Returns the default (first) file extension for a given type identifier.
 * Used when creating new files to pick the canonical extension for a format.
 * @param {string} type - A type identifier (e.g. 'md', 'yaml', 'toml')
 * @return {string | null} The default extension including the leading dot, or null for unknown types
 */
export function getDefaultExtension(type: string): string | null {
  return FILE_TYPES[type]?.extensions[0] ?? null;
}

/**
 * Returns the type identifier for a given filename by looking up its extension.
 * Used when the active file's type must be determined for the format selector.
 * @param {string} filename - The filename to look up
 * @return {string | null} The type identifier (e.g. 'md', 'yaml'), or null for unrecognised extensions
 */
export function getTypeForFilename(filename: string): string | null {
  const ext = getExtension(filename);
  if (!ext) return null;
  for (const [typeId, config] of Object.entries(FILE_TYPES)) {
    if (config.extensions.includes(ext)) return typeId;
  }
  return null;
}

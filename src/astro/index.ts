import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import type { NebulaCMSConfig } from '../types.js';

// Vite virtual module ID for collection schema paths
const VIRTUAL_ID = 'virtual:collections';
// Vite convention: resolved virtual IDs are prefixed with \0
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// Bare path segment: no slashes, no .., no absolute paths, no empty string
const VALID_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/**
 * Astro integration that exposes content collection JSON schemas to client-side JavaScript via a symlink and virtual module.
 * @param {NebulaCMSConfig} config - Optional configuration object
 * @return {AstroIntegration} The configured Astro integration object
 */
export default function NebulaCMS(
  config: NebulaCMSConfig = {},
): AstroIntegration {
  const collectionsPath = config.collectionsPath ?? 'collections';

  if (!VALID_PATH_SEGMENT.test(collectionsPath)) {
    throw new Error(
      `Invalid collectionsPath "${collectionsPath}". Must be a bare path segment (letters, numbers, hyphens, underscores).`,
    );
  }

  return {
    name: 'nebula-cms',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        updateConfig({
          vite: {
            plugins: [
              collectionsVitePlugin(logger, process.cwd(), collectionsPath),
            ],
          },
        });
      },
    },
  };
}

/**
 * Vite plugin that handles symlink creation and virtual module resolution.
 * @internal Not part of the public API — exported for testing only
 * @param {AstroIntegrationLogger} logger - Astro integration logger for warnings
 * @param {string} root - Project root directory, defaults to process.cwd()
 * @param {string} collectionsPath - Folder name inside public/ for the symlink, defaults to 'collections'
 * @return {object} A Vite plugin object with buildStart, resolveId, and load hooks
 */
export function collectionsVitePlugin(
  logger: AstroIntegrationLogger,
  root: string = process.cwd(),
  collectionsPath: string = 'collections',
) {
  return {
    name: 'vite-plugin-nebula-cms',

    /**
     * Creates symlink from public/<collectionsPath> to .astro/collections.
     * @return {void}
     */
    buildStart() {
      const source = resolve(root, '.astro/collections');
      const target = resolve(root, 'public', collectionsPath);

      // Guard: skip if .astro/collections doesn't exist yet
      if (!existsSync(source)) {
        logger.warn(
          '`.astro/collections` not found — skipping symlink. Run `pnpm sync` first.',
        );
        return;
      }

      // lstatSync instead of existsSync because existsSync follows symlinks and returns false for broken ones
      let targetStat: ReturnType<typeof lstatSync> | null = null;
      try {
        targetStat = lstatSync(target);
      } catch {
        /* doesn't exist at all */
      }

      if (targetStat !== null) {
        if (targetStat.isSymbolicLink()) {
          const linkTarget = resolve(dirname(target), readlinkSync(target));
          if (linkTarget === source) {
            return; // Symlink is correct, nothing to do
          }
          unlinkSync(target);
        } else if (targetStat.isDirectory()) {
          // rmSync needed because unlinkSync cannot remove directories
          rmSync(target, { recursive: true });
        } else {
          unlinkSync(target);
        }
      }

      // Ensure the symlink's parent directory exists (e.g. public/ may not exist on a clean clone)
      mkdirSync(dirname(target), { recursive: true });

      // Create relative symlink for portability
      const relPath = relative(dirname(target), source);
      symlinkSync(relPath, target);
    },

    /**
     * Resolves the virtual:collections import to a Vite-internal ID.
     * @param {string} id - The module ID being resolved
     * @return {string | undefined} The resolved internal ID, or undefined if not handled
     */
    resolveId(id: string) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    /**
     * Generates the virtual module by reading .astro/collections/ and mapping collection names to schema fetch URLs.
     * @param {string} id - The resolved module ID to load
     * @return {string | undefined} Generated module source code, or undefined if not handled
     */
    load(id: string) {
      if (id !== RESOLVED_ID) return;

      const collectionsDir = resolve(root, '.astro/collections');

      // Guard: return empty object if directory doesn't exist
      if (!existsSync(collectionsDir)) {
        logger.warn(
          '`.astro/collections` not found — virtual:collections will be empty.',
        );
        return 'export default {};';
      }

      const files = readdirSync(collectionsDir).filter((f) =>
        f.endsWith('.schema.json'),
      );

      const entries = files.map((f) => {
        const name = f.replace('.schema.json', '');
        return `  ${JSON.stringify(name)}: ${JSON.stringify('/' + collectionsPath + '/' + f)}`;
      });

      return `export default {\n${entries.join(',\n')}\n};`;
    },
  };
}

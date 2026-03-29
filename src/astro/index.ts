import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration, AstroIntegrationLogger } from 'astro';
import type { NebulaCMSConfig } from '../types.js';

// Vite virtual module ID for collection schema paths
const VIRTUAL_ID = 'virtual:collections';
// Vite convention: resolved virtual IDs are prefixed with \0
const RESOLVED_ID = '\0' + VIRTUAL_ID;

// Bare path segment: no slashes, no .., no absolute paths, no empty string
const VALID_PATH_SEGMENT = /^[a-zA-Z0-9_-]+$/;

/**
 * Astro integration that exposes content collection JSON schemas to client-side JavaScript via a virtual module, dev middleware, and build-time file copy.
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
            // Workers use dynamic imports (e.g. storage worker lazy-loads
            // adapters), which require code splitting. The default 'iife'
            // format does not support code splitting, so use ES modules.
            worker: { format: 'es' },
          },
        });
      },
      // Copy schema files into the build output after Astro finishes.
      'astro:build:done': ({ dir, logger }) => {
        const source = resolve(process.cwd(), '.astro/collections');
        if (!existsSync(source)) {
          logger.warn(
            '`.astro/collections` not found — schema files will not be in the build output.',
          );
          return;
        }
        const outDir = fileURLToPath(dir);
        const target = resolve(outDir, collectionsPath);
        mkdirSync(target, { recursive: true });
        const files = readdirSync(source).filter((f) =>
          f.endsWith('.schema.json'),
        );
        for (const f of files) {
          copyFileSync(resolve(source, f), resolve(target, f));
        }
      },
    },
  };
}

/**
 * Vite plugin that serves collection schemas in dev and resolves the virtual module.
 * @internal Not part of the public API — exported for testing only
 * @param {AstroIntegrationLogger} logger - Astro integration logger for warnings
 * @param {string} root - Project root directory, defaults to process.cwd()
 * @param {string} collectionsPath - URL path segment for schema files, defaults to 'collections'
 * @return {object} A Vite plugin object with configureServer, resolveId, and load hooks
 */
export function collectionsVitePlugin(
  logger: AstroIntegrationLogger,
  root: string = process.cwd(),
  collectionsPath: string = 'collections',
) {
  return {
    name: 'vite-plugin-nebula-cms',

    /**
     * Serves schema files from .astro/collections/ during dev via middleware.
     * @param {import('vite').ViteDevServer} server - The Vite dev server
     * @return {void}
     */
    configureServer(server: { middlewares: { use: Function } }) {
      const prefix = '/' + collectionsPath + '/';
      const collectionsDir = resolve(root, '.astro/collections');
      server.middlewares.use(
        (
          req: { url?: string },
          res: { setHeader: Function; end: Function },
          next: Function,
        ) => {
          const url = req.url ?? '';
          if (!url.startsWith(prefix) || !url.endsWith('.schema.json')) {
            return next();
          }
          const filename = url.slice(prefix.length);
          const filePath = resolve(collectionsDir, filename);
          // Reject path traversal attempts (e.g. /../../../etc/passwd.schema.json)
          if (!filePath.startsWith(collectionsDir + '/')) return next();
          if (!existsSync(filePath)) return next();

          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(filePath, 'utf-8'));
        },
      );
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

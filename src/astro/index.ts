/*
 * Astro integration entry point for Nebula CMS.
 * Exposes content collection JSON schemas and CMS configuration to
 * client-side JavaScript via virtual modules, dev middleware, and
 * build-time file copy.
 */

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

// Vite virtual module IDs
const CONFIG_VIRTUAL_ID = 'virtual:nebula/config';
const CONFIG_RESOLVED_ID = '\0' + CONFIG_VIRTUAL_ID;
const COLLECTIONS_VIRTUAL_ID = 'virtual:nebula/collections';
const COLLECTIONS_RESOLVED_ID = '\0' + COLLECTIONS_VIRTUAL_ID;

/*
 * Validation regex for normalized absolute paths. Still needed after URL
 * normalization because the URL API percent-encodes special characters rather
 * than rejecting them (e.g. '/admin/<script>' → '/admin/%3Cscript%3E').
 * The regex rejects percent-encoded sequences, dots, spaces, and any other
 * character that would cause routing issues.
 * Allows bare '/' (root mount) as a special case.
 */
const VALID_ABSOLUTE_PATH = /^(\/|\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*)$/;

/**
 * Normalizes a path config value to an absolute path using the URL API.
 * Handles leading-slash prepending, consecutive-slash collapsing, and
 * trailing-slash stripping.
 * @param {string} value - The raw config value
 * @return {string} The normalized absolute path
 */
function normalizePath(value: string): string {
  /*
   * Reject protocol-relative inputs ('//admin') — the URL API interprets
   * these as hostnames, silently producing pathname '/' instead of '/admin'.
   */
  if (value.startsWith('//')) {
    throw new Error(`Invalid path "${value}". Path must not start with "//".`);
  }
  /*
   * URL constructor with a dummy base handles both relative ('admin') and
   * absolute ('/admin') inputs identically. Collapse consecutive slashes
   * manually since the URL API preserves them in pathnames.
   */
  const collapsed = new URL(value, 'http://x').pathname.replace(/\/\/+/g, '/');
  // Strip trailing slash unless root
  if (collapsed.length > 1 && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
}

/**
 * Astro integration that exposes CMS configuration and content collection JSON schemas to client-side JavaScript via virtual modules, dev middleware, and build-time file copy.
 * @param {NebulaCMSConfig} config - Optional configuration object
 * @return {AstroIntegration} The configured Astro integration object
 */
export default function NebulaCMS(
  config: NebulaCMSConfig = {},
): AstroIntegration {
  if (config.basePath === '') {
    throw new Error(
      'Invalid basePath "". Provide a path like "/admin" or "/".',
    );
  }

  if (config.collectionsPath === '') {
    throw new Error(
      'Invalid collectionsPath "". Provide a path like "/collections".',
    );
  }

  const basePath = normalizePath(config.basePath ?? '/admin');
  const collectionsPath = normalizePath(
    config.collectionsPath ?? '/collections',
  );

  if (!VALID_ABSOLUTE_PATH.test(basePath)) {
    throw new Error(
      `Invalid basePath "${config.basePath}". Must contain only letters, digits, hyphens, and underscores.`,
    );
  }

  if (collectionsPath === '/') {
    throw new Error(
      'Invalid collectionsPath "/". Collections require a path prefix.',
    );
  }

  if (!VALID_ABSOLUTE_PATH.test(collectionsPath)) {
    throw new Error(
      `Invalid collectionsPath "${config.collectionsPath}". Must contain only letters, digits, hyphens, and underscores.`,
    );
  }

  // Normalized config passed to the Vite plugin
  const normalizedConfig = { basePath, collectionsPath };

  return {
    name: 'nebula-cms',
    hooks: {
      'astro:config:setup': ({ updateConfig, logger }) => {
        updateConfig({
          vite: {
            plugins: [
              nebulaVitePlugin(logger, process.cwd(), normalizedConfig),
            ],
            /*
             * Workers use dynamic imports (e.g. storage worker lazy-loads
             * adapters), which require code splitting. The default 'iife'
             * format does not support code splitting, so use ES modules.
             */
            worker: { format: 'es' },
            /*
             * smol-toml is only imported inside the TOML parser sub-worker,
             * never on the main thread. Without this, Vite discovers it late
             * and re-optimizes mid-session, causing the worker to request a
             * stale dep hash (504 Outdated Optimize Dep).
             */
            optimizeDeps: {
              include: ['smol-toml'],
            },
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
        // Strip leading slash for filesystem path resolution
        const target = resolve(outDir, collectionsPath.slice(1));
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
 * Vite plugin that serves collection schemas and CMS config via virtual modules.
 * @internal Not part of the public API — exported for testing only
 * @param {AstroIntegrationLogger} logger - Astro integration logger for warnings
 * @param {string} root - Project root directory
 * @param {Required<NebulaCMSConfig>} config - Normalized CMS configuration (both paths absolute, no trailing slash)
 * @return {object} A Vite plugin object with configureServer, resolveId, and load hooks
 */
export function nebulaVitePlugin(
  logger: AstroIntegrationLogger,
  root: string,
  config: Required<NebulaCMSConfig>,
) {
  return {
    name: 'vite-plugin-nebula-cms',

    /**
     * Registers dev middleware: serves schema files from .astro/collections/
     * and rewrites SPA sub-routes under basePath to the basePath page.
     * @param {{ middlewares: { use: Function } }} server - The Vite dev server
     * @return {void}
     */
    configureServer(server: { middlewares: { use: Function } }) {
      const prefix = config.collectionsPath + '/';
      const collectionsDir = resolve(root, '.astro/collections');

      // Serve collection schema JSON files
      server.middlewares.use(
        (
          req: { url?: string },
          res: { setHeader: Function; end: Function },
          next: Function,
        ) => {
          // Strip query string for path matching (e.g. cache-busting ?v=123)
          const url = (req.url ?? '').split('?')[0];
          if (!url.startsWith(prefix) || !url.endsWith('.schema.json')) {
            return next();
          }
          const filename = url.slice(prefix.length);
          const filePath = resolve(collectionsDir, filename);
          // Reject path traversal attempts (e.g. /../../../etc/passwd.schema.json)
          if (!filePath.startsWith(collectionsDir + '/')) return next();

          try {
            res.setHeader('Content-Type', 'application/json');
            res.end(readFileSync(filePath, 'utf-8'));
          } catch {
            // File may have been deleted between check and read (TOCTOU)
            return next();
          }
        },
      );

      // SPA fallback: rewrite HTML requests under basePath to basePath
      server.middlewares.use(
        (
          req: { url?: string; headers?: Record<string, string | undefined> },
          _res: unknown,
          next: Function,
        ) => {
          const rawURL = req.url ?? '';
          const accept = req.headers?.accept ?? '';

          // Only rewrite document requests
          if (!accept.includes('text/html')) return next();

          // Strip query string and fragment for path comparison
          const pathname = rawURL.split('?')[0].split('#')[0];

          /*
           * Check segment boundary: /admin/foo rewrites, /administrator does not.
           * Root basePath '/' needs special handling — every path is a sub-path
           * except '/' itself, mirroring router.svelte.ts isUnderBasePath.
           */
          const isSubPath =
            config.basePath === '/'
              ? pathname !== '/' && pathname.startsWith('/')
              : pathname !== config.basePath &&
                pathname.startsWith(config.basePath + '/');

          if (isSubPath) {
            req.url = config.basePath;
          }

          return next();
        },
      );
    },

    /**
     * Resolves virtual:nebula/* imports to Vite-internal IDs.
     * @param {string} id - The module ID being resolved
     * @return {string | undefined} The resolved internal ID, or undefined if not handled
     */
    resolveId(id: string) {
      if (id === CONFIG_VIRTUAL_ID) return CONFIG_RESOLVED_ID;
      if (id === COLLECTIONS_VIRTUAL_ID) return COLLECTIONS_RESOLVED_ID;
    },

    /**
     * Generates virtual module source code for config and collections.
     * @param {string} id - The resolved module ID to load
     * @return {string | undefined} Generated module source code, or undefined if not handled
     */
    load(id: string) {
      if (id === CONFIG_RESOLVED_ID) {
        return `export default ${JSON.stringify(config)};`;
      }

      if (id !== COLLECTIONS_RESOLVED_ID) return;

      const collectionsDir = resolve(root, '.astro/collections');

      // Guard: return empty object if directory doesn't exist
      if (!existsSync(collectionsDir)) {
        logger.warn(
          '`.astro/collections` not found — virtual:nebula/collections will be empty.',
        );
        return 'export default {};';
      }

      const files = readdirSync(collectionsDir).filter((f) =>
        f.endsWith('.schema.json'),
      );

      const entries = files.map((f) => {
        const name = f.replace('.schema.json', '');
        return `  ${JSON.stringify(name)}: ${JSON.stringify(config.collectionsPath + '/' + f)}`;
      });

      return `export default {\n${entries.join(',\n')}\n};`;
    },
  };
}

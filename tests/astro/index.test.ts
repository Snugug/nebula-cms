import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import NebulaCMS, { collectionsVitePlugin } from '../../src/astro/index.js';
import type { AstroIntegrationLogger } from 'astro';

//////////////////////////////
// Test Helpers
//////////////////////////////

/**
 * Creates a minimal mock satisfying the AstroIntegrationLogger interface
 * @return {AstroIntegrationLogger} Mock logger with a spied warn method
 */
function createMockLogger() {
  return { warn: vi.fn() } as unknown as AstroIntegrationLogger;
}

//////////////////////////////
// NebulaCMS integration object
//////////////////////////////

describe('NebulaCMS integration object', () => {
  it('returns an integration with name "nebula-cms"', () => {
    const integration = NebulaCMS();
    expect(integration.name).toBe('nebula-cms');
  });

  it('registers a Vite plugin via astro:config:setup', () => {
    const integration = NebulaCMS();
    const updateConfig = vi.fn();
    const logger = createMockLogger();

    // Invoke the hook with the minimal shape it expects
    const hook = integration.hooks['astro:config:setup'] as Function;
    hook({ updateConfig, logger });

    expect(updateConfig).toHaveBeenCalledWith({
      vite: {
        plugins: [expect.objectContaining({ name: 'vite-plugin-nebula-cms' })],
        worker: { format: 'es' },
      },
    });
  });

  it('accepts a valid collectionsPath', () => {
    const integration = NebulaCMS({ collectionsPath: 'schemas' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('throws on collectionsPath with leading slash', () => {
    expect(() => NebulaCMS({ collectionsPath: '/schemas' })).toThrow(
      'Invalid collectionsPath',
    );
  });

  it('throws on collectionsPath with path traversal', () => {
    expect(() => NebulaCMS({ collectionsPath: '..' })).toThrow(
      'Invalid collectionsPath',
    );
  });

  it('throws on empty collectionsPath', () => {
    expect(() => NebulaCMS({ collectionsPath: '' })).toThrow(
      'Invalid collectionsPath',
    );
  });

  it('throws on collectionsPath containing a slash', () => {
    expect(() => NebulaCMS({ collectionsPath: 'a/b' })).toThrow(
      'Invalid collectionsPath',
    );
  });
});

//////////////////////////////
// resolveId hook
//////////////////////////////

describe('collectionsVitePlugin resolveId', () => {
  it('resolves virtual:collections to the internal ID', () => {
    const plugin = collectionsVitePlugin(createMockLogger(), '/fake');
    expect(plugin.resolveId('virtual:collections')).toBe(
      '\0virtual:collections',
    );
  });

  it('returns undefined for unrelated module IDs', () => {
    const plugin = collectionsVitePlugin(createMockLogger(), '/fake');
    expect(plugin.resolveId('some-other-module')).toBeUndefined();
  });
});

//////////////////////////////
// configureServer middleware
//////////////////////////////

describe('collectionsVitePlugin configureServer', () => {
  let tmpDir: string;
  let logger: AstroIntegrationLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nebula-test-'));
    logger = createMockLogger();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Creates a fake Connect-style middleware stack to capture the registered handler.
   * @return {{ use: ReturnType<typeof vi.fn>, handler: Function | null }}
   */
  function createMiddlewareStub() {
    let handler: Function | null = null;
    return {
      use: vi.fn((fn: Function) => {
        handler = fn;
      }),
      get handler() {
        return handler;
      },
    };
  }

  /**
   * Simulates a middleware request/response cycle.
   * @param {Function} handler - The middleware handler
   * @param {string} url - The request URL
   * @return {{ status: 'served' | 'skipped', body?: string, contentType?: string }}
   */
  function callMiddleware(handler: Function, url: string) {
    let result: { status: string; body?: string; contentType?: string } = {
      status: 'skipped',
    };
    const req = { url };
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      end: (body: string) => {
        result = {
          status: 'served',
          body,
          contentType: headers['Content-Type'],
        };
      },
    };
    const next = () => {
      result = { status: 'skipped' };
    };
    handler(req, res, next);
    return result;
  }

  it('serves schema files from .astro/collections', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{"type":"object"}');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callMiddleware(
      mw.handler!,
      '/collections/posts.schema.json',
    );
    expect(result.status).toBe('served');
    expect(result.body).toBe('{"type":"object"}');
    expect(result.contentType).toBe('application/json');
  });

  it('calls next() for non-schema requests', () => {
    const plugin = collectionsVitePlugin(logger, tmpDir);
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callMiddleware(mw.handler!, '/some/other/path');
    expect(result.status).toBe('skipped');
  });

  it('calls next() when schema file does not exist', () => {
    const plugin = collectionsVitePlugin(logger, tmpDir);
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callMiddleware(
      mw.handler!,
      '/collections/missing.schema.json',
    );
    expect(result.status).toBe('skipped');
  });

  it('uses custom collectionsPath prefix', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = collectionsVitePlugin(logger, tmpDir, 'schemas');
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    // Default path should not match
    const miss = callMiddleware(mw.handler!, '/collections/posts.schema.json');
    expect(miss.status).toBe('skipped');

    // Custom path should match
    const hit = callMiddleware(mw.handler!, '/schemas/posts.schema.json');
    expect(hit.status).toBe('served');
  });
});

//////////////////////////////
// astro:build:done hook
//////////////////////////////

describe('NebulaCMS astro:build:done', () => {
  let tmpDir: string;
  let logger: AstroIntegrationLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nebula-test-'));
    logger = createMockLogger();
    // Override process.cwd for the integration
    vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies schema files into the build output directory', () => {
    const source = resolve(tmpDir, '.astro/collections');
    mkdirSync(source, { recursive: true });
    writeFileSync(resolve(source, 'posts.schema.json'), '{"type":"object"}');
    writeFileSync(resolve(source, 'authors.schema.json'), '{"a":1}');

    const outDir = resolve(tmpDir, 'dist');
    mkdirSync(outDir, { recursive: true });

    const integration = NebulaCMS();
    const hook = integration.hooks['astro:build:done'] as Function;
    hook({ dir: pathToFileURL(outDir + '/'), logger });

    const target = resolve(outDir, 'collections');
    expect(existsSync(resolve(target, 'posts.schema.json'))).toBe(true);
    expect(existsSync(resolve(target, 'authors.schema.json'))).toBe(true);
    expect(readFileSync(resolve(target, 'posts.schema.json'), 'utf-8')).toBe(
      '{"type":"object"}',
    );
  });

  it('warns when .astro/collections does not exist', () => {
    const outDir = resolve(tmpDir, 'dist');
    mkdirSync(outDir, { recursive: true });

    const integration = NebulaCMS();
    const hook = integration.hooks['astro:build:done'] as Function;
    hook({ dir: pathToFileURL(outDir + '/'), logger });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('.astro/collections'),
    );
  });

  it('uses custom collectionsPath for the output directory', () => {
    const source = resolve(tmpDir, '.astro/collections');
    mkdirSync(source, { recursive: true });
    writeFileSync(resolve(source, 'posts.schema.json'), '{}');

    const outDir = resolve(tmpDir, 'dist');
    mkdirSync(outDir, { recursive: true });

    const integration = NebulaCMS({ collectionsPath: 'schemas' });
    const hook = integration.hooks['astro:build:done'] as Function;
    hook({ dir: pathToFileURL(outDir + '/'), logger });

    expect(existsSync(resolve(outDir, 'schemas/posts.schema.json'))).toBe(true);
    expect(existsSync(resolve(outDir, 'collections'))).toBe(false);
  });
});

//////////////////////////////
// load hook
//////////////////////////////

describe('collectionsVitePlugin load', () => {
  let tmpDir: string;
  let logger: AstroIntegrationLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nebula-test-'));
    logger = createMockLogger();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined for unrelated module IDs', () => {
    const plugin = collectionsVitePlugin(logger, tmpDir);
    expect(plugin.load('some-other-id')).toBeUndefined();
  });

  it('generates module source mapping collection name to schema URL', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    const result = plugin.load('\0virtual:collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"/collections/posts.schema.json"');
  });

  it('handles multiple schema files', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');
    writeFileSync(resolve(dir, 'authors.schema.json'), '{}');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    const result = plugin.load('\0virtual:collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"/collections/posts.schema.json"');
    expect(result).toContain('"authors"');
    expect(result).toContain('"/collections/authors.schema.json"');
  });

  it('ignores non-.schema.json files in the directory', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');
    writeFileSync(resolve(dir, 'README.md'), '');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    const result = plugin.load('\0virtual:collections');

    expect(result).toContain('"posts"');
    expect(result).not.toContain('README');
  });

  it('strips .schema.json suffix for collection names', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'my-collection.schema.json'), '{}');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    const result = plugin.load('\0virtual:collections');

    expect(result).toContain('"my-collection"');
    expect(result).not.toContain('.schema.json":');
  });

  it('returns empty default export and warns when directory is missing', () => {
    const plugin = collectionsVitePlugin(logger, tmpDir);
    const result = plugin.load('\0virtual:collections');

    expect(result).toBe('export default {};');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('.astro/collections'),
    );
  });

  it('generates URLs with custom collectionsPath prefix', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = collectionsVitePlugin(logger, tmpDir, 'schemas');
    const result = plugin.load('\0virtual:collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"/schemas/posts.schema.json"');
    expect(result).not.toContain('/collections/');
  });
});

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
import NebulaCMS, { nebulaVitePlugin } from '../../src/astro/index.js';
import type { AstroIntegrationLogger } from 'astro';

/*
//////////////////////////////
// Test Helpers
//////////////////////////////
*/

/**
 * Creates a minimal mock satisfying the AstroIntegrationLogger interface
 * @return {AstroIntegrationLogger} Mock logger with a spied warn method
 */
function createMockLogger() {
  return { warn: vi.fn() } as unknown as AstroIntegrationLogger;
}

/*
//////////////////////////////
// NebulaCMS integration object
//////////////////////////////
*/

describe('NebulaCMS integration object', () => {
  it('returns an integration with name "nebula-cms"', () => {
    const integration = NebulaCMS();
    expect(integration.name).toBe('nebula-cms');
  });

  it('registers a Vite plugin via astro:config:setup', () => {
    const integration = NebulaCMS();
    const updateConfig = vi.fn();
    const logger = createMockLogger();

    const hook = integration.hooks['astro:config:setup'] as Function;
    hook({ updateConfig, logger });

    expect(updateConfig).toHaveBeenCalledWith({
      vite: {
        plugins: [expect.objectContaining({ name: 'vite-plugin-nebula-cms' })],
        worker: { format: 'es' },
        optimizeDeps: { include: ['smol-toml'] },
      },
    });
  });

  it('accepts a valid absolute basePath', () => {
    const integration = NebulaCMS({ basePath: '/dashboard' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('normalizes basePath without leading slash', () => {
    // Should not throw — 'admin' is normalized to '/admin'
    const integration = NebulaCMS({ basePath: 'admin' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('normalizes basePath with trailing slash', () => {
    // Should not throw — '/admin/' is normalized to '/admin'
    const integration = NebulaCMS({ basePath: '/admin/' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('throws on basePath with invalid characters', () => {
    expect(() => NebulaCMS({ basePath: '/admin/<script>' })).toThrow(
      'Invalid basePath',
    );
  });

  it('accepts a valid absolute collectionsPath', () => {
    const integration = NebulaCMS({ collectionsPath: '/schemas' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('normalizes collectionsPath without leading slash', () => {
    const integration = NebulaCMS({ collectionsPath: 'schemas' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('normalizes collectionsPath with trailing slash', () => {
    const integration = NebulaCMS({ collectionsPath: '/schemas/' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('throws on collectionsPath with invalid characters', () => {
    expect(() => NebulaCMS({ collectionsPath: '/my schemas' })).toThrow(
      'Invalid collectionsPath',
    );
  });

  it('throws on empty collectionsPath', () => {
    expect(() => NebulaCMS({ collectionsPath: '' })).toThrow(
      'Invalid collectionsPath',
    );
  });

  it('accepts root basePath /', () => {
    const integration = NebulaCMS({ basePath: '/' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('collapses consecutive slashes in basePath', () => {
    // '/admin//' is normalized to '/admin' via URL API
    const integration = NebulaCMS({ basePath: '/admin//' });
    expect(integration.name).toBe('nebula-cms');
  });

  it('throws on empty basePath', () => {
    expect(() => NebulaCMS({ basePath: '' })).toThrow('Invalid basePath ""');
  });
});

/*
//////////////////////////////
// resolveId hook
//////////////////////////////
*/

describe('nebulaVitePlugin resolveId', () => {
  it('resolves virtual:nebula/collections to the internal ID', () => {
    const plugin = nebulaVitePlugin(createMockLogger(), '/fake', {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    expect(plugin.resolveId('virtual:nebula/collections')).toBe(
      '\0virtual:nebula/collections',
    );
  });

  it('resolves virtual:nebula/config to the internal ID', () => {
    const plugin = nebulaVitePlugin(createMockLogger(), '/fake', {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    expect(plugin.resolveId('virtual:nebula/config')).toBe(
      '\0virtual:nebula/config',
    );
  });

  it('returns undefined for unrelated module IDs', () => {
    const plugin = nebulaVitePlugin(createMockLogger(), '/fake', {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    expect(plugin.resolveId('some-other-module')).toBeUndefined();
  });

  it('does not resolve old virtual:collections ID', () => {
    const plugin = nebulaVitePlugin(createMockLogger(), '/fake', {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    expect(plugin.resolveId('virtual:collections')).toBeUndefined();
  });
});

/*
//////////////////////////////
// configureServer middleware
//////////////////////////////
*/

describe('nebulaVitePlugin configureServer', () => {
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
   * Creates a fake Connect-style middleware stack to capture registered handlers.
   * @return {{ use: ReturnType<typeof vi.fn>, handlers: Function[] }}
   */
  function createMiddlewareStub() {
    const handlers: Function[] = [];
    return {
      use: vi.fn((fn: Function) => {
        handlers.push(fn);
      }),
      get handlers() {
        return handlers;
      },
    };
  }

  /**
   * Simulates a middleware request/response cycle for the schema middleware.
   * @param {Function} handler - The middleware handler
   * @param {string} url - The request URL
   * @return {{ status: 'served' | 'skipped', body?: string, contentType?: string }}
   */
  function callSchemaMiddleware(handler: Function, url: string) {
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

  /**
   * Simulates a middleware request/response cycle for the SPA rewrite middleware.
   * @param {Function} handler - The middleware handler
   * @param {string} url - The request URL
   * @param {string} accept - The Accept header value
   * @return {{ rewritten: boolean, url: string, nextCalled: boolean }}
   */
  function callRewriteMiddleware(
    handler: Function,
    url: string,
    accept: string,
  ) {
    const req = { url, headers: { accept } };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    handler(req, {}, next);
    return { rewritten: req.url !== url, url: req.url, nextCalled };
  }

  it('serves schema files from .astro/collections', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{"type":"object"}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    // First handler is the schema middleware
    const result = callSchemaMiddleware(
      mw.handlers[0],
      '/collections/posts.schema.json',
    );
    expect(result.status).toBe('served');
    expect(result.body).toBe('{"type":"object"}');
    expect(result.contentType).toBe('application/json');
  });

  it('calls next() for non-schema requests', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callSchemaMiddleware(mw.handlers[0], '/some/other/path');
    expect(result.status).toBe('skipped');
  });

  it('calls next() when schema file does not exist', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callSchemaMiddleware(
      mw.handlers[0],
      '/collections/missing.schema.json',
    );
    expect(result.status).toBe('skipped');
  });

  it('uses custom collectionsPath prefix', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/schemas',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const miss = callSchemaMiddleware(
      mw.handlers[0],
      '/collections/posts.schema.json',
    );
    expect(miss.status).toBe('skipped');

    const hit = callSchemaMiddleware(
      mw.handlers[0],
      '/schemas/posts.schema.json',
    );
    expect(hit.status).toBe('served');
  });

  it('rewrites HTML requests under basePath to basePath', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    // Second handler is the SPA rewrite middleware
    const result = callRewriteMiddleware(
      mw.handlers[1],
      '/admin/posts/my-article',
      'text/html',
    );
    expect(result.rewritten).toBe(true);
    expect(result.url).toBe('/admin');
  });

  it('does not rewrite exact basePath requests', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callRewriteMiddleware(mw.handlers[1], '/admin', 'text/html');
    expect(result.rewritten).toBe(false);
  });

  it('does not rewrite non-HTML requests under basePath', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callRewriteMiddleware(
      mw.handlers[1],
      '/admin/posts/my-article',
      'application/json',
    );
    expect(result.rewritten).toBe(false);
  });

  it('respects segment boundary — /administrator does not rewrite', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callRewriteMiddleware(
      mw.handlers[1],
      '/administrator',
      'text/html',
    );
    expect(result.rewritten).toBe(false);
  });

  it('rewrites with custom basePath', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/nebula',
      collectionsPath: '/collections',
    });
    const mw = createMiddlewareStub();
    plugin.configureServer({ middlewares: mw });

    const result = callRewriteMiddleware(
      mw.handlers[1],
      '/nebula/posts/draft-12345678',
      'text/html',
    );
    expect(result.rewritten).toBe(true);
    expect(result.url).toBe('/nebula');
  });
});

/*
//////////////////////////////
// astro:build:done hook
//////////////////////////////
*/

describe('NebulaCMS astro:build:done', () => {
  let tmpDir: string;
  let logger: AstroIntegrationLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nebula-test-'));
    logger = createMockLogger();
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

    const integration = NebulaCMS({ collectionsPath: '/schemas' });
    const hook = integration.hooks['astro:build:done'] as Function;
    hook({ dir: pathToFileURL(outDir + '/'), logger });

    expect(existsSync(resolve(outDir, 'schemas/posts.schema.json'))).toBe(true);
    expect(existsSync(resolve(outDir, 'collections'))).toBe(false);
  });
});

/*
//////////////////////////////
// load hook
//////////////////////////////
*/

describe('nebulaVitePlugin load', () => {
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
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    expect(plugin.load('some-other-id')).toBeUndefined();
  });

  it('generates config module with basePath and collectionsPath', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/dashboard',
      collectionsPath: '/schemas',
    });
    const result = plugin.load('\0virtual:nebula/config');

    expect(result).toContain('"/dashboard"');
    expect(result).toContain('"/schemas"');
    expect(result).toContain('export default');
  });

  it('generates collections module mapping names to schema URLs', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"/collections/posts.schema.json"');
  });

  it('handles multiple schema files', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');
    writeFileSync(resolve(dir, 'authors.schema.json'), '{}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"authors"');
  });

  it('ignores non-.schema.json files in the directory', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');
    writeFileSync(resolve(dir, 'README.md'), '');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toContain('"posts"');
    expect(result).not.toContain('README');
  });

  it('strips .schema.json suffix for collection names', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'my-collection.schema.json'), '{}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toContain('"my-collection"');
    expect(result).not.toContain('.schema.json":');
  });

  it('returns empty default export and warns when directory is missing', () => {
    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/collections',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toBe('export default {};');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('.astro/collections'),
    );
  });

  it('generates URLs with custom collectionsPath prefix', () => {
    const dir = resolve(tmpDir, '.astro/collections');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'posts.schema.json'), '{}');

    const plugin = nebulaVitePlugin(logger, tmpDir, {
      basePath: '/admin',
      collectionsPath: '/schemas',
    });
    const result = plugin.load('\0virtual:nebula/collections');

    expect(result).toContain('"posts"');
    expect(result).toContain('"/schemas/posts.schema.json"');
    expect(result).not.toContain('/collections/');
  });
});

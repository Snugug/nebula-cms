import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
} from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
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

  it('has an astro:config:setup hook', () => {
    const integration = NebulaCMS();
    expect(integration.hooks['astro:config:setup']).toBeTypeOf('function');
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
// buildStart hook
//////////////////////////////

describe('collectionsVitePlugin buildStart', () => {
  let tmpDir: string;
  let logger: AstroIntegrationLogger;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'nebula-test-'));
    logger = createMockLogger();
    // buildStart expects public/ to exist as the symlink's parent directory
    mkdirSync(resolve(tmpDir, 'public'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a relative symlink when source exists and target does not', () => {
    mkdirSync(resolve(tmpDir, '.astro/collections'), { recursive: true });
    const plugin = collectionsVitePlugin(logger, tmpDir);
    plugin.buildStart();

    const target = resolve(tmpDir, 'public/collections');
    const stat = lstatSync(target);
    expect(stat.isSymbolicLink()).toBe(true);

    // Verify the symlink is relative, not absolute
    const linkValue = readlinkSync(target);
    const expected = relative(
      resolve(tmpDir, 'public'),
      resolve(tmpDir, '.astro/collections'),
    );
    expect(linkValue).toBe(expected);
  });

  it('no-ops when the correct symlink already exists', () => {
    mkdirSync(resolve(tmpDir, '.astro/collections'), { recursive: true });
    const plugin = collectionsVitePlugin(logger, tmpDir);

    // Create the symlink on first call
    plugin.buildStart();
    // Second call should not throw, warn, or change anything
    plugin.buildStart();

    const target = resolve(tmpDir, 'public/collections');
    const stat = lstatSync(target);
    expect(stat.isSymbolicLink()).toBe(true);
    // Verify the symlink still points to the correct target
    const resolvedLink = resolve(dirname(target), readlinkSync(target));
    expect(resolvedLink).toBe(resolve(tmpDir, '.astro/collections'));
    // Verify no warning was logged on the idempotent call
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('replaces a symlink pointing to the wrong target', () => {
    mkdirSync(resolve(tmpDir, '.astro/collections'), { recursive: true });
    mkdirSync(resolve(tmpDir, 'wrong-target'), { recursive: true });

    // Create a symlink pointing to the wrong place
    const target = resolve(tmpDir, 'public/collections');
    const wrongRel = relative(dirname(target), resolve(tmpDir, 'wrong-target'));
    symlinkSync(wrongRel, target);

    const plugin = collectionsVitePlugin(logger, tmpDir);
    plugin.buildStart();

    const resolvedLink = resolve(dirname(target), readlinkSync(target));
    expect(resolvedLink).toBe(resolve(tmpDir, '.astro/collections'));
  });

  it('removes a real directory at the target and replaces with symlink', () => {
    mkdirSync(resolve(tmpDir, '.astro/collections'), { recursive: true });
    mkdirSync(resolve(tmpDir, 'public/collections'), { recursive: true });

    const plugin = collectionsVitePlugin(logger, tmpDir);
    plugin.buildStart();

    const stat = lstatSync(resolve(tmpDir, 'public/collections'));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it('removes a regular file at the target and replaces with symlink', () => {
    mkdirSync(resolve(tmpDir, '.astro/collections'), { recursive: true });
    writeFileSync(resolve(tmpDir, 'public/collections'), 'not a symlink');

    const plugin = collectionsVitePlugin(logger, tmpDir);
    plugin.buildStart();

    const stat = lstatSync(resolve(tmpDir, 'public/collections'));
    expect(stat.isSymbolicLink()).toBe(true);
  });

  it('warns and skips when .astro/collections does not exist', () => {
    const plugin = collectionsVitePlugin(logger, tmpDir);
    plugin.buildStart();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('.astro/collections'),
    );
    expect(existsSync(resolve(tmpDir, 'public/collections'))).toBe(false);
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
});

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

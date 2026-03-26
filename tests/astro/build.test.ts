import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  existsSync,
  lstatSync,
  readlinkSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
} from 'node:fs';

// Resolve playground path relative to this test file
const playgroundDir = resolve(import.meta.dirname, '../../playground');
const rootDir = resolve(playgroundDir, '..');

describe('playground build integration', () => {
  beforeAll(() => {
    // Build root package so playground can resolve the nebula-cms integration
    execFileSync('pnpm', ['build'], { cwd: rootDir, stdio: 'pipe' });
    // Generate collection schemas, then build the Astro site
    execFileSync('pnpm', ['sync'], { cwd: playgroundDir, stdio: 'pipe' });
    execFileSync('pnpm', ['build'], { cwd: playgroundDir, stdio: 'pipe' });
  }, 60_000);

  afterAll(() => {
    // Clean up generated artifacts that aren't gitignored
    // unlinkSync removes the symlink itself; rmSync follows it and fails on directories
    const symlink = resolve(playgroundDir, 'public/collections');
    if (existsSync(symlink)) unlinkSync(symlink);
    const dist = resolve(playgroundDir, 'dist');
    if (existsSync(dist)) rmSync(dist, { recursive: true });
  });

  it('creates a symlink at public/collections pointing to .astro/collections', () => {
    const target = resolve(playgroundDir, 'public/collections');
    const stat = lstatSync(target);
    expect(stat.isSymbolicLink()).toBe(true);

    const linkDest = readlinkSync(target);
    expect(linkDest).toBe('../.astro/collections');
  });

  it('generates .schema.json for all four collections', () => {
    const collectionsDir = resolve(playgroundDir, '.astro/collections');
    const files = readdirSync(collectionsDir).filter((f) =>
      f.endsWith('.schema.json'),
    );
    const names = files.map((f) => f.replace('.schema.json', ''));

    expect(names).toContain('posts');
    expect(names).toContain('authors');
    expect(names).toContain('products');
    expect(names).toContain('courses');
  });

  it('bundles collection schema paths into the client JS', () => {
    // Admin uses client:only="svelte", so collection data lives in the JS
    // bundle via the virtual:collections module, not in the static HTML.
    const assetDir = resolve(playgroundDir, 'dist/_astro');
    const jsFiles = readdirSync(assetDir).filter((f) => f.endsWith('.js'));
    const allJs = jsFiles
      .map((f) => readFileSync(resolve(assetDir, f), 'utf-8'))
      .join('\n');

    for (const name of ['posts', 'authors', 'products', 'courses']) {
      expect(allJs).toContain(`/collections/${name}.schema.json`);
    }
  });
});

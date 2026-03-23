# Project Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold nebula-cms as an Astro integration package that also ships Svelte components and TypeScript types, with Vitest testing and a playground dev environment.

**Architecture:** `@sveltejs/package` builds the entire `src/` tree file-by-file (no bundling) into `dist/`. Source is split into `src/astro/` (Node-side integration), `src/client/` (browser-side Svelte components), and `src/types.ts` (shared types). A `playground/` Astro project consumes the package via `link:..` for development. Vitest with `@sveltejs/vite-plugin-svelte` provides the test environment with c8 coverage.

**Tech Stack:** Astro ^6, Svelte ^5, @astrojs/svelte ^8, @sveltejs/package, Vitest, TypeScript (strict)

**Spec:** `docs/superpowers/specs/2026-03-23-project-scaffolding-design.md`

---

### Task 1: Install dependencies and update root package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install production peer deps as devDependencies**

Run: `pnpm add -D astro@^6.0.0 svelte@^5.0.0 @astrojs/svelte@^8.0.0`

- [ ] **Step 2: Install build tooling**

Run: `pnpm add -D @sveltejs/package typescript`

- [ ] **Step 3: Install test tooling**

Run: `pnpm add -D vitest @vitest/coverage-v8 @sveltejs/vite-plugin-svelte @testing-library/svelte`

- [ ] **Step 4: Update package.json fields**

Update `package.json` to set `type`, `exports`, `peerDependencies`, `keywords`, and `scripts`. Remove the `main` field (replaced by `exports`).

```json
{
  "name": "nebula-cms",
  "version": "0.0.1",
  "description": "A native CMS for Astro",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/astro/index.d.ts",
      "default": "./dist/astro/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "svelte": "./dist/client/index.js",
      "default": "./dist/client/index.js"
    },
    "./client/*.svelte": {
      "types": "./dist/client/*.svelte.d.ts",
      "svelte": "./dist/client/*.svelte"
    },
    "./types": {
      "types": "./dist/types.d.ts",
      "default": "./dist/types.js"
    }
  },
  "scripts": {
    "build": "svelte-package --input src --output dist",
    "lint": "prettier -c .",
    "fix": "prettier --write .",
    "test": "vitest"
  },
  "keywords": [
    "cms",
    "astro",
    "astro-integration"
  ],
  "peerDependencies": {
    "astro": "^6.0.0",
    "svelte": "^5.0.0",
    "@astrojs/svelte": "^8.0.0"
  },
  "author": "Sam Richard<sam@snug.ug>",
  "license": "Apache-2.0",
  "packageManager": "pnpm@10.26.0"
}
```

Note: `devDependencies` will already be populated from steps 1-3. Merge them with the existing prettier deps. The final `package.json` should contain all fields shown above plus the full `devDependencies` block.

- [ ] **Step 5: Run `pnpm lint` and `pnpm fix`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 6: Commit**

```
git add package.json pnpm-lock.yaml
git commit -m "Install dependencies and configure package.json exports"
```

---

### Task 2: Add TypeScript and Svelte configuration

**Files:**
- Create: `tsconfig.json`
- Create: `svelte.config.js`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["svelte", "vitest/globals"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "playground", "tests"]
}
```

- [ ] **Step 2: Create svelte.config.js**

Minimal config — no preprocessors needed initially since `@sveltejs/package` handles TypeScript in `<script lang="ts">` blocks natively via `svelte2tsx`.

```js
/** @type {import('@sveltejs/package').Config} */
const config = {};

export default config;
```

- [ ] **Step 3: Run `pnpm fix` and `pnpm lint`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add tsconfig.json svelte.config.js
git commit -m "Add TypeScript and Svelte configuration"
```

---

### Task 3: Create Vitest configuration

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      enabled: true,
    },
  },
});
```

- [ ] **Step 2: Run `pnpm fix` and `pnpm lint`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add vitest.config.ts
git commit -m "Add Vitest configuration with c8 coverage"
```

---

### Task 4: Create source file stubs

**Files:**
- Create: `src/astro/index.ts`
- Create: `src/client/index.ts`
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

Placeholder type export so the module is valid and importable.

```ts
/**
 * Placeholder configuration for nebula-cms.
 * Will be expanded as the CMS feature set is defined.
 */
export interface NebulaCMSConfig {
  // Configuration options will be added here
}
```

- [ ] **Step 2: Create src/astro/index.ts**

Minimal Astro integration that satisfies the `AstroIntegration` interface.

```ts
import type { AstroIntegration } from 'astro';
import type { NebulaCMSConfig } from '../types.js';

/**
 * Creates the nebula-cms Astro integration.
 * Registers the CMS with an Astro project via the integration API.
 *
 * @param {NebulaCMSConfig} _config - CMS configuration options
 * @return {AstroIntegration} The Astro integration object
 */
export default function nebulaCMS(
  _config: NebulaCMSConfig = {},
): AstroIntegration {
  return {
    name: 'nebula-cms',
    hooks: {},
  };
}
```

- [ ] **Step 3: Create src/client/index.ts**

Empty barrel export — components will be added and re-exported here as they're built.

```ts
// Svelte component barrel exports will be added here as components are created.
```

- [ ] **Step 4: Run `pnpm fix` and `pnpm lint`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```
git add src/
git commit -m "Add source file stubs for astro integration, client, and types"
```

---

### Task 5: Create test stubs and verify Vitest runs

**Files:**
- Create: `tests/astro/index.test.ts`

- [ ] **Step 1: Write a basic integration test**

```ts
import { describe, it, expect } from 'vitest';
import nebulaCMS from '../../src/astro/index.js';

describe('nebulaCMS integration', () => {
  it('returns an integration object with the correct name', () => {
    const integration = nebulaCMS();
    expect(integration.name).toBe('nebula-cms');
  });

  it('returns an integration object with a hooks property', () => {
    const integration = nebulaCMS();
    expect(integration.hooks).toBeDefined();
    expect(typeof integration.hooks).toBe('object');
  });

  it('accepts an empty config', () => {
    const integration = nebulaCMS({});
    expect(integration.name).toBe('nebula-cms');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- --run`
Expected: 3 tests pass. Coverage report is output.

- [ ] **Step 3: Run `pnpm fix` and `pnpm lint`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add tests/
git commit -m "Add integration test stubs and verify Vitest runs"
```

---

### Task 6: Verify build pipeline

**Files:**
- No new files — validates existing setup.

- [ ] **Step 1: Run the build**

Run: `pnpm build`
Expected: `dist/` directory is created with:
- `dist/astro/index.js` + `dist/astro/index.d.ts`
- `dist/client/index.js` + `dist/client/index.d.ts`
- `dist/types.js` + `dist/types.d.ts`

- [ ] **Step 2: Verify dist output exists**

Check that the expected files are in `dist/`. If any are missing or the build errors, troubleshoot `@sveltejs/package` configuration (may need to adjust `svelte.config.js` or CLI flags).

- [ ] **Step 3: Clean dist (do not commit build output)**

Run: `rm -rf dist`

`dist/` is already in `.gitignore`, so this is just cleanup.

---

### Task 7: Create playground Astro project

**Files:**
- Create: `playground/package.json`
- Create: `playground/astro.config.mjs`
- Create: `playground/src/pages/index.astro`

- [ ] **Step 1: Create playground/package.json**

```json
{
  "name": "nebula-cms-playground",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build"
  },
  "dependencies": {
    "nebula-cms": "link:..",
    "astro": "^6.0.0",
    "@astrojs/svelte": "^8.0.0",
    "svelte": "^5.0.0"
  }
}
```

- [ ] **Step 2: Create playground/astro.config.mjs**

```js
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import nebulaCMS from 'nebula-cms';

export default defineConfig({
  integrations: [svelte(), nebulaCMS()],
});
```

- [ ] **Step 3: Create playground/src/pages/index.astro**

```astro
---
// Smoke-test page for nebula-cms development
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>nebula-cms playground</title>
  </head>
  <body>
    <h1>nebula-cms playground</h1>
    <p>Integration loaded successfully.</p>
  </body>
</html>
```

- [ ] **Step 4: Install playground dependencies**

Run: `cd playground`
Run: `pnpm install`

- [ ] **Step 5: Update .prettierignore**

Add `playground/` to `.prettierignore` so root prettier doesn't format the playground's generated files. The playground is a separate project with its own concerns.

Actually — the playground source files (`.astro`, `.mjs`) should still be formatted by the root prettier. Only add `playground/node_modules` and `playground/.astro` to `.prettierignore` if they aren't already covered.

Check if the existing `.prettierignore` already covers `node_modules` globally. If it does, no changes needed. If not, add:
```
playground/node_modules
playground/.astro
```

- [ ] **Step 6: Update .gitignore**

Add `playground/node_modules` and `playground/.astro` to `.gitignore` if not already covered by the existing patterns.

The existing `.gitignore` has `node_modules/` (with trailing slash, which covers all `node_modules` dirs recursively) and `.astro`. Verify these patterns cover the playground subdirectory. If they do, no changes needed.

- [ ] **Step 7: Run `pnpm fix` and `pnpm lint` from root**

Run: `cd /Users/avalon/Development/nebula-cms`
Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 8: Commit**

```
git add playground/ .prettierignore .gitignore
git commit -m "Add playground Astro project for development"
```

---

### Task 8: Verify playground dev server starts

**Files:**
- No new files — validates playground setup.

- [ ] **Step 1: Start the playground dev server**

Run: `cd playground`
Run: `pnpm dev`

Expected: Astro dev server starts without errors. The nebula-cms integration is loaded (check console output for integration registration). Navigate to the local URL and verify the page renders.

- [ ] **Step 2: Stop the dev server**

Ctrl+C to stop. This task is purely a verification step — no commit needed.

---

### Task 9: Clean up .prettierignore

**Files:**
- Modify: `.prettierignore`

The current `.prettierignore` contains entries from a different project (e.g., `public/fonts/dank-mono.css`, `lib/tweetback/tweets.js`, `.firebase/`, etc.) that don't apply to nebula-cms.

- [ ] **Step 1: Replace .prettierignore with project-relevant entries**

```
dist
pnpm-lock.yaml
node_modules
.astro
```

- [ ] **Step 2: Run `pnpm fix` and `pnpm lint`**

Run: `pnpm fix`
Run: `pnpm lint`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add .prettierignore
git commit -m "Clean up .prettierignore for nebula-cms"
```

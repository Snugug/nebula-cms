# nebula-cms Project Scaffolding Design

## Overview

nebula-cms is a native CMS for Astro, distributed as an npm package. It exposes three concerns:

1. **Astro integration** — a plugin function users register in `astro.config.mjs`
2. **Svelte components** — UI components users import into their pages/layouts
3. **TypeScript types** — shared type definitions for the CMS data model

The package ships as ESM only. Svelte components are distributed as preprocessed `.svelte` source files (not compiled to JS), letting the consumer's Astro/Vite pipeline handle final compilation.

## Project Structure

```
nebula-cms/
├── src/
│   ├── astro/
│   │   └── index.ts              # Astro integration entry — default export function
│   ├── client/
│   │   └── index.ts              # Barrel export for Svelte components
│   └── types.ts                  # Public TypeScript type definitions
├── playground/
│   ├── astro.config.mjs          # Imports integration from nebula-cms (linked)
│   ├── package.json              # Private package — astro, @astrojs/svelte, svelte, link:..
│   └── src/
│       └── pages/
│           └── index.astro       # Smoke-test page using integration + components
├── tests/
│   ├── astro/
│   │   └── index.test.ts         # Integration function tests
│   ├── client/
│   │   └── (component tests, mirrors src/client/)
│   └── types/
│       └── (type-level assertion tests if needed)
├── svelte.config.js              # Svelte preprocessor config — shared across all tools
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── .gitignore
├── .prettierrc.cjs
├── .prettierignore
└── CLAUDE.md
```

### Directory Responsibilities

- `src/astro/` — Node-side code. The Astro integration function that runs during build/dev. Hooks into Astro's lifecycle (route injection, config modification, etc.).
- `src/client/` — Browser/SSR-side code. Svelte components that render in the user's pages. Each component is its own `.svelte` file, re-exported through `index.ts`.
- `src/types.ts` — Pure TypeScript type definitions shared across the integration and client code, and exposed to consumers.
- `playground/` — A real Astro project for development. Uses `link:..` to resolve the parent package from source without requiring a build step.
- `tests/` — Mirrors `src/` structure. Each subdirectory tests its corresponding source directory.

## Build Pipeline

### Tool: `@sveltejs/package`

Single build command: `svelte-package --input src --output dist`

File-by-file processing (no bundling):

| Input | Output | Description |
|---|---|---|
| `src/astro/index.ts` | `dist/astro/index.js` + `dist/astro/index.d.ts` | Integration entry point |
| `src/client/*.svelte` | `dist/client/*.svelte` + `dist/client/*.svelte.d.ts` | Preprocessed Svelte source + type declarations |
| `src/client/index.ts` | `dist/client/index.js` + `dist/client/index.d.ts` | Component barrel export |
| `src/types.ts` | `dist/types.js` + `dist/types.d.ts` | Type definitions |

Svelte files are preprocessed (TypeScript in `<script lang="ts">` is stripped) but remain `.svelte` files. The consumer's Svelte compiler handles final compilation.

### Why not Vite library mode?

Vite library mode is a bundler — it produces bundled output files. This project requires individual, unbundled file output (each Svelte component as its own file). `@sveltejs/package` is designed specifically for this use case.

## Package Exports

```json
{
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
  }
}
```

### Consumer Usage

```ts
// astro.config.mjs
import nebulaCMS from 'nebula-cms';
export default { integrations: [nebulaCMS()] };

// In a .astro or .svelte file
import SomeComponent from 'nebula-cms/client/SomeComponent.svelte';
// Or via barrel
import { SomeComponent } from 'nebula-cms/client';

// Types
import type { SomeType } from 'nebula-cms/types';
```

## Development Environment

### Playground

`playground/` is a minimal Astro project that consumes the integration and components the same way a real user would.

**`playground/package.json`:**
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

**`playground/astro.config.mjs`:**
```js
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import nebulaCMS from 'nebula-cms';

export default defineConfig({
  integrations: [svelte(), nebulaCMS()],
});
```

Using `link:..` allows the playground to resolve the parent package from source directly. Astro's Vite pipeline processes the `.ts` and `.svelte` files on the fly — no build step required during development.

### Environment Parity

All three environments — development, testing, and build — share the same `svelte.config.js` at the project root for Svelte preprocessing. This ensures components are processed identically everywhere.

| Environment | Tool | Svelte Processing |
|---|---|---|
| Development | Astro dev server (Vite) | `@sveltejs/vite-plugin-svelte` reads `svelte.config.js` |
| Testing | Vitest (Vite) | `@sveltejs/vite-plugin-svelte` reads `svelte.config.js` |
| Build | `@sveltejs/package` | Reads `svelte.config.js` directly |

## Testing Setup

### Vitest Configuration

```ts
// vitest.config.ts
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

Coverage uses c8 (via `@vitest/coverage-v8`).

### Test Categories

- **`tests/astro/`** — Unit tests for the integration function. Tests that the returned object has the correct hooks, that `astro:config:setup` calls expected methods (route injection, config updates), etc. These test the integration object directly, not a full Astro build.
- **`tests/client/`** — Component tests using `@testing-library/svelte`. Render components, simulate interaction, assert DOM output.
- **`tests/types/`** — Type-level assertion tests using `expect-type` or similar, if needed.

### Test Dependencies

- `vitest`
- `@vitest/coverage-v8`
- `@sveltejs/vite-plugin-svelte`
- `@testing-library/svelte`

## TypeScript Configuration

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

- `moduleResolution: "bundler"` — matches Vite/Astro module resolution
- `isolatedModules: true` — required by Vite-based tooling
- `declaration` + `declarationMap` — keeps `tsc` useful for type-checking during dev (though `svelte-package` generates the actual distributed `.d.ts` files)

## Dependencies

### Root `package.json`

```
devDependencies:
  @sveltejs/package            # Build tool (svelte-package CLI)
  @sveltejs/vite-plugin-svelte # Vitest Svelte processing
  @testing-library/svelte      # Component test rendering
  @vitest/coverage-v8          # c8 coverage provider
  svelte                       # Peer dep, needed for dev/test
  astro                        # Peer dep, needed for type-checking
  @astrojs/svelte              # Peer dep, needed for playground
  typescript                   # Type checking
  vitest                       # Test runner
  prettier                     # (existing)
  prettier-plugin-astro        # (existing)
  prettier-plugin-svelte       # (existing)

peerDependencies:
  astro: "^6.0.0"
  svelte: "^5.0.0"
  @astrojs/svelte: "^8.0.0"
```

### Package Metadata

```json
{
  "name": "nebula-cms",
  "type": "module",
  "keywords": ["cms", "astro", "astro-integration"]
}
```

The `astro-integration` keyword enables `astro add nebula-cms` support.

## Scripts

```json
{
  "scripts": {
    "build": "svelte-package --input src --output dist",
    "lint": "prettier -c .",
    "fix": "prettier --write .",
    "test": "vitest"
  }
}
```

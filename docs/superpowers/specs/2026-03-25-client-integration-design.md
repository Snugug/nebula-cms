# Client Integration: Structural Cleanup, SCSS Removal, Testing, and CI

**Date:** 2026-03-25
**Status:** Approved

## Overview

Integrate the existing client-side admin UI code (`src/client/`) into the project's build and test infrastructure. This covers five concerns: restructuring files into domain-grouped directories, fixing imports and package exports, removing SCSS in favor of native CSS, comprehensive test coverage, and CI via GitHub Actions.

## 1. Structural Cleanup

### File/Folder Restructuring

Reorganize `src/client/js/` and `src/client/components/` into domain-grouped directories. Current state is a flat list of 25 JS modules and 20 components; the new structure groups by concern:

```
src/client/
├── js/
│   ├── storage/              # Storage abstraction layer
│   │   ├── adapter.ts        # StorageAdapter interface (was storage-adapter.ts)
│   │   ├── fsa.ts            # File System Access adapter (was fsa-adapter.ts)
│   │   ├── github.ts         # GitHub API adapter (was github-adapter.ts)
│   │   ├── client.ts         # Storage client (was storage-client.ts)
│   │   ├── storage.ts        # High-level storage ops (unchanged name)
│   │   ├── db.ts             # IDB schema/setup (unchanged name)
│   │   └── workers/
│   │       ├── storage.ts    # (was storage-worker.ts)
│   │       └── frontmatter.ts # (was frontmatter-worker.ts)
│   ├── drafts/               # Draft persistence and merging
│   │   ├── storage.ts        # IDB draft CRUD (was draft-storage.ts)
│   │   ├── merge.svelte.ts   # (was draft-merge.svelte.ts)
│   │   ├── ops.svelte.ts     # (was editor-draft-ops.svelte.ts)
│   │   └── workers/
│   │       └── diff.ts       # (was draft-diff-worker.ts)
│   ├── editor/               # Editor state and CodeMirror plugins
│   │   ├── editor.svelte.ts  # (unchanged name)
│   │   ├── link-wrap.ts      # (was cm-link-wrap.ts)
│   │   └── markdown-shortcuts.ts # (was cm-markdown-shortcuts.ts)
│   ├── state/                # App-level reactive state
│   │   ├── state.svelte.ts   # (unchanged name)
│   │   ├── router.svelte.ts  # (unchanged name)
│   │   └── schema.svelte.ts  # (unchanged name)
│   ├── handlers/
│   │   └── admin.ts          # (was admin-handlers.ts)
│   └── utils/                # Pure utility functions
│       ├── frontmatter.ts
│       ├── schema-utils.ts
│       ├── slug.ts
│       ├── sort.ts
│       ├── stable-stringify.ts
│       └── url-utils.ts
├── components/
│   ├── sidebar/
│   │   ├── AdminSidebar.svelte
│   │   └── AdminSidebarSort.svelte
│   ├── editor/
│   │   ├── EditorPane.svelte
│   │   ├── EditorTabs.svelte
│   │   └── EditorToolbar.svelte
│   ├── fields/               # (unchanged)
│   │   ├── ArrayField.svelte
│   │   ├── ArrayItem.svelte
│   │   ├── BooleanField.svelte
│   │   ├── DateField.svelte
│   │   ├── EnumField.svelte
│   │   ├── NumberField.svelte
│   │   ├── ObjectField.svelte
│   │   ├── SchemaField.svelte
│   │   └── StringField.svelte
│   ├── dialogs/
│   │   ├── DeleteDraftDialog.svelte
│   │   └── FilenameDialog.svelte
│   ├── BackendPicker.svelte
│   ├── DraftChip.svelte
│   └── MetadataForm.svelte
└── Admin.svelte
```

### Import Rewriting

All `$js/admin/X` import paths are a relic of an earlier testbed and do not resolve without a custom alias. Since `svelte-package` builds `src/` → `dist/` and consumers should not need special Vite config, these must become relative imports pointing to the new directory structure. Import depths vary by source file location:

- From `Admin.svelte` → `./js/state/router.svelte.ts`, `./js/utils/sort`, etc.
- From `components/sidebar/*.svelte` → `../../js/state/router.svelte.ts`, etc.
- From `components/fields/*.svelte` → `../../js/utils/schema-utils`, etc.

File extensions follow existing conventions: bare imports for `.ts` files, explicit `.svelte.ts` extension for Svelte rune modules.

### Package Exports

Current `package.json` exports include a glob pattern (`./client/*.svelte`) that no longer matches the nested directory structure. The sub-components and JS modules are internal implementation details — only `Admin.svelte` is the public API.

Changes:

- Remove `"./client/*.svelte"` glob export from `package.json`
- The existing `"./client"` export already points to `dist/client/index.js` — no `package.json` change needed beyond the glob removal
- Create `src/client/index.ts` with a default re-export of `Admin.svelte`

### Dead File Removal

- Delete `src/client/components/index.ts` (placeholder comment, no consumers)

## 2. SCSS Removal

All 19 components using `<style lang="scss">` switch to `<style>`:

- Remove `lang="scss"` attribute
- Convert `//` SCSS comments to `/* */` CSS comments within `<style>` blocks only (JS/TS `//` comments are unaffected)
- Nesting stays as-is — it's valid native CSS nesting
- No SCSS features (`$variables`, `@mixin`, `@extend`, `@use`, `@import`) are in use

This eliminates the implicit dependency on a Sass compiler, which is not in `package.json` and would otherwise be a burden on consumers.

## 3. Testing Strategy

### Test Infrastructure

- **Unit/component tests**: Vitest with `@testing-library/svelte` (both already in dev deps)
- **E2E tests**: Vitest Browser Mode with Playwright provider (add `@vitest/browser` and `playwright` as dev deps, matching the `vitest` major version)
- **IDB mocking**: Add `fake-indexeddb` as a dev dep for realistic IndexedDB testing. Imported in a Vitest setup file (`tests/setup.ts`) so it's available globally without per-test imports.
- **Config**: `vitest.workspace.ts` replaces the existing `vitest.config.ts` and defines both Node and browser projects. The `svelte()` plugin and coverage settings from the current config are preserved in the unit project definition.

### 3a. Pure TS Module Tests

Location: `tests/client/js/utils/`

Modules with no browser/DOM dependencies:

| Module (new path) | Key functions to test |
|---|---|
| `utils/sort.ts` | `toSortDate()`, sort comparators — date formats, nulls, non-date strings |
| `utils/slug.ts` | `slugify()` — unicode, spaces, special chars, empty strings |
| `utils/schema-utils.ts` | `resolveFieldType()`, `createDefaultValue()`, `extractTabs()`, `getFieldsForTab()` — all JSON Schema shapes |
| `utils/frontmatter.ts` | Parse/serialize roundtrips, edge cases |
| `utils/stable-stringify.ts` | Key ordering, nested objects, deterministic output |
| `utils/url-utils.ts` | URL helper functions |

### 3b. Stateful Module Tests

Location: `tests/client/js/` mirroring the new subdirectory structure (`state/`, `editor/`, `drafts/`, `storage/`, `handlers/`)

Modules using Svelte 5 runes and/or browser APIs, requiring mocks:

| Module (new path) | Mock requirements |
|---|---|
| `state/router.svelte.ts` | `navigation` API, `location` — test route parsing, navigate, dirty guard |
| `state/state.svelte.ts` | Storage adapter — test reactive state transitions, collection loading |
| `state/schema.svelte.ts` | Fetch/storage — test cache hits/misses, prefetch |
| `editor/editor.svelte.ts` | Storage, draft-storage — test file loading, draft detection, form data |
| `editor/link-wrap.ts` | CodeMirror link-wrapping plugin — mock EditorView state, test decoration/transaction logic |
| `editor/markdown-shortcuts.ts` | CodeMirror markdown shortcut keybindings — mock EditorView state, test keymap handler behavior |
| `drafts/storage.ts` | IndexedDB via `fake-indexeddb` — test CRUD operations |
| `drafts/ops.svelte.ts` | Editor + storage — test draft operation coordination |
| `drafts/merge.svelte.ts` | Test merge logic with live vs draft content |
| `drafts/workers/diff.ts` | Import message handler directly if using `self.onmessage` pattern |
| `storage/client.ts`, `storage/storage.ts`, `storage/fsa.ts`, `storage/github.ts`, `storage/adapter.ts` | Respective underlying APIs (FSA, GitHub) — test each adapter in isolation |
| `storage/db.ts` | IDB schema/setup — test alongside drafts/storage |
| `storage/workers/storage.ts`, `storage/workers/frontmatter.ts` | Import message handler directly if using `self.onmessage` pattern |
| `handlers/admin.ts` | Coordinated modules — test save, publish, delete orchestration |

### 3c. Component Tests

Location: `tests/client/components/` mirroring the new subdirectory structure (`sidebar/`, `editor/`, `fields/`, `dialogs/`)

Using `@testing-library/svelte`. Order: leaf → composed → top-level.

**Leaf components:**

- `DraftChip.svelte` — chip text/variant for draft/outdated states
- `DeleteDraftDialog.svelte` — renders dialog, fires confirm/cancel callbacks
- `FilenameDialog.svelte` — validates filename, uniqueness check, fires confirm/cancel

**Field components:**

Each tested for: rendering with a schema node, emitting value changes, edge cases.

- `SchemaField.svelte` — dispatches to correct field type per schema
- `ArrayField.svelte` / `ArrayItem.svelte` — add/remove/reorder items
- `ObjectField.svelte` — recursive field rendering
- `StringField.svelte`, `NumberField.svelte`, `DateField.svelte`, `BooleanField.svelte`, `EnumField.svelte` — input behavior and value binding

**Composed components:**

- `EditorTabs.svelte` — tab rendering from schema, active tab state
- `EditorToolbar.svelte` — button states, publish disabled
- `MetadataForm.svelte` — renders fields for active tab
- `EditorPane.svelte` — CodeMirror mount/unmount (mock CM if needed)
- `AdminSidebarSort.svelte` — sort controls
- `AdminSidebar.svelte` — item rendering, search, active highlighting, new draft button
- `BackendPicker.svelte` — backend selection UI

**Top-level:**

- `Admin.svelte` — state-driven rendering: no backend → BackendPicker, ready → sidebar, collection → content sidebar, file open → editor. Mock JS modules.

### 3d. E2E Tests

Location: `tests/e2e/`

Vitest Browser Mode with Playwright (Chromium). Both FSA and GitHub adapters are mocked at the adapter boundary to enable deterministic testing without real filesystem or network access.

**Flows:**

- Backend connection — pick backend, verify collections load
- Navigation — click through collections, files, drafts; verify URL and content
- Editing — open file, modify body/metadata, verify dirty state
- Draft lifecycle — create, save, reload (IDB persistence), delete
- Publishing — existing file save, new draft with filename dialog
- Unsaved changes guard — navigate with dirty editor, verify confirmation
- GitHub adapter flow — same flows using mocked GitHub adapter

One test file per flow (e.g., `navigation.test.ts`, `draft-lifecycle.test.ts`, `publishing.test.ts`). Related sub-flows within a file use `describe` blocks.

## 4. CI Pipeline

### GitHub Actions Workflow

- Trigger: push to `main`, pull requests
- Steps: install pnpm + Node → `pnpm install` → `pnpm lint` → `pnpm test`
- Playwright browser install step before test run
- Chromium `--no-sandbox` flag enabled **only** when `process.env.CI` is truthy, configured via the `launch.args` option in the browser project within `vitest.workspace.ts`

### Vitest Workspace

`vitest.workspace.ts` replaces `vitest.config.ts` and defines two projects:

1. **unit** — Node environment, `tests/**/*.test.ts` excluding `tests/e2e/`
2. **browser** — Playwright/Chromium, `tests/e2e/**/*.test.ts` only

`pnpm test` (`vitest run`) executes both projects in a single pass.

## Execution Order

1. File/folder restructuring (move files into domain directories, rename files) — commit
2. Import rewriting, package exports, dead file removal — commit
3. SCSS removal — commit
4. Pure TS module tests — commit
5. Stateful module tests — commit
6. Component tests (leaf → composed → top-level) — commit per group
7. E2E tests + Vitest workspace config — commit
8. GitHub Actions workflow — commit

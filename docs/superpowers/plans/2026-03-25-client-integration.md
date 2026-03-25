# Client Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the client-side admin UI into the project's build/test infrastructure with restructured files, relative imports, native CSS, full test coverage, and CI.

**Architecture:** Domain-grouped directories under `src/client/js/` (storage, drafts, editor, state, handlers, utils) and `src/client/components/` (sidebar, editor, fields, dialogs). All `$js/admin/` aliases become relative imports. SCSS replaced with native CSS nesting. Vitest workspace runs unit tests in Node and E2E tests in Playwright/Chromium.

**Tech Stack:** Svelte 5, Vitest 4, @testing-library/svelte, Vitest Browser Mode + Playwright, fake-indexeddb, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-25-client-integration-design.md`

**IMPORTANT RULES (from CLAUDE.md):**
- `pnpm` only, never `npm`/`npx`/`pnpx`
- One Bash command per tool call, no `&&`, `|`, `>`, or `2>&1`
- `cd` must be its own separate Bash call
- Do NOT edit `package.json` scripts
- Run `pnpm lint` and `pnpm fix` before every commit
- Files must not exceed 350 lines (docs/tests/markdown excluded)
- All work in a git worktree under `.worktrees/`, never directly on `main`
- No Co-Authored-By lines in commits

---

## Task 1: Create worktree and directory structure

**Files:**
- Create directories: `src/client/js/{storage/workers,drafts/workers,editor,state,handlers,utils}`
- Create directories: `src/client/components/{sidebar,editor,dialogs}`

- [ ] **Step 1: Create worktree**

```bash
git worktree add .worktrees/client-integration -b feature/client-integration
```

- [ ] **Step 2: cd into worktree**

```bash
cd .worktrees/client-integration
```

All subsequent commands run from the worktree root.

- [ ] **Step 3: Create JS subdirectories**

```bash
mkdir -p src/client/js/storage/workers
```
```bash
mkdir -p src/client/js/drafts/workers
```
```bash
mkdir -p src/client/js/editor
```
```bash
mkdir -p src/client/js/state
```
```bash
mkdir -p src/client/js/handlers
```
```bash
mkdir -p src/client/js/utils
```

- [ ] **Step 4: Create component subdirectories**

```bash
mkdir -p src/client/components/sidebar
```
```bash
mkdir -p src/client/components/editor
```
```bash
mkdir -p src/client/components/dialogs
```

---

## Task 2: Move JS files to domain directories

**Moves:** 25 files total. Each `git mv` is a separate command.

- [ ] **Step 1: Move storage layer files**

```bash
git mv src/client/js/storage-adapter.ts src/client/js/storage/adapter.ts
```
```bash
git mv src/client/js/fsa-adapter.ts src/client/js/storage/fsa.ts
```
```bash
git mv src/client/js/github-adapter.ts src/client/js/storage/github.ts
```
```bash
git mv src/client/js/storage-client.ts src/client/js/storage/client.ts
```
```bash
git mv src/client/js/storage.ts src/client/js/storage/storage.ts
```
```bash
git mv src/client/js/db.ts src/client/js/storage/db.ts
```
```bash
git mv src/client/js/storage-worker.ts src/client/js/storage/workers/storage.ts
```
```bash
git mv src/client/js/frontmatter-worker.ts src/client/js/storage/workers/frontmatter.ts
```

- [ ] **Step 2: Move draft files**

```bash
git mv src/client/js/draft-storage.ts src/client/js/drafts/storage.ts
```
```bash
git mv src/client/js/draft-merge.svelte.ts src/client/js/drafts/merge.svelte.ts
```
```bash
git mv src/client/js/editor-draft-ops.svelte.ts src/client/js/drafts/ops.svelte.ts
```
```bash
git mv src/client/js/draft-diff-worker.ts src/client/js/drafts/workers/diff.ts
```

- [ ] **Step 3: Move editor files**

```bash
git mv src/client/js/editor.svelte.ts src/client/js/editor/editor.svelte.ts
```
```bash
git mv src/client/js/cm-link-wrap.ts src/client/js/editor/link-wrap.ts
```
```bash
git mv src/client/js/cm-markdown-shortcuts.ts src/client/js/editor/markdown-shortcuts.ts
```

- [ ] **Step 4: Move state files**

```bash
git mv src/client/js/state.svelte.ts src/client/js/state/state.svelte.ts
```
```bash
git mv src/client/js/router.svelte.ts src/client/js/state/router.svelte.ts
```
```bash
git mv src/client/js/schema.svelte.ts src/client/js/state/schema.svelte.ts
```

- [ ] **Step 5: Move handler files**

```bash
git mv src/client/js/admin-handlers.ts src/client/js/handlers/admin.ts
```

- [ ] **Step 6: Move utility files**

```bash
git mv src/client/js/frontmatter.ts src/client/js/utils/frontmatter.ts
```
```bash
git mv src/client/js/schema-utils.ts src/client/js/utils/schema-utils.ts
```
```bash
git mv src/client/js/slug.ts src/client/js/utils/slug.ts
```
```bash
git mv src/client/js/sort.ts src/client/js/utils/sort.ts
```
```bash
git mv src/client/js/stable-stringify.ts src/client/js/utils/stable-stringify.ts
```
```bash
git mv src/client/js/url-utils.ts src/client/js/utils/url-utils.ts
```

- [ ] **Step 7: Move component files**

```bash
git mv src/client/components/AdminSidebar.svelte src/client/components/sidebar/AdminSidebar.svelte
```
```bash
git mv src/client/components/AdminSidebarSort.svelte src/client/components/sidebar/AdminSidebarSort.svelte
```
```bash
git mv src/client/components/EditorPane.svelte src/client/components/editor/EditorPane.svelte
```
```bash
git mv src/client/components/EditorTabs.svelte src/client/components/editor/EditorTabs.svelte
```
```bash
git mv src/client/components/EditorToolbar.svelte src/client/components/editor/EditorToolbar.svelte
```
```bash
git mv src/client/components/DeleteDraftDialog.svelte src/client/components/dialogs/DeleteDraftDialog.svelte
```
```bash
git mv src/client/components/FilenameDialog.svelte src/client/components/dialogs/FilenameDialog.svelte
```

---

## Task 3: Update internal imports in JS modules

After file moves, internal JS-to-JS imports no longer resolve. Update each file's imports to use the new relative paths. Non-internal imports (from `svelte`, `@codemirror/*`, `js-yaml`, `idb`, `virtual:collections`, etc.) are unchanged.

**Convention:** `.ts` files import without extension. `.svelte.ts` files are imported with a `.svelte` extension (e.g., `./router.svelte`), matching the existing codebase convention.

**Files to modify and their import changes:**

- [ ] **Step 1: storage/storage.ts**

Change: `./db` → `./db` (no change needed — same directory after move)

- [ ] **Step 2: storage/fsa.ts**

Change: `./storage-adapter` → `./adapter`

- [ ] **Step 3: storage/github.ts**

Change: `./storage-adapter` → `./adapter`

- [ ] **Step 4: storage/client.ts**

Change: `./storage-adapter` → `./adapter`

- [ ] **Step 5: storage/workers/storage.ts**

Change: `./storage-adapter` → `../adapter`

- [ ] **Step 6: storage/workers/frontmatter.ts**

Changes:
- `./storage-client` → `../client`
- `./storage-adapter` → `../adapter`

- [ ] **Step 7: drafts/storage.ts**

Change: `./db` → `../storage/db`

- [ ] **Step 8: drafts/merge.svelte.ts**

Changes:
- `./draft-storage` → `./storage`
- `./frontmatter` → `../utils/frontmatter`
- `./state.svelte` → `../state/state.svelte`

- [ ] **Step 9: drafts/ops.svelte.ts**

Changes:
- `./draft-storage` → `./storage`
- `./stable-stringify` → `../utils/stable-stringify`
- `./editor.svelte` → `../editor/editor.svelte`
- `./state.svelte` → `../state/state.svelte`

- [ ] **Step 10: drafts/workers/diff.ts**

Change: `./stable-stringify` → `../../utils/stable-stringify`

- [ ] **Step 11: editor/editor.svelte.ts**

Changes:
- `./router.svelte` → `../state/router.svelte`
- `./frontmatter` → `../utils/frontmatter`
- `./schema-utils` → `../utils/schema-utils`
- `./draft-storage` → `../drafts/storage`
- `./state.svelte` → `../state/state.svelte`
- `./editor-draft-ops.svelte` → `../drafts/ops.svelte`

- [ ] **Step 12: editor/markdown-shortcuts.ts**

Change: `./url-utils` → `../utils/url-utils`

- [ ] **Step 13: state/state.svelte.ts**

Changes:
- `./storage` → `../storage/storage`
- `./storage-client` → `../storage/client`
- `./router.svelte` → `./router.svelte` (no change — same directory)
- `./draft-merge.svelte` → `../drafts/merge.svelte`

- [ ] **Step 14: handlers/admin.ts**

Changes:
- `./editor.svelte` → `../editor/editor.svelte`
- `./state.svelte` → `../state/state.svelte`
- `./router.svelte` → `../state/router.svelte`

- [ ] **Step 15: Verify no remaining old imports**

Search for any import from `./` that references an old flat-structure filename (e.g., `./draft-storage`, `./storage-adapter`, `./admin-handlers`) within `src/client/js/`:

```bash
ag 'from.*\./(?:draft-storage|storage-adapter|admin-handlers|fsa-adapter|github-adapter|storage-client|storage-worker|frontmatter-worker|draft-diff-worker|draft-merge|editor-draft-ops|cm-link-wrap|cm-markdown-shortcuts|url-utils|stable-stringify)' src/client/js/
```

Expected: No matches.

---

## Task 4: Rewrite component imports

All Svelte components currently import from `$js/admin/X`. These must become relative paths to the new JS directory structure. Also update component-to-component imports where files moved to subdirectories.

- [ ] **Step 1: Admin.svelte — JS imports**

Replace all `$js/admin/` imports with relative paths:

| Old import path | New import path |
|---|---|
| `$js/admin/router.svelte` | `./js/state/router.svelte` |
| `$js/admin/sort` | `./js/utils/sort` |
| `$js/admin/state.svelte` | `./js/state/state.svelte` |
| `$js/admin/editor.svelte` | `./js/editor/editor.svelte` |
| `$js/admin/schema.svelte` | `./js/state/schema.svelte` |
| `$js/admin/admin-handlers` | `./js/handlers/admin` |

- [ ] **Step 2: Admin.svelte — component imports**

Update component imports to match new subdirectory locations:

| Old import path | New import path |
|---|---|
| `./BackendPicker.svelte` | `./components/BackendPicker.svelte` |
| `./AdminSidebar.svelte` | `./components/sidebar/AdminSidebar.svelte` |
| `./EditorToolbar.svelte` | `./components/editor/EditorToolbar.svelte` |
| `./EditorPane.svelte` | `./components/editor/EditorPane.svelte` |
| `./EditorTabs.svelte` | `./components/editor/EditorTabs.svelte` |
| `./MetadataForm.svelte` | `./components/MetadataForm.svelte` |
| `./FilenameDialog.svelte` | `./components/dialogs/FilenameDialog.svelte` |
| `./DeleteDraftDialog.svelte` | `./components/dialogs/DeleteDraftDialog.svelte` |

- [ ] **Step 3: components/sidebar/AdminSidebar.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/sort` | `../../js/utils/sort` |
| `$js/admin/router.svelte` | `../../js/state/router.svelte` |
| `$js/admin/draft-storage` | `../../js/drafts/storage` |
| `$js/admin/state.svelte` | `../../js/state/state.svelte` |
| `./DraftChip.svelte` | `../DraftChip.svelte` |
| `./AdminSidebarSort.svelte` | `./AdminSidebarSort.svelte` (unchanged) |

- [ ] **Step 4: components/sidebar/AdminSidebarSort.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/sort` | `../../js/utils/sort` |

- [ ] **Step 5: components/editor/EditorPane.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/editor.svelte` | `../../js/editor/editor.svelte` |
| `$js/admin/cm-link-wrap` | `../../js/editor/link-wrap` |
| `$js/admin/cm-markdown-shortcuts` | `../../js/editor/markdown-shortcuts` |

- [ ] **Step 6: components/editor/EditorTabs.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/schema-utils` | `../../js/utils/schema-utils` |
| `$js/admin/editor.svelte` | `../../js/editor/editor.svelte` |

- [ ] **Step 7: components/editor/EditorToolbar.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/editor.svelte` | `../../js/editor/editor.svelte` |

- [ ] **Step 8: components/dialogs/FilenameDialog.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/slug` | `../../js/utils/slug` |

- [ ] **Step 9: components/BackendPicker.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/state.svelte` | `../js/state/state.svelte` |

- [ ] **Step 10: components/MetadataForm.svelte**

| Old import path | New import path |
|---|---|
| `$js/admin/schema-utils` | `../js/utils/schema-utils` |
| `$js/admin/editor.svelte` | `../js/editor/editor.svelte` |

- [ ] **Step 11: components/fields/ — all 9 field components**

All field components that import from `$js/admin/schema-utils` change to `../../js/utils/schema-utils`. Affected files:
- `SchemaField.svelte` (also imports `resolveFieldType`)
- `ArrayField.svelte` (also imports `createDefaultValue`, `resolveFieldType`)
- `ArrayItem.svelte`
- `ObjectField.svelte`
- `StringField.svelte`
- `NumberField.svelte`
- `BooleanField.svelte`
- `DateField.svelte`
- `EnumField.svelte`

Relative imports between field components (e.g., `./StringField.svelte`) are unchanged since they stay in the same directory.

- [ ] **Step 12: Verify no remaining $js/ imports**

```bash
ag '\$js/' src/client/
```

Expected: No matches.

---

## Task 5: Package exports and dead file cleanup

- [ ] **Step 1: Create src/client/index.ts**

Create `src/client/index.ts`:

```typescript
export { default } from './Admin.svelte';
```

- [ ] **Step 2: Remove glob export from package.json**

In `package.json`, remove the `"./client/*.svelte"` export entry (lines 16-19):

```json
"./client/*.svelte": {
  "types": "./dist/client/*.svelte.d.ts",
  "svelte": "./dist/client/*.svelte"
},
```

- [ ] **Step 3: Delete dead barrel file**

```bash
git rm src/client/components/index.ts
```

- [ ] **Step 4: Run lint and fix**

```bash
pnpm lint
```
```bash
pnpm fix
```

- [ ] **Step 5: Commit structural cleanup**

```bash
git add -A
```
```bash
git commit -m "refactor: restructure client files into domain directories

Move JS modules into storage/, drafts/, editor/, state/, handlers/, utils/ subdirectories.
Move components into sidebar/, editor/, dialogs/ subdirectories.
Rewrite all imports from \$js/admin/ aliases to relative paths.
Update package.json exports to only expose Admin.svelte via ./client entry."
```

---

## Task 6: Remove SCSS from all components

19 components use `<style lang="scss">`. For each:
1. Remove `lang="scss"` attribute
2. Convert `//` comments within `<style>` blocks to `/* */` comments
3. Leave nesting as-is (valid native CSS)

- [ ] **Step 1: Remove lang="scss" from all components**

In every `.svelte` file under `src/client/`, replace `<style lang="scss">` with `<style>`.

Files (19 total): `Admin.svelte`, `components/sidebar/AdminSidebar.svelte`, `components/sidebar/AdminSidebarSort.svelte`, `components/editor/EditorPane.svelte`, `components/editor/EditorTabs.svelte`, `components/editor/EditorToolbar.svelte`, `components/dialogs/DeleteDraftDialog.svelte`, `components/dialogs/FilenameDialog.svelte`, `components/BackendPicker.svelte`, `components/DraftChip.svelte`, `components/MetadataForm.svelte`, `components/fields/ArrayField.svelte`, `components/fields/ArrayItem.svelte`, `components/fields/BooleanField.svelte`, `components/fields/DateField.svelte`, `components/fields/EnumField.svelte`, `components/fields/NumberField.svelte`, `components/fields/ObjectField.svelte`, `components/fields/StringField.svelte`

- [ ] **Step 2: Convert // comments to CSS comments in style blocks**

For each file, find `//` comments ONLY within the `<style>` block and convert to `/* */`. Multi-line comment blocks using `//////////////////////////////` become `/* ============================ */` or similar CSS-compatible dividers.

Example conversions:
```scss
// Lock to viewport height so the page never scrolls
```
becomes:
```css
/* Lock to viewport height so the page never scrolls */
```

```scss
//////////////////////////////
// Description
//////////////////////////////
```
becomes:
```css
/* ============================ */
/* Description                  */
/* ============================ */
```

**Do NOT** touch `//` comments in `<script>` blocks.

- [ ] **Step 3: Run lint and fix**

```bash
pnpm lint
```
```bash
pnpm fix
```

- [ ] **Step 4: Commit SCSS removal**

```bash
git add -A
```
```bash
git commit -m "refactor: replace SCSS with native CSS in all components

Remove lang=scss attribute from all 19 component style blocks.
Convert SCSS inline comments to CSS block comments.
Nesting preserved as valid native CSS."
```

---

## Task 7: Test infrastructure setup

**Files:**
- Create: `vitest.workspace.ts`
- Create: `tests/setup.ts`
- Delete: `vitest.config.ts`

- [ ] **Step 1: Install new dev dependencies**

```bash
pnpm add -D @vitest/browser playwright fake-indexeddb
```

- [ ] **Step 2: Install Playwright browsers**

```bash
pnpm exec playwright install chromium
```

- [ ] **Step 3: Create vitest.workspace.ts**

```typescript
import { defineWorkspace } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineWorkspace([
  {
    plugins: [svelte()],
    test: {
      name: 'unit',
      include: ['tests/**/*.test.ts'],
      exclude: ['tests/e2e/**'],
      setupFiles: ['tests/setup.ts'],
      coverage: {
        provider: 'v8',
        enabled: true,
        reportsDirectory: '.coverage',
      },
    },
  },
  {
    plugins: [svelte()],
    test: {
      name: 'browser',
      include: ['tests/e2e/**/*.test.ts'],
      browser: {
        enabled: true,
        provider: 'playwright',
        instances: [
          {
            browser: 'chromium',
            launch: {
              args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
            },
          },
        ],
      },
    },
  },
]);
```

- [ ] **Step 4: Create tests/setup.ts**

```typescript
import 'fake-indexeddb/auto';
```

- [ ] **Step 5: Delete old vitest.config.ts**

```bash
git rm vitest.config.ts
```

- [ ] **Step 6: Verify test infrastructure works**

```bash
pnpm test
```

Expected: Existing tests in `tests/astro/` pass. No E2E tests exist yet so the browser project should have 0 tests.

- [ ] **Step 7: Commit test infrastructure**

```bash
git add -A
```
```bash
git commit -m "build: replace vitest.config.ts with workspace for unit + browser tests

Add vitest.workspace.ts with unit (Node) and browser (Playwright/Chromium) projects.
Add fake-indexeddb, @vitest/browser, playwright as dev dependencies.
Chromium --no-sandbox enabled only in CI."
```

---

## Task 8: Pure utility module tests

**Files:**
- Create: `tests/client/js/utils/sort.test.ts`
- Create: `tests/client/js/utils/slug.test.ts`
- Create: `tests/client/js/utils/schema-utils.test.ts`
- Create: `tests/client/js/utils/frontmatter.test.ts`
- Create: `tests/client/js/utils/stable-stringify.test.ts`
- Create: `tests/client/js/utils/url-utils.test.ts`

These modules have no browser/DOM dependencies. Read each source file, then write tests covering:
- All exported functions
- Edge cases: null/undefined inputs, empty strings, boundary values
- Each branch in conditional logic

- [ ] **Step 1: Read all utility source files**

Read each file in `src/client/js/utils/` to understand function signatures and behavior.

- [ ] **Step 2: Write sort.test.ts**

Test `toSortDate()` with valid date strings, non-date strings, null, undefined. Test `createComparator()` with each `SortMode`. Test `readSortMode()`/`writeSortMode()` with localStorage mock.

- [ ] **Step 3: Write slug.test.ts**

Test `slugify()` with plain strings, unicode, spaces, special chars, empty string, already-slugified input.

- [ ] **Step 4: Write schema-utils.test.ts**

Test `resolveFieldType()` for each JSON Schema type (string, number, boolean, array, object, enum via `enum` key, date-time via `format`). Test `createDefaultValue()` returns correct defaults per type. Test `extractTabs()` extracts tab structure from schema. Test `getFieldsForTab()` returns correct field subset. Test `getByPath()` and `setByPath()` with nested objects and array indices.

- [ ] **Step 5: Write frontmatter.test.ts**

Test `splitFrontmatter()` with valid YAML frontmatter + body, missing frontmatter, empty body, only frontmatter, malformed delimiters.

- [ ] **Step 6: Write stable-stringify.test.ts**

Test `stableStringify()` produces deterministic output regardless of key insertion order. Test nested objects, arrays, null values, empty objects.

- [ ] **Step 7: Write url-utils.test.ts**

Test `isUrl()` with valid URLs (http, https, with paths), non-URLs (plain text, partial URLs), edge cases (empty string, protocol-only).

- [ ] **Step 8: Run tests**

```bash
pnpm test
```

Expected: All utility tests pass.

- [ ] **Step 9: Lint and commit**

```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add unit tests for pure utility modules

Cover sort, slug, schema-utils, frontmatter, stable-stringify, and url-utils."
```

---

## Task 9: State module tests

**Files:**
- Create: `tests/client/js/state/router.test.ts`
- Create: `tests/client/js/state/schema.test.ts`
- Create: `tests/client/js/state/state.test.ts`

- [ ] **Step 1: Read state module source files**

Read `src/client/js/state/router.svelte.ts`, `schema.svelte.ts`, `state.svelte.ts`.

- [ ] **Step 2: Write router.test.ts**

Mock `navigation` API (addEventListener, navigate) and `window.location`. Test:
- `parsePathname()` — home, collection, file, draft routes (via `getRoute()` after setting location)
- `navigate()` — calls `navigation.navigate()`
- `registerDirtyChecker()` + navigation interception — confirm prompt when dirty
- `initRouter()` — idempotent, only registers once

Note: `parsePathname` is not exported, so test indirectly via `getRoute()` after mocking `location.pathname` and re-importing or by testing the navigate/intercept flow.

- [ ] **Step 3: Write schema.test.ts**

Mock `virtual:collections` to provide test schema data. Test:
- `fetchSchema()` loads and caches schema
- `getSchema()` returns cached schema
- `clearSchema()` resets state
- `prefetchAllSchemas()` loads all schemas
- `collectionHasDates()` checks schema for date fields
- `areSchemasReady()` reflects load state

- [ ] **Step 4: Write state.test.ts**

Mock storage module and storage-client. Test:
- `restoreBackend()` restores from IDB
- `isBackendReady()` reflects connection state
- `loadCollection()` populates `getContentList()`
- `getCollections()` returns collection names
- `disconnect()` resets state
- Draft-related getters (`getDrafts()`, `getOutdatedMap()`)

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test
```
```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add unit tests for state modules

Cover router, schema state, and app state with mocked browser APIs."
```

---

## Task 10: Editor and draft module tests

**Files:**
- Create: `tests/client/js/editor/editor.test.ts`
- Create: `tests/client/js/editor/link-wrap.test.ts`
- Create: `tests/client/js/editor/markdown-shortcuts.test.ts`
- Create: `tests/client/js/drafts/storage.test.ts`
- Create: `tests/client/js/drafts/merge.test.ts`
- Create: `tests/client/js/drafts/ops.test.ts`

- [ ] **Step 1: Read editor and draft source files**

Read all files in `src/client/js/editor/` and `src/client/js/drafts/`.

- [ ] **Step 2: Write drafts/storage.test.ts**

Uses `fake-indexeddb` (auto-imported via setup file). Test:
- `saveDraft()` — creates and updates drafts
- `loadDrafts()` — retrieves all drafts for a collection
- `loadDraft()` — retrieves single draft by ID
- `deleteDraft()` — removes draft
- `getDraftByFile()` — finds draft by collection + filename

- [ ] **Step 3: Write drafts/merge.test.ts**

Mock `drafts/storage` and `state/state.svelte`. Test:
- `mergeDrafts()` — combines live content list with draft data
- `getDrafts()` / `getOutdatedMap()` — reactive getters
- `refreshDrafts()` — re-fetches from IDB
- `resetDraftMerge()` — clears state

- [ ] **Step 4: Write drafts/ops.test.ts**

Mock `drafts/storage`, `editor/editor.svelte`, `state/state.svelte`. Test:
- `loadDraftById()` — loads draft into editor state
- `saveDraftToIDB()` — serializes editor state to IDB
- `saveFile()` — writes to storage backend
- `publishFile()` — writes file + cleans up draft
- `deleteCurrentDraft()` — removes active draft

- [ ] **Step 5: Write editor/editor.test.ts**

Mock `state/router.svelte`, `utils/frontmatter`, `utils/schema-utils`, `drafts/storage`, `state/state.svelte`. Test:
- `preloadFile()` — checks IDB for draft first
- `getEditorFile()` / `getFormData()` — reactive getters
- `getActiveTab()` / `setActiveTab()` — tab state
- `updateFormField()` — updates form data
- `updateBody()` — updates markdown body
- `clearEditor()` — resets editor state
- `loadFileBody()` — reads file from storage

- [ ] **Step 6: Write editor/link-wrap.test.ts**

Mock CodeMirror `EditorView` and `EditorState`. Test:
- `linkWrapPlugin` creates a valid ViewPlugin
- URL detection and decoration behavior (test with mock document content)

- [ ] **Step 7: Write editor/markdown-shortcuts.test.ts**

Mock CodeMirror APIs. Test:
- `markdownShortcutsKeymap` contains expected key bindings
- `markdownShortcutsExtensions` returns valid extensions array
- Individual shortcut handlers produce correct text transformations

- [ ] **Step 8: Run tests and commit**

```bash
pnpm test
```
```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add unit tests for editor and draft modules

Cover editor state, CodeMirror plugins, draft storage, merge, and operations."
```

---

## Task 11: Storage layer and handler tests

**Files:**
- Create: `tests/client/js/storage/adapter.test.ts`
- Create: `tests/client/js/storage/fsa.test.ts`
- Create: `tests/client/js/storage/github.test.ts`
- Create: `tests/client/js/storage/client.test.ts`
- Create: `tests/client/js/storage/storage.test.ts`
- Create: `tests/client/js/storage/db.test.ts`
- Create: `tests/client/js/storage/workers/storage.test.ts`
- Create: `tests/client/js/storage/workers/frontmatter.test.ts`
- Create: `tests/client/js/drafts/workers/diff.test.ts`
- Create: `tests/client/js/handlers/admin.test.ts`

- [ ] **Step 1: Read storage, worker, and handler source files**

Read all files in `src/client/js/storage/`, `src/client/js/storage/workers/`, `src/client/js/drafts/workers/`, and `src/client/js/handlers/`.

- [ ] **Step 2: Write storage/db.test.ts**

Uses `fake-indexeddb`. Test `openDB()` creates/opens the database with correct schema.

- [ ] **Step 3: Write storage/adapter.test.ts**

`adapter.ts` defines interfaces/types only — verify exports exist and TypeScript types are correct (compile-time test, or verify interface shape).

- [ ] **Step 4: Write storage/fsa.test.ts**

Mock File System Access API (`FileSystemDirectoryHandle`, `FileSystemFileHandle`). Test `FsaAdapter` methods: list files, read file, write file, delete file.

- [ ] **Step 5: Write storage/github.test.ts**

Mock `fetch` for GitHub API. Test `GitHubAdapter` methods: list files, read file content, write/create file, delete file. Test error handling for API failures.

- [ ] **Step 6: Write storage/client.test.ts**

Mock underlying `StorageAdapter`. Test `StorageClient` request/response handling.

- [ ] **Step 7: Write storage/storage.test.ts**

Uses `fake-indexeddb`. Test `saveBackend()`, `loadBackend()`, `clearBackend()` IDB persistence.

- [ ] **Step 8: Write worker tests**

For each worker (`storage/workers/storage.ts`, `storage/workers/frontmatter.ts`, `drafts/workers/diff.ts`): import the file and test the `self.onmessage` handler by invoking it directly with mock `MessageEvent` objects. If the worker uses `self.postMessage`, mock it and verify output messages.

- [ ] **Step 9: Write handlers/admin.test.ts**

Mock `editor/editor.svelte`, `state/state.svelte`, `state/router.svelte`. Test:
- `handleSave()` — saves draft to IDB
- `handlePublish()` — returns `needs-filename` for new drafts, writes file for existing
- `handleDeleteDraft()` — removes draft + navigates
- `handleFilenameConfirm()` — writes file with chosen filename
- `computePublishDisabled()` — returns true when required schema fields missing

- [ ] **Step 10: Run tests and commit**

```bash
pnpm test
```
```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add unit tests for storage layer, workers, and handlers

Cover storage adapters (FSA, GitHub), storage client, IDB persistence,
worker message handlers, and admin action handlers."
```

---

## Task 12: Leaf and field component tests

**Files:**
- Create: `tests/client/components/DraftChip.test.ts`
- Create: `tests/client/components/dialogs/DeleteDraftDialog.test.ts`
- Create: `tests/client/components/dialogs/FilenameDialog.test.ts`
- Create: `tests/client/components/fields/SchemaField.test.ts`
- Create: `tests/client/components/fields/StringField.test.ts`
- Create: `tests/client/components/fields/NumberField.test.ts`
- Create: `tests/client/components/fields/BooleanField.test.ts`
- Create: `tests/client/components/fields/DateField.test.ts`
- Create: `tests/client/components/fields/EnumField.test.ts`
- Create: `tests/client/components/fields/ArrayField.test.ts`
- Create: `tests/client/components/fields/ObjectField.test.ts`

All component tests use `@testing-library/svelte` with `render`, `screen`, `fireEvent`.

- [ ] **Step 1: Read leaf component source files**

Read `DraftChip.svelte`, `DeleteDraftDialog.svelte`, `FilenameDialog.svelte`.

- [ ] **Step 2: Write DraftChip.test.ts**

Test rendering with `isDraft=true`, `isOutdated=true`, both, neither. Verify correct text content and CSS classes.

- [ ] **Step 3: Write DeleteDraftDialog.test.ts**

Test dialog renders, confirm button fires `onConfirm`, cancel button fires `onCancel`.

- [ ] **Step 4: Write FilenameDialog.test.ts**

Mock `slugify` from `../../js/utils/slug`. Test:
- Renders with pre-filled slug from title prop
- Validates against `existingFilenames` — shows error for duplicates
- Confirm fires `onConfirm` with filename
- Cancel fires `onCancel`

- [ ] **Step 5: Read all field component source files**

Read all 9 files in `src/client/components/fields/`.

- [ ] **Step 6: Write field component tests**

For each field (String, Number, Boolean, Date, Enum): render with a valid `SchemaNode` prop, verify input renders with correct type/attributes, simulate user input change and verify the `onchange` callback fires with correct value.

For `SchemaField.test.ts`: render with different schema types, verify it delegates to the correct sub-component.

For `ArrayField.test.ts`: render with array schema, test add item button, test remove item, test item reordering if supported.

For `ObjectField.test.ts`: render with object schema containing multiple properties, verify it renders `SchemaField` for each property.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm test
```
```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add component tests for leaf components and fields

Cover DraftChip, DeleteDraftDialog, FilenameDialog, and all 9 field components."
```

---

## Task 13: Composed and top-level component tests

**Files:**
- Create: `tests/client/components/sidebar/AdminSidebar.test.ts`
- Create: `tests/client/components/sidebar/AdminSidebarSort.test.ts`
- Create: `tests/client/components/editor/EditorTabs.test.ts`
- Create: `tests/client/components/editor/EditorToolbar.test.ts`
- Create: `tests/client/components/editor/EditorPane.test.ts`
- Create: `tests/client/components/MetadataForm.test.ts`
- Create: `tests/client/components/BackendPicker.test.ts`
- Create: `tests/client/components/Admin.test.ts`

- [ ] **Step 1: Read composed component source files**

Read all sidebar, editor, and top-level component files.

- [ ] **Step 2: Write AdminSidebarSort.test.ts**

Mock `sort` module. Test sort mode buttons render, clicking changes sort, fires callback.

- [ ] **Step 3: Write AdminSidebar.test.ts**

Mock `sort`, `router.svelte`, `draft-storage`, `state.svelte`. Test:
- Renders item list
- Search input filters items
- Active item highlighted
- Add button visible when `showAdd` prop set
- Footer renders when `showFooter` prop set

- [ ] **Step 4: Write EditorTabs.test.ts**

Mock `schema-utils`, `editor.svelte`. Test tabs render from schema, clicking tab calls `setActiveTab()`.

- [ ] **Step 5: Write EditorToolbar.test.ts**

Mock `editor.svelte`. Test save/publish/delete buttons render, publish disabled when prop set, click handlers fire.

- [ ] **Step 6: Write EditorPane.test.ts**

Mock CodeMirror modules and `editor.svelte`. Test component mounts/unmounts without error. Verify CodeMirror editor is initialized. Testing actual editing behavior is deferred to E2E tests.

- [ ] **Step 7: Write MetadataForm.test.ts**

Mock `schema-utils`, `editor.svelte`. Test renders fields for active tab, calls `updateFormField` on change.

- [ ] **Step 8: Write BackendPicker.test.ts**

Mock `state.svelte`. Test renders backend options, clicking directory picker calls `pickDirectory()`, clicking GitHub calls `connectGitHub()`.

- [ ] **Step 9: Write Admin.test.ts**

Mock all JS modules (`state/state.svelte`, `state/router.svelte`, `state/schema.svelte`, `editor/editor.svelte`, `handlers/admin`). Test state-driven rendering:
- Not ready → renders `BackendPicker`
- Ready, no collection → renders collections sidebar only
- Ready, collection selected → renders both sidebars
- Ready, file open → renders editor area with toolbar, tabs, content

- [ ] **Step 10: Run tests and commit**

```bash
pnpm test
```
```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add component tests for composed and top-level components

Cover AdminSidebar, AdminSidebarSort, EditorTabs, EditorToolbar, EditorPane,
MetadataForm, BackendPicker, and Admin orchestration component."
```

---

## Task 14: E2E test setup and first flow

**Files:**
- Create: `tests/e2e/helpers/mock-adapter.ts`
- Create: `tests/e2e/helpers/test-app.ts`
- Create: `tests/e2e/navigation.test.ts`
- Create: `tests/e2e/backend-connection.test.ts`

- [ ] **Step 1: Read adapter interface and Admin component**

Read `src/client/js/storage/adapter.ts` to understand the `StorageAdapter` interface that mocks must implement. Read `Admin.svelte` to understand the mount point.

- [ ] **Step 2: Create mock adapter**

Create `tests/e2e/helpers/mock-adapter.ts` — an in-memory `StorageAdapter` implementation that stores files in a `Map`. Supports list, read, write, delete. Pre-populated with test collection data (a "posts" collection with 2-3 sample markdown files with frontmatter).

- [ ] **Step 3: Create test app helper**

Create `tests/e2e/helpers/test-app.ts` — a helper that mounts the Admin component into a test DOM with the mock adapter injected. Handles cleanup.

- [ ] **Step 4: Write backend-connection.test.ts**

Test:
- Admin renders BackendPicker when no backend connected
- Connecting with mock adapter shows collections sidebar
- Collections list shows expected collection names

- [ ] **Step 5: Write navigation.test.ts**

Test:
- Click collection → content sidebar appears with items
- Click content item → editor area appears
- URL updates on each navigation
- Browser back/forward updates view

- [ ] **Step 6: Run E2E tests**

```bash
pnpm test
```

Expected: Both unit and E2E tests pass.

- [ ] **Step 7: Commit**

```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add E2E test infrastructure and first flows

Add mock StorageAdapter, test app helper, backend connection and navigation E2E tests.
Uses Vitest Browser Mode with Playwright/Chromium."
```

---

## Task 15: Remaining E2E flows

**Files:**
- Create: `tests/e2e/editing.test.ts`
- Create: `tests/e2e/draft-lifecycle.test.ts`
- Create: `tests/e2e/publishing.test.ts`
- Create: `tests/e2e/unsaved-changes.test.ts`
- Create: `tests/e2e/github-adapter.test.ts`

- [ ] **Step 1: Write editing.test.ts**

Test:
- Open file → editor shows markdown body
- Modify body text → dirty state activates
- Modify metadata field → form data updates
- Save draft → changes persisted to IDB

- [ ] **Step 2: Write draft-lifecycle.test.ts**

Test:
- Create new draft → appears in sidebar with DRAFT chip
- Save draft → persists across page reload (IDB)
- Delete draft → removed from sidebar and IDB

- [ ] **Step 3: Write publishing.test.ts**

Test:
- Publish existing file → writes to storage adapter
- Publish new draft → shows filename dialog
- Confirm filename → writes file to storage adapter
- Published file appears in content list without DRAFT chip

- [ ] **Step 4: Write unsaved-changes.test.ts**

Test:
- Edit file → navigate away → confirmation dialog appears
- Cancel navigation → stays on page
- Confirm navigation → navigates away, changes lost

- [ ] **Step 5: Write github-adapter.test.ts**

Create a mock GitHub API (intercept fetch) and repeat key flows (connect, browse, edit, publish) using the GitHub adapter path instead of FSA.

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: All unit and E2E tests pass.

- [ ] **Step 7: Commit**

```bash
pnpm lint
```
```bash
pnpm fix
```
```bash
git add -A
```
```bash
git commit -m "test: add remaining E2E flows

Cover editing, draft lifecycle, publishing, unsaved changes guard,
and GitHub adapter integration."
```

---

## Task 16: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test
```

- [ ] **Step 2: Verify locally**

```bash
pnpm lint
```
```bash
pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add -A
```
```bash
git commit -m "ci: add GitHub Actions workflow

Run lint and full test suite (unit + E2E) on push to main and PRs.
Playwright Chromium installed with --no-sandbox via CI env detection in vitest.workspace.ts."
```

---

## Task 17: Final verification

- [ ] **Step 1: Run full lint + test suite**

```bash
pnpm lint
```
```bash
pnpm test
```

- [ ] **Step 2: Verify no remaining issues**

```bash
ag '\$js/' src/client/
```

Expected: No matches.

```bash
ag 'lang="scss"' src/client/
```

Expected: No matches.

- [ ] **Step 3: Review diff for cleanliness**

```bash
git log --oneline
```

Verify commit history is clean and logical.

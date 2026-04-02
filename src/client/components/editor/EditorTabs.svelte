<script lang="ts">
  import type { SchemaNode } from '../../js/utils/schema-utils';
  import { extractTabs } from '../../js/utils/schema-utils';
  import { toTitleCase } from '../../js/utils/format';
  import {
    editor,
    setActiveTab,
    getEditorFile,
  } from '../../js/editor/editor.svelte';
  import { hasBodyEditor } from '../../js/utils/file-types';

  // Props for the EditorTabs component, which renders the tab bar above the editor, including the default Metadata and Body tabs plus any custom schema-defined tabs.
  interface Props {
    // The JSON Schema for the current collection (null if not loaded yet)
    schema: SchemaNode | null;
  }

  let { schema }: Props = $props();

  // Custom tab names derived from schema, sorted alphabetically
  const customTabs = $derived(schema ? extractTabs(schema) : []);

  // Current open file — null when no file is loaded
  const file = $derived(getEditorFile());

  /*
   * Show the Body tab for files that have a body editor (markdown, MDX, Markdoc).
   * Defaults to true when no file is open to preserve the prior behavior.
   */
  const showBody = $derived(file ? hasBodyEditor(file.filename) : true);

  // All tabs: Metadata, conditionally Body, then custom tabs
  const allTabs = $derived([
    'metadata',
    ...(showBody ? ['body'] : []),
    ...customTabs,
  ]);
</script>

<nav class="tabs" aria-label="Editor tabs">
  {#each allTabs as tab}
    <button
      class="tabs__tab"
      class:tabs__tab--active={editor.tab === tab}
      type="button"
      onclick={() => setActiveTab(tab)}
      aria-selected={editor.tab === tab}
      role="tab"
    >
      {toTitleCase(tab)}
    </button>
  {/each}
</nav>

<style>
  /* Tab bar sits below the editor toolbar, separated by a border */
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--cms-border);
  }

  .tabs__tab {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--cms-muted);
    background: none;
    border: none;
    /* Bottom border reserves space to avoid layout shift on active state */
    border-bottom: 2px solid transparent;
    cursor: pointer;

    &:hover {
      color: var(--cms-fg);
    }
  }

  .tabs__tab--active {
    color: var(--cms-fg);
    border-bottom-color: var(--plum);
  }
</style>

<script lang="ts">
  import {
    getDefaultExtension,
    getTypeForFilename,
  } from '../../js/utils/file-types';
  import {
    changeFileFormat,
    getEditorFile,
  } from '../../js/editor/editor.svelte';
  import { schema } from '../../js/state/schema.svelte';

  // Type identifiers from the schema's files array (e.g. ['md', 'mdx'])
  const fileTypes = $derived(
    Array.isArray(schema.active?.['files'])
      ? (schema.active['files'] as string[])
      : [],
  );

  // The type identifier of the currently open file (e.g. 'md', 'mdx')
  const activeType = $derived.by(() => {
    const file = getEditorFile();
    if (!file?.filename) return fileTypes[0] ?? '';
    return getTypeForFilename(file.filename) ?? fileTypes[0] ?? '';
  });
</script>

{#if fileTypes.length > 1}
  <div class="format-selector">
    <span class="format-selector__label">Format</span>
    <select
      class="format-selector__select"
      value={activeType}
      onchange={(e) => changeFileFormat((e.target as HTMLSelectElement).value)}
    >
      {#each fileTypes as type}
        <option value={type}>{getDefaultExtension(type) ?? type}</option>
      {/each}
    </select>
  </div>
{/if}

<style>
  /* Inline layout for label + select inside the editor body toolbar */
  .format-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .format-selector__label {
    font-size: 0.875rem;
    color: var(--cms-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .format-selector__select {
    background: var(--cms-bg);
    border: 1px solid var(--cms-border);
    border-radius: 0.25rem;
    color: var(--cms-fg);
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    max-width: 10rem;
  }
</style>

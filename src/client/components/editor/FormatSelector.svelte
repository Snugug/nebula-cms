<script lang="ts">
  import { getDefaultExtension } from '../../js/utils/file-types';

  /**
   * Props for the FormatSelector component, which renders a format switcher
   * when a collection supports multiple file types. onChange is passed per-instance
   * because the action to take when switching types is caller-specific (e.g. renaming
   * a file, creating a new draft with a different extension).
   */
  interface Props {
    // Type identifiers from the schema's files array (e.g. ['md', 'mdx'])
    fileTypes: string[];
    // Currently selected type identifier
    activeType: string;
    // Called when the user selects a different type
    onChange: (type: string) => void;
  }

  let { fileTypes, activeType, onChange }: Props = $props();
</script>

{#if fileTypes.length > 1}
  <div class="format-selector">
    <span class="format-selector__label">Format</span>
    <select
      class="format-selector__select"
      value={activeType}
      onchange={(e) => onChange((e.target as HTMLSelectElement).value)}
    >
      {#each fileTypes as type}
        <option value={type}>{getDefaultExtension(type) ?? type}</option>
      {/each}
    </select>
  </div>
{/if}

<style>
  /* Container uses grid to align label and select on one row */
  .format-selector {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem;
    align-items: center;
    padding: 0.25rem 1rem;
    border-bottom: 1px solid var(--dark-grey);
  }

  .format-selector__label {
    font-size: 0.75rem;
    color: var(--grey);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .format-selector__select {
    background: var(--black);
    border: 1px solid var(--dark-grey);
    border-radius: 0.25rem;
    color: var(--white);
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    max-width: 10rem;
  }
</style>

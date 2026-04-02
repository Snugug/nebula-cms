<script lang="ts">
  /*
   * General-purpose toolbar rendered above the CodeMirror editor body.
   * Hosts the FormatSelector and will hold future editor controls (bold, italic, link, etc.).
   */
  import FormatSelector from './FormatSelector.svelte';

  // Props for the toolbar above the CodeMirror editor
  interface Props {
    // Type identifiers from the schema's files array (e.g. ['md', 'mdx'])
    fileTypes: string[];
    // Currently selected type identifier
    activeType: string;
  }

  let { fileTypes, activeType }: Props = $props();
</script>

<div class="editor-body-toolbar">
  <FormatSelector {fileTypes} {activeType} />
</div>

<style>
  /* General-purpose toolbar above the CodeMirror editor */
  .editor-body-toolbar {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--cms-border);
    background: var(--cms-bg);
  }
</style>

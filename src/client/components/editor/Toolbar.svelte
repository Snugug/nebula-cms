<script lang="ts">
  import FormatSelector from './FormatSelector.svelte';
</script>

<div class="editor-body-toolbar">
  <FormatSelector />
</div>

<style>
  .editor-body-toolbar {
    display: flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--cms-border);
    background: var(--cms-bg);
  }
</style>

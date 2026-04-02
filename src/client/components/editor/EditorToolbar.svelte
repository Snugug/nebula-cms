<script lang="ts">
  import { getEditorFile } from '../../js/editor/editor.svelte';
  import { nav } from '../../js/state/router.svelte';
  import { schema } from '../../js/state/schema.svelte';
  import {
    handleSave,
    handlePublish,
    computePublishDisabled,
  } from '../../js/handlers/admin';
  import {
    showFilenameDialog,
    showDeleteDialog,
  } from '../../js/state/dialogs.svelte';

  // Current editor file state
  const file = $derived(getEditorFile());

  // Active collection derived from route, needed by save/publish handlers
  const activeCollection = $derived(
    nav.route.view !== 'home' ? nav.route.collection : null,
  );

  // Whether publish is disabled due to missing required fields
  const publishDisabled = $derived(
    computePublishDisabled(schema.active, file?.formData ?? {}),
  );

  // Display title from formData, falling back to filename or "Untitled Draft"
  const title = $derived(
    file && typeof file.formData.title === 'string'
      ? file.formData.title
      : file?.filename || 'Untitled Draft',
  );

  /**
   * Publishes the current file, showing the filename dialog if a filename is needed first.
   * @return {Promise<void>}
   */
  async function onPublish(): Promise<void> {
    const result = await handlePublish(activeCollection);
    if (result.status === 'needs-filename') {
      showFilenameDialog();
    }
  }
</script>

{#if file}
  <header class="toolbar">
    <div class="toolbar__info">
      <h1 class="toolbar__title">
        {title}
        <span
          class="dirty-indicator"
          class:dirty-indicator--visible={file.dirty}
          title={file.dirty ? 'Unsaved changes' : ''}>&bull;</span
        >
      </h1>
      {#if file.filename}
        <p class="toolbar__filename">{file.filename}</p>
      {/if}
    </div>
    <div class="toolbar__actions">
      {#if file.draftId}
        <button
          class="btn btn--danger-outline btn--compact"
          type="button"
          onclick={showDeleteDialog}
        >
          Delete Draft
        </button>
      {/if}
      <button
        class="btn btn--save-outline btn--compact"
        type="button"
        disabled={!file.dirty || file.saving}
        onclick={() => handleSave(activeCollection)}
      >
        {file.saving ? 'Saving...' : 'Save'}
      </button>
      <button
        class="btn btn--primary btn--compact"
        type="button"
        disabled={publishDisabled || file.saving}
        onclick={onPublish}
      >
        Publish
      </button>
    </div>
  </header>
{/if}

<style>
  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--cms-border);
  }

  .toolbar__info {
    display: grid;
  }

  .toolbar__title {
    font-size: 1rem;
    font-weight: normal;
    color: var(--cms-fg);
  }

  .toolbar__filename {
    font-size: 0.75rem;
    color: var(--cms-muted);
  }

  /* Always rendered to reserve space and prevent layout shift when toggling */
  .dirty-indicator {
    color: transparent;
    font-size: 1.25rem;
    vertical-align: middle;
    margin-left: 0.25rem;
  }

  .dirty-indicator--visible {
    color: var(--gold);
  }

  .toolbar__actions {
    display: grid;
    grid-auto-flow: column;
    align-items: center;
    gap: 0.5rem;
  }
</style>

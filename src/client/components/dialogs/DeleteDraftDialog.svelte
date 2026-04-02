<script lang="ts">
  /**
   * Confirmation dialog for deleting a draft, using native <dialog> with modal backdrop.
   */
  interface Props {
    // Called when the user confirms deletion
    onConfirm: () => void;
    // Called when the user cancels
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();

  // Dialog element ref
  let dialogEl = $state<HTMLDialogElement | null>(null);

  // Open the dialog on mount
  $effect(() => {
    dialogEl?.showModal();
  });
</script>

<dialog class="dialog confirm-dialog" bind:this={dialogEl} onclose={onCancel}>
  <h2 class="dialog__title">Delete Draft?</h2>
  <p class="dialog__message">This cannot be undone.</p>
  <div class="dialog__actions">
    <button class="btn btn--cancel" type="button" onclick={onCancel}
      >Cancel</button
    >
    <button class="btn btn--danger" type="button" onclick={onConfirm}
      >Delete</button
    >
  </div>
</dialog>

<style>
  .confirm-dialog {
    min-width: 18rem;
  }

  /* Tighter title spacing for the short confirmation dialog */
  .dialog__title {
    margin-bottom: 0.5rem;
  }

  .dialog__message {
    font-size: 0.875rem;
    color: var(--cms-muted);
    margin-bottom: 1.25rem;
  }
</style>

/*
 * Reactive state for dialog visibility. Lives here rather than in Admin.svelte
 * so that EditorToolbar (and other components) can trigger dialogs without
 * callback drilling through intermediate components.
 */

// Whether the filename dialog should be shown
let filenameDialogOpen = $state(false);

// Whether the delete-draft confirmation dialog should be shown
let deleteDialogOpen = $state(false);

export const dialogs = {
  // Whether the filename dialog is open.
  get filenameOpen(): boolean {
    return filenameDialogOpen;
  },
  // Whether the delete confirmation dialog is open.
  get deleteOpen(): boolean {
    return deleteDialogOpen;
  },
};

/**
 * Shows the filename dialog.
 * @return {void}
 */
export function showFilenameDialog(): void {
  filenameDialogOpen = true;
}

/**
 * Hides the filename dialog.
 * @return {void}
 */
export function hideFilenameDialog(): void {
  filenameDialogOpen = false;
}

/**
 * Shows the delete-draft confirmation dialog.
 * @return {void}
 */
export function showDeleteDialog(): void {
  deleteDialogOpen = true;
}

/**
 * Hides the delete-draft confirmation dialog.
 * @return {void}
 */
export function hideDeleteDialog(): void {
  deleteDialogOpen = false;
}

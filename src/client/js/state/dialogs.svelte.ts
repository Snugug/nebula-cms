/*
 * Reactive state for dialog visibility. Lives here rather than in Admin.svelte
 * so that EditorToolbar (and other components) can trigger dialogs without
 * callback drilling through intermediate components.
 */

// Which dialog is currently open, or null if none
let active = $state<'filename' | 'delete' | null>(null);

// The dialog type union, exported for type-safe consumers
export type DialogType = 'filename' | 'delete';

export const dialogs = {
  // The currently open dialog, or null if none.
  get active(): DialogType | null {
    return active;
  },
};

/**
 * Opens a dialog by type. Only one dialog can be open at a time.
 * @param {DialogType} type - The dialog to open
 * @return {void}
 */
export function openDialog(type: DialogType): void {
  active = type;
}

/**
 * Closes whichever dialog is currently open.
 * @return {void}
 */
export function closeDialog(): void {
  active = null;
}

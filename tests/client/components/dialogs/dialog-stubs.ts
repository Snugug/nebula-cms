/* Shared dialog test stubs for component tests.
 *
 * jsdom does not implement showModal() or close() on HTMLDialogElement.
 * Components that render <dialog> elements need these methods stubbed
 * before rendering. Call stubDialogMethods() in a beforeEach block.
 */

import { vi } from 'vitest';

/**
 * Stubs showModal and close on HTMLDialogElement.prototype so that
 * Svelte components using native <dialog> elements can mount without
 * throwing in jsdom.
 * @return {void}
 */
export function stubDialogMethods(): void {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
}

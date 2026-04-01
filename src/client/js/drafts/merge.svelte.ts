import { loadDrafts, type Draft } from './storage';
import { splitFrontmatter } from '../utils/frontmatter';
import { storageClient } from '../state/state.svelte';

// Drafts for the current collection
let drafts = $state<Draft[]>([]);
// Map of draftId → whether the live content has diverged from the draft's snapshot
let outdatedMap = $state<Record<string, boolean>>({});

// Reactive draft-merge state — Svelte 5 forbids exporting $state directly.
export const draftState = {
  get drafts(): Draft[] {
    return drafts;
  },
  get outdatedMap(): Record<string, boolean> {
    return outdatedMap;
  },
};
// Worker for off-thread snapshot comparison
let diffWorker: Worker | null = null;

/**
 * Initializes the diff worker singleton and wires up the result handler.
 * @return {Worker} The existing or newly created diff worker
 */
function ensureDiffWorker(): Worker {
  if (diffWorker) return diffWorker;
  // Uses .js extension because svelte-package does not rewrite URL string literals
  diffWorker = new Worker(new URL('./workers/diff.js', import.meta.url), {
    type: 'module',
  });
  diffWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data.type === 'diff-result') {
      outdatedMap = data.results;
    }
  });
  return diffWorker;
}

/**
 * Loads drafts for a collection from IndexedDB and dispatches snapshot comparisons to the diff worker for any drafts linked to live files. Reads live file contents via the StorageClient.
 * @param {string} collection - The collection to load drafts for
 * @return {Promise<void>}
 */
export async function mergeDrafts(collection: string): Promise<void> {
  drafts = await loadDrafts(collection);

  // Filter to drafts that need outdated checking:
  // must be linked to a live file (not new), have a snapshot, and have a filename
  const candidates = drafts.filter((d) => !d.isNew && d.snapshot && d.filename);
  if (candidates.length === 0) {
    outdatedMap = {};
    return;
  }

  if (!storageClient) {
    outdatedMap = {};
    return;
  }

  // Read all candidate files in parallel instead of sequentially.
  // js-yaml is dynamically imported because it's a transitive dep, not a direct devDependency.
  // The import is cached after the first resolution so only the first candidate pays the cost.
  const settled = await Promise.all(
    candidates.map(async (d) => {
      try {
        const text = await storageClient.readFile(collection, d.filename!);
        const { rawFrontmatter, body } = splitFrontmatter(text);
        const { load } = await import('js-yaml');
        const liveFormData = (load(rawFrontmatter) ?? {}) as Record<
          string,
          unknown
        >;
        const liveBody = body.replace(/^\n+/, '').replace(/\n+$/, '');
        return {
          draftId: d.id,
          snapshot: d.snapshot!,
          liveFormData,
          liveBody,
        };
      } catch {
        // File not found or unreadable — skip
        return null;
      }
    }),
  );
  const entries = settled.filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) {
    outdatedMap = {};
    return;
  }

  // Dispatch to the diff worker for off-thread comparison
  const worker = ensureDiffWorker();
  worker.postMessage({ type: 'diff', entries });
}

/**
 * Re-reads drafts from IndexedDB for the given collection and updates the reactive drafts list.
 * Used after saving/deleting a draft so the sidebar reflects changes immediately without a full collection reload.
 * @param {string} collection - The collection to refresh drafts for
 * @return {Promise<void>}
 */
export async function refreshDrafts(collection: string): Promise<void> {
  drafts = await loadDrafts(collection);
}

/**
 * Resets draft-related state and terminates the diff worker. Called during disconnect.
 * @return {void}
 */
export function resetDraftMerge(): void {
  diffWorker?.terminate();
  diffWorker = null;
  drafts = [];
  outdatedMap = {};
}

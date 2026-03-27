import { StorageClient } from '../client';
import { getFileCategory, getDataFormat } from '../../utils/file-types';
import type { FileEntry } from '../adapter';

//////////////////////////////
// Orchestrator Worker
//
// Routes file parsing by category: frontmatter files have their YAML block
// extracted via string manipulation and sent to the YAML parser worker;
// JSON data files are parsed inline; YAML/TOML data files are sent to their
// respective parser workers. Parser workers are lazily spawned on first need.
//////////////////////////////

/**
 * Extracts the raw YAML block from a frontmatter-delimited file (markdown/MDX/Markdoc).
 * Handles BOM stripping, CRLF normalization, and horizontal rule rejection.
 * Returns the raw YAML string without parsing it — parsing is delegated to the YAML parser worker.
 * @param {string} content - Raw file content
 * @return {string | null} The raw YAML string between --- delimiters, or null if none found
 */
function extractYamlBlock(content: string): string | null {
  // Strip BOM if present
  let str = content.startsWith('\uFEFF') ? content.slice(1) : content;

  // Normalize line endings
  str = str.replace(/\r\n/g, '\n');

  // Reject ---- (horizontal rule) before checking for valid frontmatter opener
  if (str.startsWith('----')) return null;
  if (!str.startsWith('---\n')) return null;

  // Find closing delimiter
  const closeIndex = str.indexOf('\n---\n', 3);
  if (closeIndex === -1) {
    // Check for --- at end of file with no trailing newline
    if (str.endsWith('\n---')) {
      const yaml = str.slice(4, str.length - 4);
      if (!yaml.trim()) return null;
      return yaml;
    }
    return null;
  }

  const yaml = str.slice(4, closeIndex);
  if (!yaml.trim()) return null;

  return yaml;
}

//////////////////////////////
// Batch item type for parser worker communication
//////////////////////////////

/**
 * A key/content pair for batch parsing requests.
 */
type BatchItem = {
  key: string;
  content: string;
};

//////////////////////////////
// Parser worker management
//////////////////////////////

// Lazily-spawned parser workers
let yamlWorker: Worker | null = null;
let tomlWorker: Worker | null = null;

// Incrementing ID for correlating batch requests with responses
let batchIdCounter = 0;

// Pending batch response promises keyed by ID
const pendingBatches = new Map<
  string,
  {
    resolve: (results: Record<string, Record<string, unknown>>) => void;
    reject: (err: Error) => void;
  }
>();

/**
 * Returns the lazily-spawned YAML parser worker, creating it on first call.
 * Uses `.js` extension in the URL because svelte-package doesn't rewrite URL strings.
 * @return {Worker} The YAML parser worker instance
 */
function getYamlWorker(): Worker {
  if (!yamlWorker) {
    yamlWorker = new Worker(new URL('./yaml-parser.js', import.meta.url), {
      type: 'module',
    });
    yamlWorker.onmessage = handleParserResponse;
  }
  return yamlWorker;
}

/**
 * Returns the lazily-spawned TOML parser worker, creating it on first call.
 * Uses `.js` extension in the URL because svelte-package doesn't rewrite URL strings.
 * @return {Worker} The TOML parser worker instance
 */
function getTomlWorker(): Worker {
  if (!tomlWorker) {
    tomlWorker = new Worker(new URL('./toml-parser.js', import.meta.url), {
      type: 'module',
    });
    tomlWorker.onmessage = handleParserResponse;
  }
  return tomlWorker;
}

/**
 * Handles responses from parser workers by resolving/rejecting the corresponding
 * pending batch promise based on the response ID.
 * @param {MessageEvent} event - The message event from the parser worker
 * @return {void}
 */
function handleParserResponse(event: MessageEvent): void {
  const { id, ok, results, error } = event.data;
  const pending = pendingBatches.get(id);
  if (!pending) return;
  pendingBatches.delete(id);

  if (ok) {
    pending.resolve(results);
  } else {
    pending.reject(new Error(error));
  }
}

/**
 * Sends a batch of key/content pairs to a parser worker and returns a promise
 * that resolves with the parsed results map. Uses an incrementing ID for
 * request/response correlation, following the same pattern as StorageClient.
 * @param {Worker} worker - The parser worker to send the batch to
 * @param {BatchItem[]} items - Array of key/content pairs to parse
 * @return {Promise<Record<string, Record<string, unknown>>>} Map of key to parsed data
 */
function sendBatch(
  worker: Worker,
  items: BatchItem[],
): Promise<Record<string, Record<string, unknown>>> {
  const id = String(++batchIdCounter);
  return new Promise((resolve, reject) => {
    pendingBatches.set(id, { resolve, reject });
    worker.postMessage({ type: 'parse-batch', id, items });
  });
}

//////////////////////////////
// File categorization and parsing
//////////////////////////////

/**
 * Processes a list of files by categorizing each file, collecting batch items
 * for YAML/TOML parser workers, parsing JSON inline, and assembling the final
 * items array with parsed data.
 * @param {FileEntry[]} files - The files returned by the storage adapter
 * @return {Promise<Array<{ filename: string; data: Record<string, unknown> }>>} Parsed items
 */
async function processFiles(
  files: FileEntry[],
): Promise<Array<{ filename: string; data: Record<string, unknown> }>> {
  // Inline-parsed results (JSON files)
  const inlineResults: Array<{
    filename: string;
    data: Record<string, unknown>;
  }> = [];

  // Batch items for YAML worker (frontmatter YAML blocks + YAML data files)
  const yamlBatch: BatchItem[] = [];
  // Batch items for TOML worker
  const tomlBatch: BatchItem[] = [];
  // Track which filenames map to which batch for reassembly
  const yamlFilenames: string[] = [];
  const tomlFilenames: string[] = [];
  // Files with no frontmatter get empty data
  const emptyDataFiles: string[] = [];

  for (const file of files) {
    const category = getFileCategory(file.filename);

    if (category === 'frontmatter') {
      const yamlBlock = extractYamlBlock(file.content);
      if (yamlBlock) {
        yamlBatch.push({ key: file.filename, content: yamlBlock });
        yamlFilenames.push(file.filename);
      } else {
        // No frontmatter found — include with empty data
        emptyDataFiles.push(file.filename);
      }
      continue;
    }

    if (category === 'data') {
      const format = getDataFormat(file.filename);

      if (format === 'json') {
        try {
          const data = JSON.parse(file.content) as Record<string, unknown>;
          inlineResults.push({ filename: file.filename, data });
        } catch {
          // Invalid JSON — include with empty data
          inlineResults.push({ filename: file.filename, data: {} });
        }
        continue;
      }

      if (format === 'yaml') {
        yamlBatch.push({ key: file.filename, content: file.content });
        yamlFilenames.push(file.filename);
        continue;
      }

      if (format === 'toml') {
        tomlBatch.push({ key: file.filename, content: file.content });
        tomlFilenames.push(file.filename);
        continue;
      }
    }

    // Unrecognised file type — include with empty data
    emptyDataFiles.push(file.filename);
  }

  // Send batches to parser workers in parallel
  const promises: Promise<Record<string, Record<string, unknown>>>[] = [];
  let yamlPromiseIdx = -1;
  let tomlPromiseIdx = -1;

  if (yamlBatch.length > 0) {
    yamlPromiseIdx = promises.length;
    promises.push(sendBatch(getYamlWorker(), yamlBatch));
  }

  if (tomlBatch.length > 0) {
    tomlPromiseIdx = promises.length;
    promises.push(sendBatch(getTomlWorker(), tomlBatch));
  }

  const batchResults = await Promise.all(promises);

  // Assemble final items from all sources
  const items: Array<{ filename: string; data: Record<string, unknown> }> = [];

  // Add inline results (JSON)
  items.push(...inlineResults);

  // Add YAML results
  if (yamlPromiseIdx >= 0) {
    const yamlResults = batchResults[yamlPromiseIdx];
    for (const filename of yamlFilenames) {
      items.push({
        filename,
        data: yamlResults[filename] ?? {},
      });
    }
  }

  // Add TOML results
  if (tomlPromiseIdx >= 0) {
    const tomlResults = batchResults[tomlPromiseIdx];
    for (const filename of tomlFilenames) {
      items.push({
        filename,
        data: tomlResults[filename] ?? {},
      });
    }
  }

  // Add empty-data files
  for (const filename of emptyDataFiles) {
    items.push({ filename, data: {} });
  }

  return items;
}

//////////////////////////////
// Main message handler
//////////////////////////////

// Storage client, initialized when the main thread transfers a port
let storageClient: StorageClient | null = null;

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type } = event.data;

  if (type === 'port') {
    // Main thread is transferring a MessagePort connected to the storage SharedWorker
    const port = event.ports[0];
    storageClient = new StorageClient(port);
    return;
  }

  if (type === 'parse') {
    const { collection } = event.data;
    if (!storageClient) {
      self.postMessage({
        type: 'error',
        message: 'Storage port not initialized',
      });
      return;
    }

    try {
      // Pass extensions from the message, defaulting to markdown for backward compatibility
      const extensions: string[] = event.data.extensions ?? ['.md', '.mdx'];
      const files: FileEntry[] = await storageClient.listFiles(
        collection,
        extensions,
      );

      const items = await processFiles(files);

      // Sort alphabetically by title, falling back to filename
      items.sort((a, b) => {
        const aTitle =
          typeof a.data.title === 'string' ? a.data.title : a.filename;
        const bTitle =
          typeof b.data.title === 'string' ? b.data.title : b.filename;
        return aTitle.toLowerCase().localeCompare(bTitle.toLowerCase());
      });

      self.postMessage({ type: 'result', collection, items });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage({ type: 'error', message });
    }
  }
});

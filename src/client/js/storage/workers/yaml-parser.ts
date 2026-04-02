/*
 * YAML Parser Worker
 *
 * Handles YAML parsing and serialization on behalf of the main thread.
 * Messages are dispatched by type: 'parse', 'parse-batch', 'stringify'.
 * Each handler wraps its logic in try/catch and always posts a typed result.
 */

import { load, dump } from 'js-yaml';

// Inbound message shape for a single YAML parse request.
interface ParseMessage {
  type: 'parse';
  id: string;
  content: string;
}

// A single item in a batch parse request.
interface BatchItem {
  key: string;
  content: string;
}

// Inbound message shape for a batch YAML parse request.
interface ParseBatchMessage {
  type: 'parse-batch';
  id: string;
  items: BatchItem[];
}

// Inbound message shape for a YAML stringify request.
interface StringifyMessage {
  type: 'stringify';
  id: string;
  data: Record<string, unknown>;
}

// Union of all inbound message types.
type InboundMessage = ParseMessage | ParseBatchMessage | StringifyMessage;

/*
//////////////////////////////
// Message handler
//////////////////////////////
*/

/**
 * Handles a single YAML parse request. Parses the provided content string
 * and posts a parse-result message with the resulting data object or error.
 * @param {ParseMessage} msg - The inbound parse message
 * @return {void}
 */
function handleParse(msg: ParseMessage): void {
  try {
    const data = load(msg.content) as Record<string, unknown>;
    self.postMessage({ type: 'parse-result', id: msg.id, ok: true, data });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'parse-result', id: msg.id, ok: false, error });
  }
}

/**
 * Handles a batch YAML parse request. Iterates over all items, parses each
 * one, and posts a parse-batch-result with a key-to-data results map.
 * If any item fails to parse, the entire batch result is marked as failed.
 * @param {ParseBatchMessage} msg - The inbound parse-batch message
 * @return {void}
 */
function handleParseBatch(msg: ParseBatchMessage): void {
  try {
    const results: Record<string, Record<string, unknown>> = {};
    for (const item of msg.items) {
      results[item.key] = load(item.content) as Record<string, unknown>;
    }
    self.postMessage({
      type: 'parse-batch-result',
      id: msg.id,
      ok: true,
      results,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'parse-batch-result',
      id: msg.id,
      ok: false,
      error,
    });
  }
}

/**
 * Handles a YAML stringify request. Serializes the provided data object to
 * a YAML string and posts a stringify-result message with the content.
 * lineWidth: -1 disables js-yaml's automatic line folding so long values
 * are not wrapped across lines, which would corrupt multi-line string values.
 * @param {StringifyMessage} msg - The inbound stringify message
 * @return {void}
 */
function handleStringify(msg: StringifyMessage): void {
  try {
    const content = dump(msg.data, { lineWidth: -1 });
    self.postMessage({
      type: 'stringify-result',
      id: msg.id,
      ok: true,
      content,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({
      type: 'stringify-result',
      id: msg.id,
      ok: false,
      error,
    });
  }
}

// Listen for messages from the main thread and dispatch by type
self.addEventListener('message', (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'parse') {
    handleParse(msg);
  } else if (msg.type === 'parse-batch') {
    handleParseBatch(msg);
  } else if (msg.type === 'stringify') {
    handleStringify(msg);
  }
});

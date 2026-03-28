/*
 * TOML parser worker
 *
 * Runs as a dedicated Worker. Handles three message types — parse, parse-batch,
 * stringify — and posts results back to the main thread via self.postMessage.
 * All handlers are wrapped in try/catch so errors are returned as structured
 * failure messages rather than unhandled rejections.
 */

import { parse, stringify } from 'smol-toml';

// Inbound message shape for a single TOML parse request.
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

// Inbound message shape for a batch TOML parse request.
interface ParseBatchMessage {
  type: 'parse-batch';
  id: string;
  items: BatchItem[];
}

// Inbound message shape for a TOML stringify request.
interface StringifyMessage {
  type: 'stringify';
  id: string;
  data: Record<string, unknown>;
}

// Union of all inbound message types.
type InboundMessage = ParseMessage | ParseBatchMessage | StringifyMessage;

/**
 * Handles a 'parse' request: parses a single TOML string and posts the result.
 * @param {ParseMessage} msg - The inbound parse message
 * @return {void}
 */
function handleParse(msg: ParseMessage): void {
  const { id, content } = msg;
  try {
    const data = parse(content) as Record<string, unknown>;
    self.postMessage({ type: 'parse-result', id, ok: true, data });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'parse-result', id, ok: false, error });
  }
}

/**
 * Handles a 'parse-batch' request: parses multiple TOML strings keyed by
 * a caller-supplied key, and posts a single result containing all parsed values.
 * @param {ParseBatchMessage} msg - The inbound parse-batch message
 * @return {void}
 */
function handleParseBatch(msg: ParseBatchMessage): void {
  const { id, items } = msg;
  try {
    const results: Record<string, Record<string, unknown>> = {};
    for (const item of items) {
      results[item.key] = parse(item.content) as Record<string, unknown>;
    }
    self.postMessage({ type: 'parse-batch-result', id, ok: true, results });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'parse-batch-result', id, ok: false, error });
  }
}

/**
 * Handles a 'stringify' request: serializes a plain object to a TOML string
 * and posts the result.
 * @param {StringifyMessage} msg - The inbound stringify message
 * @return {void}
 */
function handleStringify(msg: StringifyMessage): void {
  const { id, data } = msg;
  try {
    const content = stringify(data);
    self.postMessage({ type: 'stringify-result', id, ok: true, content });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'stringify-result', id, ok: false, error });
  }
}

// Dispatch incoming messages by type
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

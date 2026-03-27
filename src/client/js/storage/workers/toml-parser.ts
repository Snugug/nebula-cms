/*
 * TOML parser worker
 *
 * Runs as a dedicated Worker. Handles three message types — parse, parse-batch,
 * stringify — and posts results back to the main thread via self.postMessage.
 * All handlers are wrapped in try/catch so errors are returned as structured
 * failure messages rather than unhandled rejections.
 */

import { parse, stringify } from 'smol-toml';

/**
 * Handles a 'parse' request: parses a single TOML string and posts the result.
 * @param {string} id - Correlation ID echoed back in the response
 * @param {string} content - Raw TOML content to parse
 * @return {void}
 */
function handleParse(id: string, content: string): void {
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
 * @param {string} id - Correlation ID echoed back in the response
 * @param {Array<{ key: string; content: string }>} items - Keyed TOML inputs
 * @return {void}
 */
function handleParseBatch(
  id: string,
  items: Array<{ key: string; content: string }>,
): void {
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
 * @param {string} id - Correlation ID echoed back in the response
 * @param {Record<string, unknown>} data - Data to serialize
 * @return {void}
 */
function handleStringify(id: string, data: Record<string, unknown>): void {
  try {
    const content = stringify(data);
    self.postMessage({ type: 'stringify-result', id, ok: true, content });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ type: 'stringify-result', id, ok: false, error });
  }
}

// Dispatch incoming messages by type
self.addEventListener('message', (event) => {
  const { type, id } = event.data as { type: string; id: string };

  if (type === 'parse') {
    const { content } = event.data as { content: string };
    handleParse(id, content);
    return;
  }

  if (type === 'parse-batch') {
    const { items } = event.data as {
      items: Array<{ key: string; content: string }>;
    };
    handleParseBatch(id, items);
    return;
  }

  if (type === 'stringify') {
    const { data } = event.data as { data: Record<string, unknown> };
    handleStringify(id, data);
  }
});

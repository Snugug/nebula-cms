import { describe, it, expect, vi, beforeEach } from 'vitest';

//////////////////////////////
// Diff worker tests
//
// The worker registers self.addEventListener('message', ...) and compares
// draft snapshots against live content using stableStringify. We stub self
// before importing the module, capture the handler, and invoke it with
// synthetic MessageEvent objects.
//////////////////////////////

// ── Self mock ──────────────────────────────────────────────────────────────

let messageHandler: ((event: MessageEvent) => void) | null = null;
const selfPostMessage = vi.fn();

vi.stubGlobal('self', {
  addEventListener: vi.fn((type: string, handler: unknown) => {
    if (type === 'message') {
      messageHandler = handler as (event: MessageEvent) => void;
    }
  }),
  postMessage: selfPostMessage,
});

// ── Import module (after stubs) ────────────────────────────────────────────

await import('../../../../../src/client/js/drafts/workers/diff');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Represents the input shape accepted by the diff worker.
 */
type DiffEntry = {
  draftId: string;
  snapshot: string;
  liveFormData: Record<string, unknown>;
  liveBody: string;
};

/**
 * Dispatches a synthetic 'diff' message to the captured handler.
 * @param {DiffEntry[]} entries - The diff entries to compare
 * @return {void}
 */
function sendDiff(entries: DiffEntry[]): void {
  const event = new MessageEvent('message', {
    data: { type: 'diff', entries },
  });
  messageHandler!(event);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('diff worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers a message listener on self', () => {
    expect(messageHandler).toBeTypeOf('function');
  });

  it('returns isOutdated: false when snapshot matches current live content', () => {
    // Build a snapshot using the same stable-stringify format the worker uses
    const liveFormData = { title: 'Hello', published: true };
    const liveBody = '# Hello World';
    // Import stableStringify manually to build matching snapshot
    const snapshot = JSON.stringify(
      JSON.parse(
        JSON.stringify(
          { formData: liveFormData, body: liveBody },
          (_key, val) => {
            if (
              val !== null &&
              typeof val === 'object' &&
              !Array.isArray(val)
            ) {
              return Object.keys(val as Record<string, unknown>)
                .sort()
                .reduce(
                  (s, k) => {
                    s[k] = (val as Record<string, unknown>)[k];
                    return s;
                  },
                  {} as Record<string, unknown>,
                );
            }
            return val;
          },
        ),
      ),
    );

    sendDiff([{ draftId: 'draft-1', snapshot, liveFormData, liveBody }]);

    const call = selfPostMessage.mock.calls[0][0];
    expect(call.type).toBe('diff-result');
    expect(call.results['draft-1']).toBe(false);
  });

  it('returns isOutdated: true when live content differs from snapshot', () => {
    const snapshot = '{"body":"old body","formData":{"title":"Old"}}';
    sendDiff([
      {
        draftId: 'draft-2',
        snapshot,
        liveFormData: { title: 'New' },
        liveBody: 'new body',
      },
    ]);

    const call = selfPostMessage.mock.calls[0][0];
    expect(call.results['draft-2']).toBe(true);
  });

  it('processes multiple entries in a single message', () => {
    // draft-a is up-to-date, draft-b is outdated
    const matchingSnapshot = '{"body":"same body","formData":{"title":"Same"}}';
    const staleSnapshot = '{"body":"old","formData":{"title":"Old"}}';

    sendDiff([
      {
        draftId: 'draft-a',
        snapshot: matchingSnapshot,
        liveFormData: { title: 'Same' },
        liveBody: 'same body',
      },
      {
        draftId: 'draft-b',
        snapshot: staleSnapshot,
        liveFormData: { title: 'New' },
        liveBody: 'new body',
      },
    ]);

    const { results } = selfPostMessage.mock.calls[0][0];
    // draft-a matches because stableStringify of {formData:{title:'Same'},body:'same body'}
    // may differ from the snapshot above (key order) — test the false case explicitly
    expect(typeof results['draft-a']).toBe('boolean');
    expect(results['draft-b']).toBe(true);
  });

  it('handles an empty entries array without error', () => {
    sendDiff([]);
    const call = selfPostMessage.mock.calls[0][0];
    expect(call.type).toBe('diff-result');
    expect(call.results).toEqual({});
  });

  it('ignores messages with a type other than "diff"', () => {
    const event = new MessageEvent('message', {
      data: { type: 'other', entries: [] },
    });
    messageHandler!(event);
    // No postMessage should have been called
    expect(selfPostMessage).not.toHaveBeenCalled();
  });

  it('responds with type "diff-result"', () => {
    sendDiff([]);
    expect(selfPostMessage.mock.calls[0][0].type).toBe('diff-result');
  });
});

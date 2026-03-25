import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

//////////////////////////////
// GitHubAdapter tests
//
// All network calls are intercepted by replacing globalThis.fetch with a
// vi.fn() that returns pre-built Response objects. Each test group
// configures fetch to respond to the specific API endpoints exercised
// by the method under test.
//////////////////////////////

import { GitHubAdapter } from '../../../../src/client/js/storage/github';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal Response-like object for use in fetch mocks.
 * @param {unknown} body - The response body (will be JSON-serialized if object)
 * @param {number} status - HTTP status code
 * @param {{ text?: boolean }} opts - When text is true, body is treated as a raw string
 * @return {Response} A mock Response instance
 */
function mockResponse(
  body: unknown,
  status = 200,
  opts: { text?: boolean } = {},
): Response {
  const bodyStr = opts.text ? (body as string) : JSON.stringify(body);
  return new Response(bodyStr, {
    status,
    headers: { 'Content-Type': opts.text ? 'text/plain' : 'application/json' },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GitHubAdapter', () => {
  const TOKEN = 'ghp_test_token';
  const REPO = 'owner/my-repo';

  describe('validate', () => {
    it('stores the default branch returned by the repo endpoint', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ default_branch: 'develop' }),
      );
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.validate();
      // Confirm the branch is used in subsequent calls by inspecting listFiles
      fetchMock.mockResolvedValueOnce(mockResponse([]));
      await adapter.listFiles('posts');
      const listUrl = fetchMock.mock.calls[1][0] as string;
      expect(listUrl).toContain('ref=develop');
    });

    it('throws for a 401 response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 401));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.validate()).rejects.toThrow('Invalid or expired');
    });

    it('throws for a 403 response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 403));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.validate()).rejects.toThrow('lacks repository');
    });

    it('throws for a 404 response', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.validate()).rejects.toThrow('not found');
    });

    it('throws a generic error for other non-ok statuses', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 500));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.validate()).rejects.toThrow('GitHub API error: 500');
    });
  });

  describe('listFiles', () => {
    it('returns empty array when the collection path returns 404', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      const files = await adapter.listFiles('posts');
      expect(files).toEqual([]);
    });

    it('returns only .md and .mdx files, fetching their content', async () => {
      // Directory listing response
      fetchMock.mockResolvedValueOnce(
        mockResponse([
          {
            name: 'hello.md',
            download_url: 'https://raw.github.com/hello.md',
          },
          {
            name: 'world.mdx',
            download_url: 'https://raw.github.com/world.mdx',
          },
          {
            name: 'image.png',
            download_url: 'https://raw.github.com/image.png',
          },
        ]),
      );
      // readFile calls for hello.md and world.mdx
      fetchMock.mockResolvedValueOnce(
        mockResponse('# Hello', 200, { text: true }),
      );
      fetchMock.mockResolvedValueOnce(
        mockResponse('# World', 200, { text: true }),
      );

      const adapter = new GitHubAdapter(TOKEN, REPO);
      const files = await adapter.listFiles('posts');
      const names = files.map((f) => f.filename).sort();
      expect(names).toEqual(['hello.md', 'world.mdx']);
    });

    it('throws when the listing request fails with a non-404 error', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 500));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.listFiles('posts')).rejects.toThrow(
        'Failed to list files',
      );
    });
  });

  describe('readFile', () => {
    it('returns the raw file content', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse('---\ntitle: Test\n---\n', 200, { text: true }),
      );
      const adapter = new GitHubAdapter(TOKEN, REPO);
      const content = await adapter.readFile('posts', 'test.md');
      expect(content).toBe('---\ntitle: Test\n---\n');
    });

    it('sends the raw+json Accept header', async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse('content', 200, { text: true }),
      );
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.readFile('posts', 'test.md');
      const headers = fetchMock.mock.calls[0][1].headers as Record<
        string,
        string
      >;
      expect(headers['Accept']).toBe('application/vnd.github.raw+json');
    });

    it('throws when the file is not found', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.readFile('posts', 'missing.md')).rejects.toThrow(
        'Failed to read',
      );
    });
  });

  describe('writeFile', () => {
    it('sends a PUT request without sha for a new file', async () => {
      // GET returns 404 (file doesn't exist yet)
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      // PUT succeeds
      fetchMock.mockResolvedValueOnce(mockResponse({ content: {} }));

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.writeFile('posts', 'new.md', '# New');

      const putCall = fetchMock.mock.calls[1];
      const putBody = JSON.parse(putCall[1].body as string);
      expect(putBody.sha).toBeUndefined();
      expect(putBody.message).toContain('new.md');
    });

    it('sends a PUT request with sha for an existing file', async () => {
      // GET returns existing file with sha
      fetchMock.mockResolvedValueOnce(
        mockResponse({ sha: 'abc123', name: 'existing.md' }),
      );
      // PUT succeeds
      fetchMock.mockResolvedValueOnce(mockResponse({ content: {} }));

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.writeFile('posts', 'existing.md', 'updated');

      const putBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
      expect(putBody.sha).toBe('abc123');
    });

    it('throws when the PUT request fails', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      fetchMock.mockResolvedValueOnce(
        mockResponse('error text', 422, { text: true }),
      );

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.writeFile('posts', 'bad.md', 'x')).rejects.toThrow(
        'Failed to write',
      );
    });

    it('base64-encodes the content', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      fetchMock.mockResolvedValueOnce(mockResponse({ content: {} }));

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.writeFile('posts', 'check.md', 'hello');

      const putBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
      // 'hello' base64 encodes to 'aGVsbG8='
      expect(putBody.content).toBe('aGVsbG8=');
    });
  });

  describe('writeFiles', () => {
    it('is a no-op for an empty array', async () => {
      const adapter = new GitHubAdapter(TOKEN, REPO);
      await expect(adapter.writeFiles([])).resolves.toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('delegates to writeFile for a single-file array', async () => {
      // GET (check sha) + PUT
      fetchMock.mockResolvedValueOnce(mockResponse({}, 404));
      fetchMock.mockResolvedValueOnce(mockResponse({ content: {} }));

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.writeFiles([
        { collection: 'posts', filename: 'one.md', content: 'body' },
      ]);
      // Two calls: GET for sha check, PUT for write
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('uses the Git Trees API for multiple files', async () => {
      // GET /git/ref/heads/main
      fetchMock.mockResolvedValueOnce(
        mockResponse({ object: { sha: 'commit-sha' } }),
      );
      // GET /git/commits/commit-sha
      fetchMock.mockResolvedValueOnce(
        mockResponse({ tree: { sha: 'tree-sha' } }),
      );
      // POST /git/trees
      fetchMock.mockResolvedValueOnce(mockResponse({ sha: 'new-tree-sha' }));
      // POST /git/commits
      fetchMock.mockResolvedValueOnce(mockResponse({ sha: 'new-commit-sha' }));
      // PATCH /git/refs/heads/main
      fetchMock.mockResolvedValueOnce(mockResponse({ ref: 'refs/heads/main' }));

      const adapter = new GitHubAdapter(TOKEN, REPO);
      await adapter.writeFiles([
        { collection: 'posts', filename: 'a.md', content: 'A' },
        { collection: 'posts', filename: 'b.md', content: 'B' },
      ]);

      // Should have made 5 API calls
      expect(fetchMock).toHaveBeenCalledTimes(5);
      // The tree POST should contain both file paths
      const treeBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
      const paths = treeBody.tree.map((t: { path: string }) => t.path);
      expect(paths).toContain('src/content/posts/a.md');
      expect(paths).toContain('src/content/posts/b.md');
    });
  });
});

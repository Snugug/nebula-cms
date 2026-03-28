import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import EditorTabs from '../../../../src/client/components/editor/EditorTabs.svelte';

/**
 * Tests for the EditorTabs component.
 * Mocks schema-utils and editor.svelte to control tab data without
 * triggering Svelte 5 rune initialization in the jsdom environment.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run,
// since vi.mock calls are hoisted to the top of the file by Vitest.
const {
  mockGetActiveTab,
  mockSetActiveTab,
  mockExtractTabs,
  mockGetEditorFile,
} = vi.hoisted(() => ({
  mockGetActiveTab: vi.fn(() => 'metadata'),
  mockSetActiveTab: vi.fn(),
  mockExtractTabs: vi.fn(() => [] as string[]),
  mockGetEditorFile: vi.fn(() => null),
}));

vi.mock('../../../../src/client/js/utils/schema-utils', () => ({
  extractTabs: mockExtractTabs,
}));

vi.mock('../../../../src/client/js/editor/editor.svelte', () => ({
  getActiveTab: mockGetActiveTab,
  setActiveTab: mockSetActiveTab,
  getEditorFile: mockGetEditorFile,
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('EditorTabs', () => {
  //////////////////////////////
  // Default tabs
  //////////////////////////////

  it('always renders the Metadata and Body tabs', () => {
    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels).toContain('Metadata');
    expect(labels).toContain('Body');
  });

  it('renders Metadata before Body in tab order', () => {
    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels.indexOf('Metadata')).toBeLessThan(labels.indexOf('Body'));
  });

  //////////////////////////////
  // Schema-derived custom tabs
  //////////////////////////////

  it('renders custom tabs returned by extractTabs', () => {
    mockExtractTabs.mockReturnValueOnce(['seo', 'social']);

    const { container } = render(EditorTabs, {
      props: {
        schema: {
          properties: {
            seoTitle: { type: 'string', tab: ['seo'] },
            ogImage: { type: 'string', tab: ['social'] },
          },
        },
      },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels).toContain('Seo');
    expect(labels).toContain('Social');
  });

  it('capitalizes custom tab labels', () => {
    mockExtractTabs.mockReturnValueOnce(['advanced']);

    const { container } = render(EditorTabs, {
      props: { schema: { properties: {} } },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());
    expect(labels).toContain('Advanced');
  });

  it('renders no custom tabs when schema is null', () => {
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = container.querySelectorAll('.tabs__tab');
    // Only Metadata and Body should be present
    expect(buttons.length).toBe(2);
  });

  //////////////////////////////
  // Active tab state
  //////////////////////////////

  it('marks the active tab with tabs__tab--active class', () => {
    mockGetActiveTab.mockReturnValue('body');
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const active = buttons.find((b) =>
      b.classList.contains('tabs__tab--active'),
    );

    expect(active?.textContent?.trim()).toBe('Body');
  });

  it('sets aria-selected="true" on the active tab', () => {
    mockGetActiveTab.mockReturnValue('metadata');
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const activeBtn = buttons.find(
      (b) => b.getAttribute('aria-selected') === 'true',
    );

    expect(activeBtn?.textContent?.trim()).toBe('Metadata');
  });

  //////////////////////////////
  // Click interaction
  //////////////////////////////

  it('calls setActiveTab with the clicked tab identifier', async () => {
    mockSetActiveTab.mockClear();
    mockGetActiveTab.mockReturnValue('metadata');
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(
      container.querySelectorAll('.tabs__tab'),
    ) as HTMLButtonElement[];
    const bodyBtn = buttons.find((b) => b.textContent?.trim() === 'Body')!;
    await fireEvent.click(bodyBtn);

    expect(mockSetActiveTab).toHaveBeenCalledOnce();
    expect(mockSetActiveTab).toHaveBeenCalledWith('body');
  });

  it('calls setActiveTab with "metadata" when the Metadata tab is clicked', async () => {
    mockSetActiveTab.mockClear();
    mockGetActiveTab.mockReturnValue('body');
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(
      container.querySelectorAll('.tabs__tab'),
    ) as HTMLButtonElement[];
    const metaBtn = buttons.find((b) => b.textContent?.trim() === 'Metadata')!;
    await fireEvent.click(metaBtn);

    expect(mockSetActiveTab).toHaveBeenCalledWith('metadata');
  });

  //////////////////////////////
  // Body tab visibility by file type
  //////////////////////////////

  it('shows the Body tab when the open file is a .md file', () => {
    mockGetEditorFile.mockReturnValueOnce({ filename: 'post.md' });
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels).toContain('Body');
  });

  it('hides the Body tab when the open file is a .json file', () => {
    mockGetEditorFile.mockReturnValueOnce({ filename: 'data.json' });
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels).not.toContain('Body');
  });

  it('shows the Body tab when no file is open (fallback default)', () => {
    mockGetEditorFile.mockReturnValueOnce(null);
    mockExtractTabs.mockReturnValueOnce([]);

    const { container } = render(EditorTabs, {
      props: { schema: null },
    });

    const buttons = Array.from(container.querySelectorAll('.tabs__tab'));
    const labels = buttons.map((b) => b.textContent?.trim());

    expect(labels).toContain('Body');
  });
});

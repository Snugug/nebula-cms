import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import MetadataForm from '../../../src/client/components/MetadataForm.svelte';

/**
 * Tests for the MetadataForm component.
 * Mocks schema-utils and editor.svelte to control field lists without
 * triggering Svelte 5 rune initialization in jsdom.
 *
 * MetadataForm delegates the actual field rendering to SchemaField, which in
 * turn renders leaf input components. These tests verify that the correct
 * fields are surfaced based on the active tab and schema structure.
 */

// vi.hoisted ensures these declarations are available when vi.mock factories run,
// since vi.mock calls are hoisted to the top of the file by Vitest.
const { mockGetFieldsForTab, mockFormData } = vi.hoisted(() => ({
  mockGetFieldsForTab: vi.fn(() => [] as string[]),
  mockFormData: vi.fn(() => ({}) as Record<string, unknown>),
}));

vi.mock('../../../src/client/js/utils/schema-utils', () => ({
  getFieldsForTab: mockGetFieldsForTab,
  resolveFieldType: vi.fn((schema: Record<string, unknown>) => {
    if (schema['type'] === 'string') return { kind: 'string' };
    if (schema['type'] === 'boolean') return { kind: 'boolean' };
    if (schema['type'] === 'number') return { kind: 'number' };
    return { kind: 'unknown' };
  }),
  createDefaultValue: vi.fn(() => ''),
  getByPath: vi.fn(),
  setByPath: vi.fn(),
}));

vi.mock('../../../src/client/js/editor/editor.svelte', () => ({
  editor: {
    get data() {
      return mockFormData();
    },
    get tab() {
      return 'metadata';
    },
    get originalFilename() {
      return '';
    },
  },
  updateFormField: vi.fn(),
}));

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

/** Builds a minimal schema with string and boolean fields. */
const sampleSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title' },
    description: { type: 'string', title: 'Description' },
    published: { type: 'boolean', title: 'Published' },
  },
  required: ['title'],
};

describe('MetadataForm', () => {
  //////////////////////////////
  // Field rendering
  //////////////////////////////

  it('renders a field for each property returned by getFieldsForTab', () => {
    mockGetFieldsForTab.mockReturnValue(['title', 'description']);
    mockFormData.mockReturnValue({ title: 'Hello', description: 'World' });

    const { container } = render(MetadataForm, {
      props: { schema: sampleSchema },
    });

    // SchemaField renders a label element for each field
    const labels = container.querySelectorAll('label');
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it('renders an empty form when getFieldsForTab returns no fields', () => {
    mockGetFieldsForTab.mockReturnValue([]);
    mockFormData.mockReturnValue({});

    const { container } = render(MetadataForm, {
      props: { schema: sampleSchema },
    });

    const form = container.querySelector('.metadata-form');
    expect(form).not.toBeNull();
    // No fields rendered
    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBe(0);
  });

  it('renders only fields for the active tab', () => {
    // Only the title field is in the seo tab
    mockGetFieldsForTab.mockImplementation(
      (_schema: unknown, tab: string | null) =>
        tab === 'seo' ? ['title'] : ['title', 'description'],
    );
    mockFormData.mockReturnValue({ title: '', description: '' });

    const { container } = render(MetadataForm, {
      props: { schema: sampleSchema, tab: 'seo' },
    });

    // Only "title" (string) is rendered for the seo tab
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBe(1);
  });

  //////////////////////////////
  // Container structure
  //////////////////////////////

  it('renders the metadata-form wrapper element', () => {
    mockGetFieldsForTab.mockReturnValue([]);
    mockFormData.mockReturnValue({});

    const { container } = render(MetadataForm, {
      props: { schema: sampleSchema },
    });

    expect(container.querySelector('.metadata-form')).not.toBeNull();
  });

  //////////////////////////////
  // Required field passthrough
  //////////////////////////////

  it('passes required fields down to SchemaField', () => {
    mockGetFieldsForTab.mockReturnValue(['title']);
    mockFormData.mockReturnValue({ title: '' });

    const { container } = render(MetadataForm, {
      props: { schema: sampleSchema },
    });

    // StringField renders a .field-required span (the * marker) for required fields
    // rather than adding the `required` attribute to the input element
    const requiredMarker = container.querySelector('.field-required');
    expect(requiredMarker).not.toBeNull();
  });
});

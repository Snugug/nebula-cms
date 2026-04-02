import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import SchemaField from '../../../../src/client/components/fields/SchemaField.svelte';

/**
 * Tests for the SchemaField component.
 * SchemaField is a dispatch router — it resolves a schema node to the correct
 * leaf field component. Tests verify that the right field type is rendered
 * for each schema kind and that nullable anyOf schemas are unwrapped correctly.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('SchemaField', () => {
  /*
  //////////////////////////////
  // Routing by type
  //////////////////////////////
  */

  it('renders a text input for a string schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'title',
        schema: { type: 'string' },
        value: 'hello',
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="text"]')).not.toBeNull();
  });

  it('renders a number input for a number schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 0,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="number"]')).not.toBeNull();
  });

  it('renders a number input for an integer schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'count',
        schema: { type: 'integer' },
        value: 0,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="number"]')).not.toBeNull();
  });

  it('renders a checkbox for a boolean schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('renders a select for an enum schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'status',
        schema: { type: 'string', enum: ['draft', 'published'] },
        value: 'draft',
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('select')).not.toBeNull();
  });

  it('renders a date input for a date-time string schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="date"]')).not.toBeNull();
  });

  it('renders a fieldset for an object schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'meta',
        schema: {
          type: 'object',
          properties: { note: { type: 'string', title: 'Note' } },
        },
        value: { note: '' },
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('fieldset')).not.toBeNull();
  });

  it('renders an array fieldset for an array schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: { type: 'string' } },
        value: [],
        onchange: vi.fn(),
      },
    });

    // ArrayField renders a <fieldset>
    expect(container.querySelector('fieldset')).not.toBeNull();
  });

  /*
  //////////////////////////////
  // Nullable anyOf unwrapping
  //////////////////////////////
  */

  it('renders a text input for a nullable string anyOf schema', () => {
    const { container } = render(SchemaField, {
      props: {
        name: 'bio',
        schema: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        value: null,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('input[type="text"]')).not.toBeNull();
  });

  it('calls onchange with null when a nullable string field is cleared', async () => {
    const onchange = vi.fn();

    const { container } = render(SchemaField, {
      props: {
        name: 'bio',
        schema: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        value: 'some text',
        onchange,
      },
    });

    const input = container.querySelector('input[type="text"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(null);
  });

  /*
  //////////////////////////////
  // onChange passthrough
  //////////////////////////////
  */

  it('passes onchange calls through for string fields', async () => {
    const onchange = vi.fn();

    const { container } = render(SchemaField, {
      props: {
        name: 'title',
        schema: { type: 'string' },
        value: '',
        onchange,
      },
    });

    const input = container.querySelector('input[type="text"]')!;
    await fireEvent.input(input, { target: { value: 'new title' } });

    expect(onchange).toHaveBeenCalledWith('new title');
  });
});

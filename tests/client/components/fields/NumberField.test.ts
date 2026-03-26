import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import NumberField from '../../../../src/client/components/fields/NumberField.svelte';

/**
 * Tests for the NumberField component.
 * Covers label derivation, input constraints, onChange behavior,
 * nullable empty values, and constraint text rendering.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('NumberField', () => {
  //////////////////////////////
  // Label rendering
  //////////////////////////////

  it('renders a label derived from the name', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 0,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Count')).toBeTruthy();
  });

  it('renders the schema title as label when provided', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', title: 'Item Count' },
        value: 0,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByLabelText('Item Count')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 0,
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field-required')).not.toBeNull();
  });

  //////////////////////////////
  // Input rendering and value
  //////////////////////////////

  it('renders a number input with the provided value', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 42,
        onchange: vi.fn(),
      },
    });

    // Svelte 5 sets value as a DOM property, not an HTML attribute
    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('42');
  });

  it('applies min from schema.minimum', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', minimum: 5 },
        value: 10,
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(Number(input.min)).toBe(5);
  });

  it('applies max from schema.maximum', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', maximum: 100 },
        value: 10,
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(Number(input.max)).toBe(100);
  });

  it('applies step from schema.multipleOf', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', multipleOf: 5 },
        value: 10,
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(Number(input.step)).toBe(5);
  });

  it('renders constraint text in the help paragraph', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', minimum: 0, maximum: 100 },
        value: 10,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('min 0, max 100')).toBeTruthy();
  });

  //////////////////////////////
  // onChange behavior
  //////////////////////////////

  it('calls onchange with a parsed float on input', async () => {
    const onchange = vi.fn();

    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 0,
        onchange,
      },
    });

    const input = container.querySelector('input[type="number"]')!;
    await fireEvent.input(input, { target: { value: '3.14' } });

    expect(onchange).toHaveBeenCalledWith(3.14);
  });

  it('calls onchange with 0 for empty input on non-nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number' },
        value: 5,
        onchange,
      },
    });

    const input = container.querySelector('input[type="number"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(0);
  });

  it('calls onchange with null for empty input on nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', _nullable: true },
        value: 5,
        onchange,
      },
    });

    const input = container.querySelector('input[type="number"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(null);
  });

  //////////////////////////////
  // Deprecated / read-only
  //////////////////////////////

  it('applies the deprecated class when schema.deprecated is true', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', deprecated: true },
        value: 0,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field--deprecated')).not.toBeNull();
  });

  it('renders the input as readonly when schema.readOnly is true', () => {
    const { container } = render(NumberField, {
      props: {
        name: 'count',
        schema: { type: 'number', readOnly: true },
        value: 0,
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});

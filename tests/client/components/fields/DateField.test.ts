import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import DateField from '../../../../src/client/components/fields/DateField.svelte';

/**
 * Tests for the DateField component.
 * Covers label derivation, YYYY-MM-DD value coercion from ISO strings and Date objects,
 * onChange behavior, and nullable handling.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('DateField', () => {
  //////////////////////////////
  // Label rendering
  //////////////////////////////

  it('renders a label derived from the name', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Published At')).toBeTruthy();
  });

  it('renders the schema title as label when provided', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time', title: 'Publish Date' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByLabelText('Publish Date')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '',
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field-required')).not.toBeNull();
  });

  //////////////////////////////
  // Input value coercion
  //////////////////////////////

  it('renders an empty input when value is empty string', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '',
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('');
  });

  it('slices YYYY-MM-DD from an ISO string value', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '2024-03-15T12:00:00Z',
        onchange: vi.fn(),
      },
    });

    // Svelte 5 sets value as a DOM property, not an HTML attribute
    const input = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('2024-03-15');
  });

  it('converts a Date object to YYYY-MM-DD using UTC components', () => {
    // Use a Date at midnight UTC to verify no timezone shift occurs
    const date = new Date('2024-06-01T00:00:00Z');
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: date,
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input.value).toBe('2024-06-01');
  });

  //////////////////////////////
  // onChange behavior
  //////////////////////////////

  it('calls onchange with the raw date string on input', async () => {
    const onchange = vi.fn();
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '',
        onchange,
      },
    });

    const input = container.querySelector('input[type="date"]')!;
    await fireEvent.input(input, { target: { value: '2024-09-20' } });

    expect(onchange).toHaveBeenCalledWith('2024-09-20');
  });

  it('calls onchange with null for empty input on nullable fields', async () => {
    const onchange = vi.fn();
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time', _nullable: true },
        value: '2024-01-01',
        onchange,
      },
    });

    const input = container.querySelector('input[type="date"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(null);
  });

  it('calls onchange with empty string for empty input on non-nullable fields', async () => {
    const onchange = vi.fn();
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time' },
        value: '2024-01-01',
        onchange,
      },
    });

    const input = container.querySelector('input[type="date"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith('');
  });

  //////////////////////////////
  // Deprecated / read-only
  //////////////////////////////

  it('applies the deprecated class when schema.deprecated is true', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time', deprecated: true },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field--deprecated')).not.toBeNull();
  });

  it('renders the input as readonly when schema.readOnly is true', () => {
    const { container } = render(DateField, {
      props: {
        name: 'publishedAt',
        schema: { type: 'string', format: 'date-time', readOnly: true },
        value: '',
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import BooleanField from '../../../../src/client/components/fields/BooleanField.svelte';

/**
 * Tests for the BooleanField component.
 * Covers label derivation, checked state, onChange behavior, nullable handling,
 * and read-only rendering.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('BooleanField', () => {
  //////////////////////////////
  // Label rendering
  //////////////////////////////

  it('renders a label derived from the name', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Is Active')).toBeTruthy();
  });

  it('renders the schema title as label when provided', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean', title: 'Active Status' },
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByLabelText('Active Status')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: false,
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field-required')).not.toBeNull();
  });

  //////////////////////////////
  // Checkbox state
  //////////////////////////////

  it('renders an unchecked checkbox when value is false', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: false,
        onchange: vi.fn(),
      },
    });

    // Svelte 5 sets checked as a DOM property, not an HTML attribute
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it('renders a checked checkbox when value is true', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: true,
        onchange: vi.fn(),
      },
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('renders an unchecked checkbox when value is non-boolean', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: null,
        onchange: vi.fn(),
      },
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  //////////////////////////////
  // onChange behavior
  //////////////////////////////

  it('calls onchange with true when checkbox is checked', async () => {
    const onchange = vi.fn();

    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: false,
        onchange,
      },
    });

    const checkbox = container.querySelector('input[type="checkbox"]')!;
    await fireEvent.change(checkbox, { target: { checked: true } });

    expect(onchange).toHaveBeenCalledWith(true);
  });

  it('calls onchange with false when checkbox is unchecked', async () => {
    const onchange = vi.fn();

    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean' },
        value: true,
        onchange,
      },
    });

    const checkbox = container.querySelector('input[type="checkbox"]')!;
    await fireEvent.change(checkbox, { target: { checked: false } });

    expect(onchange).toHaveBeenCalledWith(false);
  });

  it('renders a description when schema.description is set', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean', description: 'Enables the feature' },
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Enables the feature')).toBeTruthy();
  });

  //////////////////////////////
  // Deprecated / read-only
  //////////////////////////////

  it('applies the deprecated class when schema.deprecated is true', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean', deprecated: true },
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field--deprecated')).not.toBeNull();
  });

  it('disables the checkbox when schema.readOnly is true', () => {
    const { container } = render(BooleanField, {
      props: {
        name: 'isActive',
        schema: { type: 'boolean', readOnly: true },
        value: false,
        onchange: vi.fn(),
      },
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });
});

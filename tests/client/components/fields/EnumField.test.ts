import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import EnumField from '../../../../src/client/components/fields/EnumField.svelte';

/**
 * Tests for the EnumField component.
 * Covers label derivation, options rendering, empty placeholder logic,
 * onChange behavior, nullable handling, and read-only state.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('EnumField', () => {
  const options = ['draft', 'published', 'archived'];

  /*
  //////////////////////////////
  // Label rendering
  //////////////////////////////
  */

  it('renders a label derived from the name', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Status')).toBeTruthy();
  });

  it('renders the schema title as label when provided', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string', title: 'Publication Status' },
        value: 'draft',
        options,
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByLabelText('Publication Status')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field-required')).not.toBeNull();
  });

  /*
  //////////////////////////////
  // Options rendering
  //////////////////////////////
  */

  it('renders all provided options', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        onchange: vi.fn(),
      },
    });

    const select = container.querySelector('select')!;
    const optionValues = Array.from(select.querySelectorAll('option')).map(
      (o) => (o as HTMLOptionElement).value,
    );
    expect(optionValues).toContain('draft');
    expect(optionValues).toContain('published');
    expect(optionValues).toContain('archived');
  });

  it('includes an empty placeholder option when not required', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        required: false,
        onchange: vi.fn(),
      },
    });

    const select = container.querySelector('select')!;
    const optionEls = Array.from(
      select.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    expect(optionEls.some((o) => o.value === '')).toBe(true);
  });

  it('includes an empty placeholder option when value is null even if required', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: null,
        options,
        required: true,
        onchange: vi.fn(),
      },
    });

    const select = container.querySelector('select')!;
    const optionEls = Array.from(
      select.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    expect(optionEls.some((o) => o.value === '')).toBe(true);
  });

  it('omits the empty placeholder option when required and value is set', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        required: true,
        onchange: vi.fn(),
      },
    });

    const select = container.querySelector('select')!;
    const optionEls = Array.from(
      select.querySelectorAll('option'),
    ) as HTMLOptionElement[];
    expect(optionEls.some((o) => o.value === '')).toBe(false);
  });

  /*
  //////////////////////////////
  // onChange behavior
  //////////////////////////////
  */

  it('calls onchange with the selected string value', async () => {
    const onchange = vi.fn();

    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        onchange,
      },
    });

    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: 'published' } });

    expect(onchange).toHaveBeenCalledWith('published');
  });

  it('calls onchange with null when empty option is selected on nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string', _nullable: true },
        value: 'draft',
        options,
        onchange,
      },
    });

    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(null);
  });

  it('calls onchange with empty string when empty option selected on non-nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string' },
        value: 'draft',
        options,
        onchange,
      },
    });

    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith('');
  });

  /*
  //////////////////////////////
  // Deprecated / read-only
  //////////////////////////////
  */

  it('applies the deprecated class when schema.deprecated is true', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string', deprecated: true },
        value: 'draft',
        options,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field--deprecated')).not.toBeNull();
  });

  it('disables the select when schema.readOnly is true', () => {
    const { container } = render(EnumField, {
      props: {
        name: 'status',
        schema: { type: 'string', readOnly: true },
        value: 'draft',
        options,
        onchange: vi.fn(),
      },
    });

    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});

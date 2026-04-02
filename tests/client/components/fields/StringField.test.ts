import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import StringField from '../../../../src/client/components/fields/StringField.svelte';

/**
 * Tests for the StringField component.
 * Covers label derivation, input rendering, textarea mode, onChange behavior,
 * nullable empty values, and schema constraints.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('StringField', () => {
  /*
  //////////////////////////////
  // Label rendering
  //////////////////////////////
  */

  it('renders a label derived from the name when schema has no title', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('My Field')).toBeTruthy();
  });

  it('renders the schema title as label when provided', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', title: 'Custom Title' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByLabelText('Custom Title')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string' },
        value: '',
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field-required')).not.toBeNull();
  });

  /*
  //////////////////////////////
  // Input rendering and value
  //////////////////////////////
  */

  it('renders a text input with the provided value', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string' },
        value: 'hello',
        onchange: vi.fn(),
      },
    });

    // Svelte 5 sets value as a DOM property, not an HTML attribute
    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('hello');
  });

  it('renders a textarea when schema widget is "textarea"', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', widget: 'textarea' },
        value: 'body text',
        onchange: vi.fn(),
      },
    });

    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea!.value).toBe('body text');
  });

  it('sets the maxlength attribute from schema maxLength', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', maxLength: 50 },
        value: '',
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    expect(input.maxLength).toBe(50);
  });

  it('renders the description as help text', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', description: 'Enter a value' },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Enter a value')).toBeTruthy();
  });

  /*
  //////////////////////////////
  // onChange behavior
  //////////////////////////////
  */

  it('calls onchange with the new string value on input', async () => {
    const onchange = vi.fn();

    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string' },
        value: '',
        onchange,
      },
    });

    const input = container.querySelector('input[type="text"]')!;
    await fireEvent.input(input, { target: { value: 'new value' } });

    expect(onchange).toHaveBeenCalledWith('new value');
  });

  it('calls onchange with null for empty input on nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', _nullable: true },
        value: 'existing',
        onchange,
      },
    });

    const input = container.querySelector('input[type="text"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith(null);
  });

  it('calls onchange with empty string for empty input on non-nullable fields', async () => {
    const onchange = vi.fn();

    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string' },
        value: 'existing',
        onchange,
      },
    });

    const input = container.querySelector('input[type="text"]')!;
    await fireEvent.input(input, { target: { value: '' } });

    expect(onchange).toHaveBeenCalledWith('');
  });

  /*
  //////////////////////////////
  // Deprecated / read-only
  //////////////////////////////
  */

  it('applies the deprecated class when schema.deprecated is true', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', deprecated: true },
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.field--deprecated')).not.toBeNull();
  });

  it('renders the input as readonly when schema.readOnly is true', () => {
    const { container } = render(StringField, {
      props: {
        name: 'myField',
        schema: { type: 'string', readOnly: true },
        value: '',
        onchange: vi.fn(),
      },
    });

    const input = container.querySelector(
      'input[type="text"]',
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});

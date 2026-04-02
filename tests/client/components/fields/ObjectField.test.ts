import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import ObjectField from '../../../../src/client/components/fields/ObjectField.svelte';

/**
 * Tests for the ObjectField component.
 * Covers fieldset vs. inline rendering, child field display,
 * and change propagation for individual properties.
 *
 * Child field labels include an aria-hidden required marker (*) which causes
 * getByLabelText exact-text matching to fail. We query inputs via their `id`
 * attribute (which matches the schema property key) instead.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('ObjectField', () => {
  const schema = {
    type: 'object',
    title: 'Address',
    properties: {
      street: { type: 'string', title: 'Street' },
      city: { type: 'string', title: 'City' },
    },
    required: ['street'],
  };

  /*
  //////////////////////////////
  // Fieldset rendering (default)
  //////////////////////////////
  */

  it('renders a fieldset with a legend derived from the schema title', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: { street: '123 Main St', city: 'Springfield' },
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('fieldset.object-field')).not.toBeNull();
    expect(within(container).getByText('Address')).toBeTruthy();
  });

  it('shows a required marker on the legend when required is true', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: {},
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.object-field__required')).not.toBeNull();
  });

  it('renders child fields for each schema property', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: { street: '123 Main St', city: 'Springfield' },
        onchange: vi.fn(),
      },
    });

    // Query by `id` which is set to the property key by SchemaField -> StringField
    expect(container.querySelector('#street')).not.toBeNull();
    expect(container.querySelector('#city')).not.toBeNull();
  });

  it('populates child fields with the corresponding values', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: { street: '123 Main St', city: 'Springfield' },
        onchange: vi.fn(),
      },
    });

    // Svelte 5 sets value as a DOM property, not an HTML attribute
    const streetInput = container.querySelector('#street') as HTMLInputElement;
    const cityInput = container.querySelector('#city') as HTMLInputElement;
    expect(streetInput.value).toBe('123 Main St');
    expect(cityInput.value).toBe('Springfield');
  });

  /*
  //////////////////////////////
  // Inline rendering
  //////////////////////////////
  */

  it('renders without a fieldset when inline is true', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: { street: '1 Road', city: 'Town' },
        onchange: vi.fn(),
        inline: true,
      },
    });

    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.querySelector('.object-field--inline')).not.toBeNull();
  });

  /*
  //////////////////////////////
  // onChange behavior
  //////////////////////////////
  */

  it('calls onchange with the full updated object when a child field changes', async () => {
    const onchange = vi.fn();

    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: { street: '123 Main St', city: 'Springfield' },
        onchange,
      },
    });

    const streetInput = container.querySelector('#street')!;
    await fireEvent.input(streetInput, { target: { value: '456 Oak Ave' } });

    expect(onchange).toHaveBeenCalledWith({
      street: '456 Oak Ave',
      city: 'Springfield',
    });
  });

  it('defaults to an empty object when value is null', () => {
    const { container } = render(ObjectField, {
      props: {
        name: 'address',
        schema,
        value: null,
        onchange: vi.fn(),
      },
    });

    // Inputs should render with empty values when value defaults to {}
    const streetInput = container.querySelector('#street') as HTMLInputElement;
    expect(streetInput.value).toBe('');
  });
});

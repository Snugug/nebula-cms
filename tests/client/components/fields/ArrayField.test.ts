import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, within, fireEvent } from '@testing-library/svelte';
import ArrayField from '../../../../src/client/components/fields/ArrayField.svelte';

/**
 * Tests for the ArrayField component.
 * Covers label rendering, empty-state display, add/remove item behavior,
 * maxItems/minItems constraints, and item value update propagation.
 */

// Prevent accumulated renders from bleeding between tests
afterEach(() => cleanup());

describe('ArrayField', () => {
  const stringItemSchema = { type: 'string' };

  //////////////////////////////
  // Label rendering
  //////////////////////////////

  it('renders a legend derived from the name', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: [],
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Tags')).toBeTruthy();
  });

  it('renders the schema title as legend when provided', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: {
          type: 'array',
          title: 'Article Tags',
          items: stringItemSchema,
        },
        value: [],
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('Article Tags')).toBeTruthy();
  });

  it('shows a required marker when required is true', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: [],
        required: true,
        onchange: vi.fn(),
      },
    });

    expect(container.querySelector('.array-field__required')).not.toBeNull();
  });

  //////////////////////////////
  // Empty state
  //////////////////////////////

  it('renders "No items" when the array is empty', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: [],
        onchange: vi.fn(),
      },
    });

    expect(within(container).getByText('No items')).toBeTruthy();
  });

  it('does not render "No items" when the array has items', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: ['hello'],
        onchange: vi.fn(),
      },
    });

    expect(within(container).queryByText('No items')).toBeNull();
  });

  //////////////////////////////
  // Add item
  //////////////////////////////

  it('renders an "Add item" button', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: [],
        onchange: vi.fn(),
      },
    });

    expect(
      within(container).getByRole('button', { name: /Add item/i }),
    ).toBeTruthy();
  });

  it('calls onchange with a new item appended when Add item is clicked', async () => {
    const onchange = vi.fn();

    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: ['first'],
        onchange,
      },
    });

    await fireEvent.click(
      within(container).getByRole('button', { name: /Add item/i }),
    );

    // createDefaultValue for string schema returns ''
    expect(onchange).toHaveBeenCalledWith(['first', '']);
  });

  it('disables the Add item button when maxItems is reached', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema, maxItems: 2 },
        value: ['a', 'b'],
        onchange: vi.fn(),
      },
    });

    const addBtn = within(container).getByRole('button', {
      name: /Add item/i,
    }) as HTMLButtonElement;
    expect(addBtn.disabled).toBe(true);
  });

  //////////////////////////////
  // Remove item
  //////////////////////////////

  it('calls onchange without the removed item when Remove is clicked', async () => {
    const onchange = vi.fn();

    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema },
        value: ['one', 'two'],
        onchange,
      },
    });

    const removeBtns = within(container).getAllByRole('button', {
      name: /Remove item/i,
    });
    await fireEvent.click(removeBtns[0]);

    expect(onchange).toHaveBeenCalledWith(['two']);
  });

  it('disables the Remove item button when minItems is reached', () => {
    const { container } = render(ArrayField, {
      props: {
        name: 'tags',
        schema: { type: 'array', items: stringItemSchema, minItems: 1 },
        value: ['only'],
        onchange: vi.fn(),
      },
    });

    const removeBtn = within(container).getByRole('button', {
      name: /Remove item/i,
    }) as HTMLButtonElement;
    expect(removeBtn.disabled).toBe(true);
  });
});

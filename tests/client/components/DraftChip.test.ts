import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import DraftChip from '../../../src/client/components/DraftChip.svelte';

/**
 * Tests for the DraftChip component.
 * Verifies that the correct text and CSS modifier classes are applied for each variant.
 */

// Explicit cleanup after each test prevents accumulated renders from bleeding
// into subsequent assertions when using container-scoped queries.
afterEach(() => cleanup());

describe('DraftChip', () => {
  /*
  //////////////////////////////
  // draft variant
  //////////////////////////////
  */

  it('renders "draft" text with chip--draft class when variant is draft', () => {
    const { container } = render(DraftChip, { props: { variant: 'draft' } });
    const chip = container.querySelector('.chip');

    expect(chip).not.toBeNull();
    expect(chip!.textContent?.trim()).toBe('draft');
    expect(chip!.classList.contains('chip--draft')).toBe(true);
    expect(chip!.classList.contains('chip--outdated')).toBe(false);
  });

  /*
  //////////////////////////////
  // outdated variant
  //////////////////////////////
  */

  it('renders "outdated" text with chip--outdated class when variant is outdated', () => {
    const { container } = render(DraftChip, { props: { variant: 'outdated' } });
    const chip = container.querySelector('.chip');

    expect(chip).not.toBeNull();
    expect(chip!.textContent?.trim()).toBe('outdated');
    expect(chip!.classList.contains('chip--outdated')).toBe(true);
    expect(chip!.classList.contains('chip--draft')).toBe(false);
  });

  it('renders a span element', () => {
    const { container } = render(DraftChip, { props: { variant: 'draft' } });
    const chip = container.querySelector('span.chip');

    expect(chip).not.toBeNull();
  });
});

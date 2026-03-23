import { describe, it, expect } from 'vitest';
import nebulaCMS from '../../src/astro/index.js';

describe('nebulaCMS integration', () => {
  it('returns an integration object with the correct name', () => {
    const integration = nebulaCMS();
    expect(integration.name).toBe('nebula-cms');
  });

  it('returns an integration object with a hooks property', () => {
    const integration = nebulaCMS();
    expect(integration.hooks).toBeDefined();
    expect(typeof integration.hooks).toBe('object');
  });

  it('accepts an empty config', () => {
    const integration = nebulaCMS({});
    expect(integration.name).toBe('nebula-cms');
  });
});

import type { AstroIntegration } from 'astro';
import type { NebulaCMSConfig } from '../types.js';

/**
 * Creates the nebula-cms Astro integration.
 * Registers the CMS with an Astro project via the integration API.
 *
 * @param {NebulaCMSConfig} _config - CMS configuration options
 * @return {AstroIntegration} The Astro integration object
 */
export default function nebulaCMS(
  _config: NebulaCMSConfig = {},
): AstroIntegration {
  return {
    name: 'nebula-cms',
    hooks: {},
  };
}

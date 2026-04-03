import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import nebulaCMS from 'nebula-cms';

export default defineConfig({
  integrations: [svelte(), nebulaCMS({ basePath: '/nebula' })],
});

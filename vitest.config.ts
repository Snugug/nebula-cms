import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    // Inline project definitions replace the separate vitest.workspace.ts file.
    // This keeps the config co-located with package.json so Vite's config
    // search stops here rather than walking up to the parent repo root.
    projects: [
      //////////////////////////////
      // Unit tests — Node.js environment
      //////////////////////////////
      {
        plugins: [svelte()],
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts', '!tests/e2e/**'],
          setupFiles: ['tests/setup.ts'],
          coverage: {
            provider: 'v8',
            reportsDirectory: '.coverage',
          },
        },
      },

      //////////////////////////////
      // Browser tests — Playwright via system Chrome
      //////////////////////////////
      {
        plugins: [svelte()],
        test: {
          name: 'browser',
          include: ['tests/e2e/**/*.test.ts'],
          browser: {
            enabled: true,
            // Uses system Chrome via the 'chrome' channel to avoid downloading
            // a separate Chromium binary. CI adds --no-sandbox because most CI
            // containers lack the kernel namespace support sandboxing requires.
            provider: playwright({
              launchOptions: {
                channel: 'chrome',
                ...(process.env.CI
                  ? { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
                  : {}),
              },
            }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});

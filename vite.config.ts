import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Same headers as public/_headers (Cloudflare Pages): needed for SharedArrayBuffer (Stockfish WASM).
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  // styleguide.html ships unlinked (noindex) so axe runs on it in CI and it can be reviewed on PR previews.
  // engine-check.html is the same kind of unlinked page: e2e runs the real engine there.
  build: { rolldownOptions: { input: ['index.html', 'styleguide.html', 'engine-check.html'] } },
  test: {
    environment: 'jsdom',
    testTimeout: 15_000, // with many files running in parallel, the CPU can starve jsdom
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    coverage: {
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts'],
      thresholds: { branches: 90, perFile: true },
    },
  },
});

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
  build: { rolldownOptions: { input: ['index.html', 'styleguide.html'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});

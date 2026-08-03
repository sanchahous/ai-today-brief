import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Standalone Vite config so the mock prototype can be viewed locally on its
 * own — isolated from the multi-entry portfolio build. Mock data, no backend,
 * so it runs anywhere.
 *
 *   npm run prototype          # dev server (HMR), auto-opens
 *   npm run prototype:build    # static build → prototypes/dist (gitignored)
 *   npm run prototype:preview  # serve the static build
 *
 * `base: './'` keeps every asset path relative, so the static build also works
 * when opened from any sub-folder.
 */
const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { port: 5180, open: true },
  preview: { port: 5180, open: true },
});

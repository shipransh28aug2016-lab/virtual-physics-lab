import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * The portable target is one self-contained HTML file that must run from
 * `file://`, where a lazily-imported chunk can never be fetched. That build
 * therefore inlines the whole module graph; the web build keeps the
 * per-experiment code-splitting.
 */
const PORTABLE = process.env.VPL_PORTABLE === '1';

export default defineConfig({
  plugins: [react()],
  // The HTML template lives in app/ so that the repo root can hold the shipped,
  // self-contained index.html — the file a student opens straight off disk.
  root: 'app',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    // src/ sits above the Vite root, so the dev server has to be allowed to read it.
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] }
  },
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    reportCompressedSize: false,
    emptyOutDir: true,
    outDir: PORTABLE ? '../dist-portable' : '../dist',
    ...(PORTABLE
      ? {
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          rollupOptions: { output: { inlineDynamicImports: true } }
        }
      : {})
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Tests live beside the source, above the Vite root.
    root: fileURLToPath(new URL('.', import.meta.url)),
    setupFiles: ['./src/test/setup.ts'],
    css: false
  }
});

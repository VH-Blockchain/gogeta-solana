import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Force the npm `buffer` package rather than the Node builtin, which has
      // no browser implementation. The trailing slash is what makes Vite
      // resolve the package instead of treating it as an external builtin.
      buffer: 'buffer/',
    },
  },
  // The Solana libraries reference `global`, a Node-only alias for the global
  // object. Mapping it to `globalThis` is the browser equivalent.
  define: { global: 'globalThis' },
  optimizeDeps: {
    // esbuild pre-bundles dependencies before the app's own modules run, so the
    // same substitution has to be declared for that pass too — otherwise the
    // pre-bundled Solana chunks still carry a bare `global`.
    esbuildOptions: { define: { global: 'globalThis' } },
  },
  server: { port: 5173, host: true },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1400 },
});

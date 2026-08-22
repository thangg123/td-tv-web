import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// `@types/node` is not a dependency of this project, so `node:url` cannot be
// imported here. `import.meta.url` (typed by vite/client) plus the DOM `URL`
// gives the same absolute directory without pulling in Node typings.
const srcDir = decodeURIComponent(new URL('./src', import.meta.url).pathname);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  build: {
    // Sourcemaps are dead weight on a personal deploy; drop them from the CDN.
    sourcemap: false,
    // hls.js is loaded with a dynamic import from the watch page only, so the
    // bundler already keeps it out of the entry chunk. The manual split below
    // just stops React + Router + Query — which every route needs — from being
    // re-parsed alongside page code on each lazy route.
    //
    // Vite 8 bundles with Rolldown, where `output.manualChunks` only accepts a
    // function and the object form was dropped; `codeSplitting.groups` is the
    // supported replacement.
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@tanstack[\\/]react-query|@tanstack[\\/]query-core)[\\/]/,
            },
          ],
        },
      },
    },
  },
});

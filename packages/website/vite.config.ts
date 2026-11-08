import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const websiteRoot = import.meta.dirname;

export default defineConfig({
  root: websiteRoot,
  // GitHub Pages serves the site at https://danilqa.github.io/kombinat/.
  base: '/kombinat/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // web-app imports its own files through this alias.
      '@web-app': path.join(websiteRoot, '..', 'web-app', 'src'),
    },
  },
  build: {
    outDir: path.join(websiteRoot, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5174,
  },
});

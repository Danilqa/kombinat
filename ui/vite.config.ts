import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const uiRoot = import.meta.dirname;

export default defineConfig({
  root: uiRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(uiRoot, 'src'),
      '@shared': path.join(uiRoot, '..', 'packages', 'cli', 'src', 'shared'),
    },
  },
  build: {
    outDir: path.join(uiRoot, '..', 'packages', 'cli', 'dist', 'web-app'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:7433',
    },
  },
});

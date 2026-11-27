import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const webAppRoot = import.meta.dirname;
// `kombinat dev` starts Vite with its own environment, so the proxy follows the daemon's port.
const daemonPort = process.env['KOMBINAT_PORT'] ?? '7433';

export default defineConfig({
  root: webAppRoot,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@web-app': path.join(webAppRoot, 'src'),
    },
  },
  build: {
    outDir: path.join(webAppRoot, '..', 'cli', 'dist', 'web-app'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${daemonPort}`,
    },
  },
});

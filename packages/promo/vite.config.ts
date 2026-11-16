import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const promoRoot = import.meta.dirname;

export default defineConfig({
  root: promoRoot,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.join(promoRoot, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5175,
  },
});

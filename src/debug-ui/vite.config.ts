import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api':   { target: 'http://localhost:3000', changeOrigin: true },
      '/__ws':  { target: 'ws://localhost:3000', ws: true },
      '/app':   { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/debug-ui'),
    emptyOutDir: true,
  },
});

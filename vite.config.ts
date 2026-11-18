import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        advancedChunks: {
          groups: [
            { name: 'vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'dnd', test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/ },
            { name: 'charts', test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5531,
    strictPort: true,
    host: true,
  },
  preview: {
    port: 5531,
    strictPort: true,
    host: true,
  },
});
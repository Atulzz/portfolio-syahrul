import { defineConfig } from 'vite';

export default defineConfig({
  base: '/portfolio-syahrul/', // Konfigurasi base path untuk GitHub Pages
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Menghilangkan warning chunk size untuk Three.js
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static online build (GitHub Pages / Netlify / any static host): no server needed.
// The engine runs in the page; prices stream live from public market data to the visitor's browser.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { 'import.meta.env.VITE_STANDALONE': '"1"', 'import.meta.env.VITE_LIVE': '"1"' },
  build: { outDir: '../../docs', emptyOutDir: true },
});

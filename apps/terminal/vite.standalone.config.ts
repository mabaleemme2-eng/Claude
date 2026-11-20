import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Browser-only demo build: one IIFE script + one stylesheet (no server, no code splitting).
export default defineConfig({
  plugins: [react()],
  define: { 'import.meta.env.VITE_STANDALONE': '"1"' },
  build: {
    outDir: 'dist-demo', emptyOutDir: true, cssCodeSplit: false, target: 'es2020',
    rollupOptions: {
      input: 'src/main.tsx',
      output: { format: 'iife', inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});

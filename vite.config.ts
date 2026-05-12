import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  // React (and many deps) reference process.env.NODE_ENV at runtime to pick
  // between dev and prod code paths. In Vite library mode this is NOT
  // replaced by default, so it leaks into the bundle and crashes in the
  // browser with "process is not defined". `define` statically substitutes
  // the reference with a string literal at build time.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: local('./netlify'),
  publicDir: local('./public'),
  resolve: {
    alias: {
      'next/link': local('./netlify/link.tsx'),
      'next/navigation': local('./netlify/navigation.ts'),
      'next/dynamic': local('./netlify/dynamic.tsx'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.F1_ENABLE_DEV': JSON.stringify('0'),
  },
  esbuild: { jsx: 'automatic' },
  css: { postcss: local('./') },
  build: { outDir: local('./dist-netlify'), emptyOutDir: true },
  preview: { port: 3031, strictPort: true },
});

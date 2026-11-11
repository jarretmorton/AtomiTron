import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // app/ is the web app (spec 10.2); data/ sits beside it at the repo root.
  root: 'app',
  // Relative asset paths, like Rock ID: works at /AtomiTron/ on Pages and locally.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { outDir: '../dist', emptyOutDir: true },
  // Lets app code import ../data/verified/*.json from outside the Vite root.
  server: { fs: { allow: ['..'] } },
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { isRenderable } from './app/src/data/facts.ts';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const ELEMENTS_DIR = join(import.meta.dirname, 'data', 'verified', 'elements');

/**
 * `virtual:element-index`: a small index of every verified element (number,
 * symbol, name, table position, classification) for the periodic table, so
 * the table doesn't have to load all 1.7 MB of element data. Only values from
 * facts that pass isRenderable() go in. Each element page loads its own file
 * and shows the citations.
 */
function elementIndex(): Plugin {
  const id = 'virtual:element-index';
  const resolved = `\0${id}`;
  return {
    name: 'atomitron-element-index',
    resolveId: (source) => (source === id ? resolved : undefined),
    load(source) {
      if (source !== resolved) return;
      const value = (fact: unknown) => (isRenderable(fact) ? fact.value : undefined);
      const rows = readdirSync(ELEMENTS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((file) => {
          this.addWatchFile(join(ELEMENTS_DIR, file));
          const e = JSON.parse(readFileSync(join(ELEMENTS_DIR, file), 'utf8')).items[0];
          return {
            file,
            z: value(e.atomicNumber),
            symbol: value(e.symbol),
            name: value(e.name),
            period: value(e.period),
            group: e.group ? (value(e.group) ?? null) : null,
            classification: isRenderable(e.classification) ? e.classification.value : null,
            predicted: isRenderable(e.classification) ? e.classification.uncertain : e.atomicNumber?.value >= 100,
          };
        })
        .filter((r) => typeof r.z === 'number' && r.symbol && r.name && r.period)
        .sort((a, b) => (a.z as number) - (b.z as number));
      return `export default ${JSON.stringify(rows)};`;
    },
  };
}

export default defineConfig({
  // app/ is the web app (spec 10.2); data/ sits beside it at the repo root.
  root: 'app',
  // Relative asset paths, like Rock ID: works at /AtomiTron/ on Pages and locally.
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [elementIndex()],
  build: { outDir: '../dist', emptyOutDir: true },
  // Lets app code import ../data/verified/*.json from outside the Vite root.
  server: { fs: { allow: ['..'] } },
});

// The bond visuals in Combine mode: before and after, the energy hill, 3D
// models of molecules, the salt crystal, PubChem's drawings and photos.
// Everything here is a verified fact with its citation, something drawn from
// verified facts, a cited computed model, or a credited image.

import { CONCEPTS } from '../content/concepts';
import { PHOTOS } from '../content/media';
import { isRange, isRenderable } from '../data/facts';
import type { Compound, Range, Reaction } from '../data/schema';
import { citation, conceptNote, el } from './fact';
import { num } from './format';
import { startModel3d, type Ball, type Stick, type Vec } from './model3d';

const MEDIA = `${import.meta.env.BASE_URL}media/`;

export interface Model {
  cid: number;
  source: { url: string; retrieved: string; via: string };
  note: string;
  '3d': { atoms: { symbol: string; x: number; y: number; z: number }[]; bonds: { a: number; b: number; order: number }[] };
}

const modelFiles = import.meta.glob<Model>('../../../data/models/*.json', { import: 'default' });

export function hasModel(c: Compound): boolean {
  return `../../../data/models/cid-${cidOf(c)}.json` in modelFiles;
}

const cidOf = (c: Compound) => Number(c.id.split('-').pop());

/** Element colors (color-blind safe); every ball also shows its symbol. */
const COLOR: Record<string, string> = {
  H: 'var(--el-h)', C: 'var(--el-c)', N: 'var(--el-n)', O: 'var(--el-o)',
  Na: 'var(--el-na)', Cl: 'var(--el-cl)', S: 'var(--el-s)', Br: 'var(--el-br)',
};

/** "Ca(OH)2" with its counts as subscripts, as one inline element. */
export function formulaNode(formula: string): HTMLElement {
  const span = el('span', 'formula');
  for (const part of formula.split(/(\d+)/)) {
    if (!part) continue;
    if (/^\d+$/.test(part)) span.append(el('sub', undefined, part));
    else span.append(part);
  }
  return span;
}

function group(...children: (Node | null)[]): HTMLElement {
  const d = el('div');
  d.append(...children.filter((c): c is Node => c !== null));
  return d;
}

// ---- Photos ----------------------------------------------------------------------------

export function photosFor(r: Reaction): HTMLElement | null {
  const id = r.id.slice('reaction:'.length);
  const list = PHOTOS.filter((p) => p.reactions.includes(id));
  if (!list.length) return null;
  const box = el('div', 'photos');
  for (const p of list) {
    const fig = el('figure', 'photo');
    const img = el('img');
    img.src = MEDIA + p.file;
    img.alt = p.alt;
    img.loading = 'lazy';
    const cap = el('figcaption');
    cap.append(p.credit, ' ', citation(p.sourceUrl));
    fig.append(img, cap);
    box.append(fig);
  }
  return box;
}

// ---- Before and after ---------------------------------------------------------------------

function substanceCard(c: Compound | undefined, role: string): HTMLElement {
  const d = el('div', 'ba-card');
  if (!c) return d;
  const h = el('h4', undefined);
  h.append(el('span', 'note', `${role} `), formulaNode(isRenderable(c.formula) ? c.formula.value : '?'), ` ${isRenderable(c.name) ? c.name.value : ''}`);
  d.append(h);
  const looks = c.appearance && isRenderable(c.appearance) ? c.appearance : null;
  if (looks) {
    const p = el('p', 'statement');
    p.append(looks.value, ' ', citation(looks.source.url, looks.source.via));
    d.append(p);
  } else {
    d.append(el('p', 'note', 'Not described yet.'));
  }
  return d;
}

/** What goes in and what comes out, from the verified descriptions. */
export function beforeAfter(r: Reaction, compounds: Map<string, Compound>): HTMLElement | null {
  if (!r.reactants?.length || !r.products?.length) return null;
  const row = el('div', 'ba-row');
  r.reactants.forEach((s, i) => {
    if (i) row.append(el('span', 'ba-plus', '+'));
    row.append(substanceCard(compounds.get(s.substance), i ? 'and' : 'Start with'));
  });
  row.append(el('span', 'ba-arrow', '→'));
  r.products.forEach((s, i) => {
    if (i) row.append(el('span', 'ba-plus', '+'));
    row.append(substanceCard(compounds.get(s.substance), i ? 'and' : 'Get'));
  });
  return row;
}

// ---- Energy hill ----------------------------------------------------------------------------

const largest = (v: number | Range) => (isRange(v) ? Math.max(Math.abs(v.min), Math.abs(v.max)) : Math.abs(v));

/** The largest reaction energy in the set, so every hill shares one scale. */
export function energyScale(reactions: Reaction[]): number {
  return Math.max(1, ...reactions.map((r) => r.energy?.enthalpy).filter((h) => h && isRenderable(h)).map((h) => largest(h!.value as number | Range)));
}

export function energyHill(r: Reaction, scale: number): HTMLElement | null {
  const h = r.energy?.enthalpy;
  if (!h || !isRenderable(h)) return null;
  const v = h.value as number | Range;
  const sign = isRange(v) ? Math.sign(v.max) : Math.sign(v);
  const size = Math.max(8, (largest(v) / scale) * 170); // tiny energies still show a step
  const mid = 100;
  // Screen y grows downward: a negative change ends lower than it starts.
  const y0 = mid + (sign * size) / 2;
  const y1 = mid - (sign * size) / 2;
  const label = isRange(v) ? `${num(v.min)} to ${num(v.max)} kJ` : `${v > 0 ? '+' : ''}${num(v)} kJ`;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 300 200');
  s.setAttribute('class', 'hill');
  s.setAttribute('role', 'img');
  s.setAttribute('aria-label', `Energy ${sign < 0 ? 'goes down: it is given out' : 'goes up: it is taken in'}, ${label}`);
  s.innerHTML = `
    <defs><marker id="hill-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="hill-head"/></marker></defs>
    <line x1="20" y1="${y0}" x2="110" y2="${y0}" class="hill-level"/>
    <line x1="170" y1="${y1}" x2="260" y2="${y1}" class="hill-level"/>
    <line x1="140" y1="${y0}" x2="140" y2="${y1}" class="hill-arrow" marker-end="url(#hill-head)"/>
    <text x="65" y="${y0 - 8}" class="hill-label">start</text>
    <text x="215" y="${y1 - 8}" class="hill-label">end</text>
`;
  const fig = el('figure', 'hill-fig');
  const cap = el('figcaption');
  cap.append(el('strong', undefined, label), ` Energy ${sign < 0 ? 'goes down, so it is given out' : 'goes up, so it is taken in'}. All the hills in AtomiTron share one scale, so they can be compared.`);
  fig.append(s, cap);
  return fig;
}

// ---- 3D models -----------------------------------------------------------------------------

/** A turnable 3D model of a molecule, from PubChem's computed conformer. */
export function molecule3d(c: Compound): HTMLElement | null {
  const load = modelFiles[`../../../data/models/cid-${cidOf(c)}.json`];
  if (!load) return null;
  const fig = el('figure', 'model-fig');
  const canvas = el('canvas', 'model3d');
  canvas.setAttribute('role', 'img');
  const cap = el('figcaption');
  fig.append(canvas, cap);
  load().then((m) => {
    const name = isRenderable(c.name) ? c.name.value : '';
    canvas.setAttribute('aria-label', `A 3D model of ${name} you can turn`);
    const balls: Ball[] = m['3d'].atoms.map((a) => ({ label: a.symbol, pos: [a.x, a.y, a.z] as Vec, color: COLOR[a.symbol] ?? 'var(--el-c)', r: a.symbol === 'H' ? 0.2 : 0.3 }));
    const sticks: Stick[] = m['3d'].bonds.map((b) => ({ a: b.a, b: b.b, order: b.order }));
    startModel3d(canvas, balls, sticks);
    cap.append(`${m.note} Ball sizes are not to scale. Drag to turn it. `, citation(m.source.url, 'computed 3D conformer'));
  });
  return fig;
}

/** Salts whose crystal arrangement has a verified statement. */
const CRYSTALS: Record<number, { a: string; b: string; concept: keyof typeof CONCEPTS }> = {
  5234: { a: 'Na', b: 'Cl', concept: 'saltLattice' },
};

export function crystal3d(c: Compound): HTMLElement | null {
  const x = CRYSTALS[cidOf(c)];
  if (!x) return null;
  const balls: Ball[] = [];
  const index = new Map<string, number>();
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const first = (((i + j + k) % 2) + 2) % 2 === 0;
        index.set(`${i},${j},${k}`, balls.length);
        balls.push({ label: first ? x.a : x.b, pos: [i, j, k], color: COLOR[first ? x.a : x.b]!, r: 0.3 });
      }
  const sticks: Stick[] = [];
  for (const [key, a] of index) {
    const [i, j, k] = key.split(',').map(Number) as [number, number, number];
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
      const b = index.get(`${i + di},${j + dj},${k + dk}`);
      if (b !== undefined) sticks.push({ a, b, order: 0 });
    }
  }
  const fig = el('figure', 'model-fig');
  const canvas = el('canvas', 'model3d');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'A small block of the crystal you can turn');
  startModel3d(canvas, balls, sticks);
  fig.append(canvas, el('figcaption', undefined, 'Drawn from the statement below: a small block of the repeating pattern, each ion joined to its neighbors by faint lines. Ion sizes are not to scale. Drag to turn it.'));
  return group(fig, conceptNote(CONCEPTS[x.concept]));
}

/** PubChem's own 2D drawing of a compound. */
export function pubchemDrawing(c: Compound): HTMLElement {
  const fig = el('figure', 'drawing');
  const img = el('img');
  img.src = `${MEDIA}pubchem-cid-${cidOf(c)}.png`;
  img.alt = `PubChem’s structure drawing of ${isRenderable(c.name) ? c.name.value : 'this compound'}`;
  img.loading = 'lazy';
  const cap = el('figcaption');
  cap.append('Structure drawing ', citation(`https://pubchem.ncbi.nlm.nih.gov/compound/${cidOf(c)}#section=2D-Structure`));
  fig.append(img, cap);
  return fig;
}

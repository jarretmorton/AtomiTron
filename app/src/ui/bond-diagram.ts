// The animated bond diagram (spec 3.3, layers 1 and 2): electrons moving from
// metal atoms to non-metal atoms (ionic), or hydrogen atoms sharing electrons
// with one atom (covalent). Everything drawn comes from verified data: the
// product's formula, each atom's electron shells and valence electrons, and
// the verified bond type. planBond() checks they fit together (electrons
// given equal electrons taken; each shared pair completes an outer shell)
// and returns null otherwise, so no diagram is better than a wrong one.

import type { Composition } from '../data/chemistry';

export interface AtomInfo {
  symbol: string;
  /** Electrons per shell, innermost first (verified). */
  shells: number[];
  /** Valence electrons (verified, main-group elements only). */
  valence: number;
  metal: boolean;
}

export interface PlannedAtom {
  symbol: string;
  shells: number[];
}

export type BondPlan =
  | {
      kind: 'ionic';
      atoms: PlannedAtom[];
      /** One entry per electron that moves: from a metal atom to a non-metal atom (indexes into atoms). */
      transfers: { from: number; to: number }[];
    }
  | { kind: 'covalent'; center: PlannedAtom; hydrogens: number; lonePairs: number };

const MAX_ATOMS = 6;

/** How the bond forms, or null if the verified data doesn't fit a simple picture. */
export function planBond(type: string, formula: Composition, info: (symbol: string) => AtomInfo | undefined): BondPlan | null {
  const parts = Object.entries(formula);
  if (parts.length !== 2) return null;
  const atoms = parts.map(([s, n]) => ({ info: info(s), count: n }));
  if (atoms.some((a) => !a.info || a.info.shells.at(-1) !== a.info.valence)) return null;

  if (type === 'ionic') {
    const metal = atoms.find((a) => a.info!.metal);
    const non = atoms.find((a) => !a.info!.metal);
    if (!metal || !non) return null;
    const give = metal.info!.valence;
    const take = 8 - non.info!.valence;
    if (give < 1 || give > 3 || take < 1 || take > 3) return null;
    // Electrons given must equal electrons taken, for the formula as written.
    if (metal.count * give !== non.count * take || metal.count + non.count > MAX_ATOMS) return null;
    const planned: PlannedAtom[] = [
      ...Array.from({ length: metal.count }, () => ({ symbol: metal.info!.symbol, shells: metal.info!.shells })),
      ...Array.from({ length: non.count }, () => ({ symbol: non.info!.symbol, shells: non.info!.shells })),
    ];
    const need = Array.from({ length: non.count }, () => take);
    const transfers: { from: number; to: number }[] = [];
    for (let m = 0; m < metal.count; m++) {
      for (let k = 0; k < give; k++) {
        const j = need.findIndex((x) => x > 0);
        need[j]!--;
        transfers.push({ from: m, to: metal.count + j });
      }
    }
    return { kind: 'ionic', atoms: planned, transfers };
  }

  if (type === 'covalent') {
    const h = atoms.find((a) => a.info!.symbol === 'H');
    const x = atoms.find((a) => a.info!.symbol !== 'H');
    if (!h || !x || x.count !== 1 || x.info!.metal || h.info!.valence !== 1) return null;
    const v = x.info!.valence;
    // Each hydrogen shares one pair, completing the other atom's outer shell of eight.
    if (h.count !== 8 - v || (v - h.count) % 2 !== 0 || v < 4) return null;
    return { kind: 'covalent', center: { symbol: x.info!.symbol, shells: x.info!.shells }, hydrogens: h.count, lonePairs: (v - h.count) / 2 };
  }
  return null;
}

// ---- Drawing --------------------------------------------------------------------------

const NS = 'http://www.w3.org/2000/svg';
const NUCLEUS = 11;
const FIRST = 19;
const STEP = 11;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const radiusOf = (shell: number) => FIRST + shell * STEP;
const at = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

/** Nucleus, shells and the inner electrons of one atom; the outer electrons are drawn by the caller. */
function atomBase(a: PlannedAtom, cx: number, cy: number, fadeOuter = false): SVGGElement {
  const g = svg('g', { class: 'bd-atom' });
  a.shells.forEach((count, i) => {
    const r = radiusOf(i);
    const outer = i === a.shells.length - 1;
    g.append(svg('circle', { cx, cy, r, class: `shell${outer && fadeOuter ? ' bd-emptied' : ''}` }));
    if (outer) return;
    for (let k = 0; k < count; k++) {
      const p = at(cx, cy, r, -90 + (360 * k) / count);
      g.append(svg('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 3.2, class: 'electron' }));
    }
  });
  g.append(svg('circle', { cx, cy, r: NUCLEUS, class: 'bd-nucleus' }));
  const t = svg('text', { x: cx, y: cy + 4, class: 'bd-symbol' });
  t.textContent = a.symbol;
  g.append(t);
  return g;
}

function electron(x: number, y: number, moving?: { dx: number; dy: number }): SVGCircleElement {
  const c = svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.6, class: moving ? 'electron bd-moving' : 'electron' });
  if (moving) {
    c.style.setProperty('--dx', `${moving.dx.toFixed(1)}px`);
    c.style.setProperty('--dy', `${moving.dy.toFixed(1)}px`);
  }
  return c;
}

function ionic(plan: Extract<BondPlan, { kind: 'ionic' }>): SVGSVGElement {
  const outerR = Math.max(...plan.atoms.map((a) => radiusOf(a.shells.length - 1)));
  const cell = outerR * 2 + 26;
  const width = cell * plan.atoms.length;
  const height = outerR * 2 + 24;
  const root = svg('svg', { viewBox: `0 0 ${width.toFixed(0)} ${height.toFixed(0)}`, class: 'bond-diagram' });
  const centers = plan.atoms.map((_, i) => ({ x: cell * i + cell / 2, y: height / 2 }));
  const givers = new Set(plan.transfers.map((t) => t.from));
  plan.atoms.forEach((a, i) => root.append(atomBase(a, centers[i]!.x, centers[i]!.y, givers.has(i))));

  // Outer electrons: a non-metal's eight places, the first ones already filled.
  const slots = (i: number) => {
    const n = plan.atoms[i]!.shells.at(-1)!;
    return { r: radiusOf(plan.atoms[i]!.shells.length - 1), have: n };
  };
  const filled = plan.atoms.map((_, i) => slots(i).have);
  const layer = svg('g', { class: 'bd-electrons' });
  plan.atoms.forEach((_, i) => {
    if (givers.has(i)) return;
    const { r, have } = slots(i);
    for (let k = 0; k < have; k++) {
      const p = at(centers[i]!.x, centers[i]!.y, r, -90 + 45 * k);
      layer.append(electron(p.x, p.y));
    }
  });
  const given = new Map<number, number>();
  for (const t of plan.transfers) {
    const k = given.get(t.from) ?? 0;
    given.set(t.from, k + 1);
    const from = slots(t.from);
    const count = plan.atoms[t.from]!.shells.at(-1)!;
    const start = at(centers[t.from]!.x, centers[t.from]!.y, from.r, -90 + (360 * k) / count);
    const to = slots(t.to);
    const end = at(centers[t.to]!.x, centers[t.to]!.y, to.r, -90 + 45 * filled[t.to]!);
    filled[t.to]!++;
    layer.append(electron(start.x, start.y, { dx: end.x - start.x, dy: end.y - start.y }));
  }
  root.append(layer);
  return root;
}

function covalent(plan: Extract<BondPlan, { kind: 'covalent' }>): SVGSVGElement {
  const R = radiusOf(plan.center.shells.length - 1);
  const rh = radiusOf(0);
  const near = R + rh - 10; // the shells overlap where the pair is shared
  const far = near + 34;
  // The shared pair sits in the overlap of the two shells, either side of
  // the line between the nuclei, clear of both.
  const pairR = R - 5;
  const pairOff = 14;
  const size = (far + rh + 8) * 2;
  const c = size / 2;
  const root = svg('svg', { viewBox: `0 0 ${size.toFixed(0)} ${size.toFixed(0)}`, class: 'bond-diagram square' });
  root.append(atomBase(plan.center, c, c));
  // Four places around the outer shell: hydrogens take the first ones, lone pairs the rest.
  const domains = Array.from({ length: plan.hydrogens + plan.lonePairs }, (_, i) => -90 + (360 * i) / (plan.hydrogens + plan.lonePairs));
  const layer = svg('g', { class: 'bd-electrons' });
  domains.forEach((deg, i) => {
    if (i >= plan.hydrogens) {
      // A lone pair: two of the atom's own electrons on its outer shell.
      for (const off of [-10, 10]) {
        const p = at(c, c, R, deg + off);
        layer.append(electron(p.x, p.y));
      }
      return;
    }
    // A bonding place: the atom's own electron waits in the overlap...
    const own = at(c, c, pairR, deg - pairOff);
    layer.append(electron(own.x, own.y));
    // ...and a hydrogen atom moves in with its electron, which ends beside it.
    const start = at(c, c, far, deg);
    const end = at(c, c, near, deg);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const g = svg('g', { class: 'bd-moving' });
    g.style.setProperty('--dx', `${dx.toFixed(1)}px`);
    g.style.setProperty('--dy', `${dy.toFixed(1)}px`);
    g.append(atomBase({ symbol: 'H', shells: [0] }, start.x, start.y));
    const pe = at(c, c, pairR, deg + pairOff);
    g.append(electron(pe.x - dx, pe.y - dy));
    layer.append(g);
  });
  root.append(layer);
  return root;
}

/** The drawn diagram, with a caption naming what it shows and where it comes from. */
export function bondDiagram(plan: BondPlan, label: string): HTMLElement {
  const fig = document.createElement('figure');
  fig.className = 'bond-figure';
  const art = plan.kind === 'ionic' ? ionic(plan) : covalent(plan);
  art.setAttribute('role', 'img');
  art.setAttribute('aria-label', label);
  const cap = document.createElement('figcaption');
  cap.textContent =
    plan.kind === 'ionic'
      ? 'The moving electrons pass from the metal atoms to the non-metal atoms. Drawn from each atom’s verified electron shells.'
      : 'Each hydrogen atom moves in so its electron pairs with one of the other atom’s outer electrons. Drawn from each atom’s verified electron shells.';
  fig.append(art, cap);
  return fig;
}

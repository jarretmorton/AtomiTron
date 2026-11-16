// Electron-dot drawings of molecules: every outer electron as a dot, shared
// ones between the two atoms that share them. Atom positions come from
// PubChem's computed 3D model, flattened onto its best-fitting plane (PubChem's
// own flat layout zigzags chains, which would draw carbon dioxide bent).
// Which atoms are bonded, and how many pairs each bond shares, also come from
// PubChem; each atom's outer electrons come from its verified valence count.
// planLewis() checks the numbers fit (every atom ends with a full outer shell)
// and returns null otherwise.

export interface ModelAtom {
  symbol: string;
  x: number;
  y: number;
  z: number;
}

export interface ModelBond {
  a: number;
  b: number;
  order: number;
}

export interface LewisPlan {
  atoms: { symbol: string; x: number; y: number; lonePairs: number }[];
  bonds: ModelBond[];
}

/** Flatten 3D points onto the plane of their two largest spreads. */
export function flatten(atoms: ModelAtom[]): { x: number; y: number }[] {
  const n = atoms.length;
  const c = [0, 0, 0];
  for (const a of atoms) {
    c[0]! += a.x / n;
    c[1]! += a.y / n;
    c[2]! += a.z / n;
  }
  const p = atoms.map((a) => [a.x - c[0]!, a.y - c[1]!, a.z - c[2]!]);
  const cov = [0, 1, 2].map((i) => [0, 1, 2].map((j) => p.reduce((s, v) => s + v[i]! * v[j]!, 0)));
  const mul = (v: number[]) => [0, 1, 2].map((i) => cov[i]!.reduce((s, x, j) => s + x * v[j]!, 0));
  const norm = (v: number[]) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  // Power iteration for the largest spread, then the largest across it.
  let u = norm([1, 0.3, 0.2]);
  for (let k = 0; k < 60; k++) u = norm(mul(u));
  let v = norm([0.2, 1, 0.3]);
  for (let k = 0; k < 60; k++) {
    v = mul(v);
    const d = v.reduce((s, x, i) => s + x * u[i]!, 0);
    v = norm(v.map((x, i) => x - d * u[i]!));
  }
  // A straight molecule has no second spread: any direction across will do.
  if (!v.every(Number.isFinite) || Math.abs(v.reduce((s, x, i) => s + x * u[i]!, 0)) > 0.01) {
    v = norm(Math.abs(u[0]!) < 0.9 ? [-u[1]!, u[0]!, 0] : [0, -u[2]!, u[1]!]);
  }
  return p.map((q) => ({ x: q.reduce((s, x, i) => s + x * u[i]!, 0), y: q.reduce((s, x, i) => s + x * v[i]!, 0) }));
}

export function planLewis(atoms: ModelAtom[], bonds: ModelBond[], valence: (symbol: string) => number | undefined): LewisPlan | null {
  const flat = flatten(atoms);
  const out: LewisPlan['atoms'] = [];
  for (const [i, a] of atoms.entries()) {
    const v = valence(a.symbol);
    if (v === undefined) return null;
    const shared = bonds.filter((b) => b.a === i || b.b === i).reduce((s, b) => s + b.order, 0);
    const lone = v - shared;
    const full = a.symbol === 'H' ? 2 : 8;
    // Each bond shares one of this atom's electrons per pair; the rest pair up.
    if (lone < 0 || lone % 2 !== 0 || 2 * shared + lone !== full) return null;
    out.push({ symbol: a.symbol, x: flat[i]!.x, y: flat[i]!.y, lonePairs: lone / 2 });
  }
  return { atoms: out, bonds };
}

const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export function lewisSvg(plan: LewisPlan, label: string): SVGSVGElement {
  const S = 62; // pixels per model unit
  const pad = 40;
  const xs = plan.atoms.map((a) => a.x * S);
  const ys = plan.atoms.map((a) => -a.y * S);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad;
  const h = Math.max(...ys) - minY + pad;
  const root = svg('svg', { viewBox: `${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`, class: 'lewis', role: 'img', 'aria-label': label });
  const dot = (x: number, y: number) => root.append(svg('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.6, class: 'electron' }));

  // Shared pairs, between the two atoms, side by side across the bond.
  const dirs: number[][] = plan.atoms.map(() => []);
  for (const b of plan.bonds) {
    const ax = xs[b.a]!;
    const ay = ys[b.a]!;
    const bx = xs[b.b]!;
    const by = ys[b.b]!;
    dirs[b.a]!.push(Math.atan2(by - ay, bx - ax));
    dirs[b.b]!.push(Math.atan2(ay - by, ax - bx));
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    for (let k = 0; k < b.order; k++) {
      const off = (k - (b.order - 1) / 2) * 9;
      dot(mx - uy * off - ux * 4, my + ux * off - uy * 4);
      dot(mx - uy * off + ux * 4, my + ux * off + uy * 4);
    }
  }
  // Atoms, and their unshared pairs in the directions furthest from the bonds.
  plan.atoms.forEach((a, i) => {
    const used = [...dirs[i]!];
    for (let p = 0; p < a.lonePairs; p++) {
      let best = 0;
      let bestGap = -1;
      for (let deg = 0; deg < 360; deg += 5) {
        const t = (deg * Math.PI) / 180;
        const gap = used.length ? Math.min(...used.map((u) => Math.abs(Math.atan2(Math.sin(t - u), Math.cos(t - u))))) : Math.PI;
        if (gap > bestGap + 1e-9) {
          bestGap = gap;
          best = t;
        }
      }
      used.push(best);
      const cx = xs[i]! + Math.cos(best) * 19;
      const cy = ys[i]! + Math.sin(best) * 19;
      dot(cx - Math.sin(best) * 4, cy + Math.cos(best) * 4);
      dot(cx + Math.sin(best) * 4, cy - Math.cos(best) * 4);
    }
    const t = svg('text', { x: xs[i]!, y: ys[i]! + 6, class: 'lewis-symbol' });
    t.textContent = a.symbol;
    root.append(t);
  });
  return root;
}

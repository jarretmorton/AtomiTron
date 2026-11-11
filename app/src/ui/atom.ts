// The animated atom (spec 3.2): protons and neutrons in the nucleus, electrons
// in their shells. Plain SVG plus CSS rotation, which the iPad composites on
// the GPU. Protons are solid and neutrons are hollow rings, so they read apart
// without relying on color. Predicted shells are dashed. With reduced motion
// on, the electrons stand still.

const NS = 'http://www.w3.org/2000/svg';
const SIZE = 400;
const C = SIZE / 2;

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export interface AtomModel {
  protons: number;
  neutrons: number;
  /** Electrons per shell, innermost first. Omitted when the arrangement is disputed. */
  shells?: number[];
  /** The shells are a prediction (draw them dashed). */
  predicted?: boolean;
  label: string;
}

/** Interleave protons and neutrons evenly, so neither clumps on one side. */
function particleKinds(p: number, n: number): ('p' | 'n')[] {
  const out: ('p' | 'n')[] = [];
  let pi = 0;
  let ni = 0;
  while (pi < p || ni < n) {
    if (ni >= n || (pi < p && (pi + 0.5) / p <= (ni + 0.5) / n)) {
      out.push('p');
      pi++;
    } else {
      out.push('n');
      ni++;
    }
  }
  return out;
}

export function atomSvg(m: AtomModel): SVGSVGElement {
  const root = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'atom', role: 'img', 'aria-label': m.label });

  // Nucleus: a sunflower (Vogel) spiral packs any number of particles evenly.
  const count = m.protons + m.neutrons;
  const r = Math.max(2.4, 10 / Math.pow(count, 0.25));
  const spacing = r * 1.85;
  const nucleusRadius = spacing * Math.sqrt(count) + r;
  const nucleus = svg('g', { class: 'nucleus' });
  particleKinds(m.protons, m.neutrons).forEach((kind, i) => {
    const d = spacing * Math.sqrt(i + 0.5);
    const a = i * 2.39996323; // golden angle
    nucleus.append(
      svg('circle', {
        cx: (C + d * Math.cos(a)).toFixed(2),
        cy: (C + d * Math.sin(a)).toFixed(2),
        r: kind === 'p' ? r : r - Math.min(0.9, r * 0.2),
        class: kind === 'p' ? 'proton' : 'neutron',
        'stroke-width': kind === 'n' ? Math.max(1, r * 0.45).toFixed(2) : 0,
      }),
    );
  });

  // Shells, evenly spaced from just outside the nucleus to the edge.
  const shells = m.shells ?? [];
  const inner = nucleusRadius + 18;
  const outer = C - 10;
  const step = shells.length > 1 ? (outer - inner) / (shells.length - 1) : 0;
  shells.forEach((electrons, i) => {
    const radius = shells.length > 1 ? inner + step * i : Math.min(outer, inner + 40);
    root.append(svg('circle', { cx: C, cy: C, r: radius.toFixed(2), class: m.predicted ? 'shell predicted' : 'shell' }));
    const group = svg('g', { class: 'electrons' });
    // Outer shells turn more slowly; alternate directions.
    group.style.animationDuration = `${(14 + i * 6).toFixed(0)}s`;
    if (i % 2) group.style.animationDirection = 'reverse';
    for (let k = 0; k < electrons; k++) {
      const a = (2 * Math.PI * k) / electrons + i * 0.4;
      group.append(svg('circle', {
        cx: (C + radius * Math.cos(a)).toFixed(2),
        cy: (C + radius * Math.sin(a)).toFixed(2),
        r: shells.length > 5 ? 4 : 5.5,
        class: 'electron',
      }));
    }
    root.append(group);
  });
  root.append(nucleus);
  return root;
}

/** The legend: shapes as well as colors. */
export function atomLegend(): HTMLElement {
  const ul = document.createElement('ul');
  ul.className = 'atom-legend';
  for (const [cls, text] of [['proton', 'Proton (solid)'], ['neutron', 'Neutron (ring)'], ['electron', 'Electron']] as const) {
    const li = document.createElement('li');
    const s = svg('svg', { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true' });
    s.append(svg('circle', { cx: 10, cy: 10, r: cls === 'neutron' ? 6 : 7, class: cls, 'stroke-width': cls === 'neutron' ? 3 : 0 }));
    li.append(s, ` ${text}`);
    ul.append(li);
  }
  return ul;
}

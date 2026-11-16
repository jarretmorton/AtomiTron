// Preview of the bond visuals (#/preview): one working example of each idea,
// for review before any of them goes into Combine mode. Not linked from the
// app. The same rules apply as everywhere: every fact shown is verified and
// cited, everything drawn is derived from verified facts or a cited model,
// and every photo carries its credit and licence.

import { CONCEPTS } from '../content/concepts';
import { parseFormula } from '../data/chemistry';
import { reactionEnthalpy } from '../data/derive';
import { findBySymbol, loadElement } from '../data/elements';
import { isRenderable } from '../data/facts';
import { loadReactions, type ReactionData } from '../data/reactions';
import type { Element, Fact, Reaction } from '../data/schema';
import { citation, conceptNote, el, factRow } from '../ui/fact';
import { num } from '../ui/format';
import { lewisSvg, planLewis, type ModelAtom, type ModelBond } from '../ui/lewis';
import { startModel3d, type Ball, type Stick, type Vec } from '../ui/model3d';
import { formulaNode } from './combine';

interface Model {
  cid: number;
  source: { url: string; retrieved: string; via: string };
  note: string;
  '3d': { atoms: ModelAtom[]; bonds: ModelBond[] };
}

const modelFiles = import.meta.glob<Model>('../../../data/models/*.json', { import: 'default' });
const loadModel = (cid: number) => modelFiles[`../../../data/models/cid-${cid}.json`]!();
const MEDIA = `${import.meta.env.BASE_URL}media/`;

/** Element colors for balls and dots; every ball also shows its symbol. */
const COLOR: Record<string, string> = {
  H: 'var(--el-h)',
  C: 'var(--el-c)',
  N: 'var(--el-n)',
  O: 'var(--el-o)',
  Na: 'var(--el-na)',
  Cl: 'var(--el-cl)',
};

function section(n: number, title: string, intro: string, ...children: (Node | null)[]): HTMLElement {
  const s = el('section', 'card preview-card');
  const h = el('h2', undefined);
  h.append(el('span', 'layer-n', String(n)), ` ${title}`);
  s.append(h, el('p', 'note', intro), ...children.filter((c): c is Node => c !== null));
  return s;
}

function statement(f: Fact | undefined): HTMLElement | null {
  if (!f || !isRenderable(f)) return null;
  const p = el('p', 'statement');
  p.append(String(f.value), ' ', citation(f.source.url, f.source.via));
  return p;
}

function photo(file: string, alt: string, credit: string, sourceUrl: string): HTMLElement {
  const fig = el('figure', 'photo');
  const img = el('img');
  img.src = MEDIA + file;
  img.alt = alt;
  img.loading = 'lazy';
  const cap = el('figcaption');
  cap.append(credit, ' ', citation(sourceUrl));
  fig.append(img, cap);
  return fig;
}

async function elements(symbols: string[]): Promise<Map<string, Element>> {
  const out = new Map<string, Element>();
  for (const s of symbols) {
    const row = findBySymbol(s);
    if (row) out.set(s, await loadElement(row));
  }
  return out;
}

function group(...children: (Node | null)[]): HTMLElement {
  const d = el('div');
  d.append(...children.filter((c): c is Node => c !== null));
  return d;
}

const value = (f: Fact | undefined): number | undefined => (f && isRenderable(f) && typeof f.value === 'number' ? f.value : undefined);

// ---- 1: 3D molecules ------------------------------------------------------------------

function molecule3d(models: Model[]): HTMLElement {
  const picker = el('div', 'chip-list');
  const slot = el('div', 'model-slot');
  const cite = el('p', 'note');
  const names: Record<number, string> = { 962: 'Water', 297: 'Methane', 222: 'Ammonia', 280: 'Carbon dioxide' };
  const show = (m: Model) => {
    const canvas = el('canvas', 'model3d');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${names[m.cid]}: a 3D model you can turn`);
    slot.replaceChildren(canvas);
    const balls: Ball[] = m['3d'].atoms.map((a) => ({ label: a.symbol, pos: [a.x, a.y, a.z] as Vec, color: COLOR[a.symbol] ?? '#999', r: a.symbol === 'H' ? 0.2 : 0.3 }));
    const sticks: Stick[] = m['3d'].bonds.map((b) => ({ a: b.a, b: b.b, order: b.order }));
    requestAnimationFrame(() => startModel3d(canvas, balls, sticks));
    cite.replaceChildren(`${names[m.cid]}. ${m.note} Ball sizes are not to scale. Drag to turn it. `, citation(m.source.url, 'computed 3D conformer'));
    for (const b of picker.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.cid === String(m.cid)));
  };
  for (const m of models) {
    const b = el('button', 'chip', names[m.cid]);
    b.type = 'button';
    b.dataset.cid = String(m.cid);
    b.addEventListener('click', () => show(m));
    picker.append(b);
  }
  queueMicrotask(() => show(models[0]!));
  return group(picker, slot, cite);
}

// ---- 2: electron dots -------------------------------------------------------------------

function electronDots(models: Model[], els: Map<string, Element>): HTMLElement {
  const box = el('div', 'lewis-row');
  for (const m of models) {
    const plan = planLewis(m['3d'].atoms, m['3d'].bonds, (s) => value(els.get(s)?.valenceElectrons));
    const fig = el('figure', 'lewis-fig');
    const name = { 962: 'Water', 297: 'Methane', 222: 'Ammonia', 280: 'Carbon dioxide' }[m.cid] ?? '';
    if (plan) fig.append(lewisSvg(plan, `${name}: electron-dot drawing`));
    else fig.append(el('p', 'note', 'The numbers don’t fit a simple drawing, so none is shown.'));
    fig.append(el('figcaption', undefined, name));
    box.append(fig);
  }
  const p = el('p', 'note');
  p.append('Each dot is an outer electron, from each element’s verified valence count; dots between two atoms are shared. Which atoms are joined, and by how many pairs, comes from PubChem’s structure. ',
    citation(models[0]!.source.url, 'structure'));
  return group(box, p);
}

// ---- 3: a salt crystal --------------------------------------------------------------------

function saltCrystal(): HTMLElement {
  const balls: Ball[] = [];
  const index = new Map<string, number>();
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const na = (i + j + k) % 2 === 0;
        index.set(`${i},${j},${k}`, balls.length);
        balls.push({ label: na ? 'Na' : 'Cl', pos: [i, j, k], color: na ? COLOR.Na! : COLOR.Cl!, r: 0.3 });
      }
  const sticks: Stick[] = [];
  for (const [key, a] of index) {
    const [i, j, k] = key.split(',').map(Number) as [number, number, number];
    for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const b = index.get(`${i + di!},${j + dj!},${k + dk!}`);
      if (b !== undefined) sticks.push({ a, b, order: 0 });
    }
  }
  const canvas = el('canvas', 'model3d');
  requestAnimationFrame(() => startModel3d(canvas, balls, sticks));
  return group(canvas, conceptNote(CONCEPTS.saltLattice),
    el('p', 'note', 'Drawn from that statement: a small block of the repeating pattern, with each ion’s six neighbors joined by faint lines. Ion sizes are not to scale.'));
}

// ---- 4: before and after -------------------------------------------------------------------

function beforeAfter(data: ReactionData): HTMLElement {
  const byFormula = new Map([...data.compounds.values()].map((c) => [c.formula.value, c]));
  const card = (formula: string, role: string) => {
    const c = byFormula.get(formula)!;
    const d = el('div', 'ba-card');
    const h = el('h3', undefined);
    h.append(el('span', 'note', `${role} `), formulaNode(formula), ` ${c.name.value}`);
    d.append(h, statement(c.appearance) ?? el('p'));
    const hz = c.hazards.filter((x) => isRenderable(x.statement)).map((x) => x.statement.value);
    if (hz.length) d.append(el('p', 'ba-hazard', `⚠ ${hz.slice(0, 2).join('; ')}`));
    else d.append(el('p', 'ba-safe', 'No GHS hazard statement reported by most notifiers.'));
    return d;
  };
  const row = el('div', 'ba-row');
  row.append(card('Na', 'Start with'), el('span', 'ba-plus', '+'), card('Cl2', 'and'), el('span', 'ba-arrow', '→'), card('NaCl', 'Get'));
  return group(
    photo('openstax-sodium-chlorine-salt.jpg', 'Three photos: sodium metal, chlorine gas in a flask, and white salt crystals.',
      'Photos from OpenStax Chemistry (licence CC BY 4.0); the sodium photo is a modification of work by “Jurii”/Wikimedia Commons.',
      'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Chemistry_for_Changing_Times_(Hill_and_McCreary)/04%3A_Chemical_Bonds/4.03%3A_The_Reaction_of_Sodium_with_Chlorine'),
    row,
  );
}

// ---- 5: count the atoms ----------------------------------------------------------------------

function countAtoms(r: Reaction, data: ReactionData): HTMLElement {
  const side = (list: Reaction['reactants']) => {
    const g = el('div', 'count-side');
    const tally = new Map<string, number>();
    (list ?? []).forEach((s, i) => {
      if (i) g.append(el('span', 'ba-plus', '+'));
      const f = data.compounds.get(s.substance)!.formula.value;
      const comp = parseFormula(f)!;
      for (let n = 0; n < s.coefficient; n++) {
        const unit = el('span', 'count-unit');
        for (const [sym, k] of Object.entries(comp)) {
          for (let j = 0; j < k; j++) {
            const ball = el('span', `count-ball el-${sym.toLowerCase()}`, sym);
            unit.append(ball);
          }
          tally.set(sym, (tally.get(sym) ?? 0) + k);
        }
        g.append(unit);
      }
    });
    return { g, tally };
  };
  const left = side(r.reactants);
  const right = side(r.products);
  const row = el('div', 'count-row');
  row.append(left.g, el('span', 'ba-arrow', '→'), right.g);
  const table = el('table', 'count-table');
  const head = el('tr');
  head.append(el('th', undefined, 'Atom'), el('th', undefined, 'Before'), el('th', undefined, 'After'));
  table.append(head);
  for (const sym of left.tally.keys()) {
    const tr = el('tr');
    tr.append(el('td', undefined, sym), el('td', undefined, String(left.tally.get(sym))), el('td', undefined, String(right.tally.get(sym) ?? 0)));
    table.append(tr);
  }
  return group(row, table, conceptNote(CONCEPTS.balanced));
}

// ---- 6: energy hill -----------------------------------------------------------------------------

function energyHill(rs: Reaction[]): HTMLElement {
  const values = rs.map((r) => r.energy!.enthalpy!.value as number);
  const max = Math.max(...values.map(Math.abs));
  const row = el('div', 'hill-row');
  rs.forEach((r, i) => {
    const v = values[i]!;
    const H = 170;
    const mid = 95;
    // The same scale for both, so they compare. Screen y grows downward: a
    // negative energy change must end lower on the screen than it starts.
    const half = (v / max) * 35;
    const y0 = mid + half; // start
    const y1 = mid - half; // end
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', `0 0 240 ${H}`);
    s.setAttribute('class', 'hill');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', `${r.title}: energy ${v < 0 ? 'goes down' : 'goes up'}`);
    s.innerHTML = `
      <line x1="20" y1="${y0}" x2="90" y2="${y0}" class="hill-level"/>
      <line x1="150" y1="${y1}" x2="220" y2="${y1}" class="hill-level"/>
      <line x1="120" y1="${y0}" x2="120" y2="${y1}" class="hill-arrow" marker-end="url(#arrow${i})"/>
      <defs><marker id="arrow${i}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="hill-head"/></marker></defs>
      <text x="55" y="${y0 - 8}" class="hill-label">start</text>
      <text x="185" y="${y1 - 8}" class="hill-label">end</text>
      <text x="128" y="${mid + 4}" class="hill-value">${v < 0 ? '−' : '+'}${num(Math.abs(v))} kJ</text>`;
    const fig = el('figure', 'hill-fig');
    fig.append(s, el('figcaption', undefined, `${r.title}: ${v < 0 ? 'energy goes down, so it is given out' : 'energy goes up, so it is taken in'}`));
    row.append(fig);
  });
  return group(row, conceptNote(CONCEPTS.exothermic), conceptNote(CONCEPTS.endothermic),
    el('p', 'note', 'Both drawn to the same scale from their verified reaction energies.'));
}

// ---- 7: tug of war ---------------------------------------------------------------------------------

function tugOfWar(els: Map<string, Element>): HTMLElement {
  const box = el('div');
  for (const [a, b] of [['Na', 'Cl'], ['H', 'Cl']] as const) {
    const ea = els.get(a)!.electronegativity;
    const eb = els.get(b)!.electronegativity;
    const va = value(ea);
    const vb = value(eb);
    if (va === undefined || vb === undefined) continue;
    const diff = reactionEnthalpy([vb, va], [1, -1]) as number;
    // Shown to the precision of the less precise value: 3.16 − 2.2 = 1.0.
    const places = Math.min(...[va, vb].map((x) => (String(x).split('.')[1] ?? '').length));
    const bar = el('div', 'tug');
    const track = el('div', 'tug-track');
    for (const [s, v] of [[a, va], [b, vb]] as const) {
      const m = el('span', `tug-mark el-${s.toLowerCase()}`, s);
      m.style.left = `${(v / 4) * 100}%`;
      track.append(m);
    }
    const span = el('span', 'tug-span');
    span.style.left = `${(Math.min(va, vb) / 4) * 100}%`;
    span.style.width = `${(Math.abs(vb - va) / 4) * 100}%`;
    track.append(span);
    bar.append(el('p', 'tug-title', `${els.get(a)!.name.value} and ${els.get(b)!.name.value}: ${num(vb)} − ${num(va)} = ${diff.toFixed(places)}`), track);
    box.append(bar, factRow(`${els.get(a)!.name.value}: electronegativity`, ea) ?? el('p'), factRow(`${els.get(b)!.name.value}: electronegativity`, eb) ?? el('p'));
  }
  box.append(conceptNote(CONCEPTS.electronegativity), conceptNote(CONCEPTS.bondByDifference));
  return box;
}

// ---- The page -----------------------------------------------------------------------------------------

export function previewView(): HTMLElement {
  const page = el('section', 'combine-view preview');
  page.append(
    el('h1', undefined, 'Bond visuals: preview'),
    el('p', 'lede', 'One example of each idea, for review. None of these is in Combine mode yet.'),
  );
  const body = el('div');
  body.append(el('p', 'loading', 'Loading…'));
  page.append(body);
  Promise.all([loadReactions(), elements(['H', 'C', 'N', 'O', 'Na', 'Cl']), Promise.all([962, 297, 222, 280].map(loadModel))])
    .then(([data, els, models]) => {
      const rx = (id: string) => data.reactions.find((r) => r.id === `reaction:${id}`)!;
      body.replaceChildren(
        section(1, '3D molecules you can turn', 'From PubChem’s computed 3D models of each molecule.', molecule3d(models)),
        section(2, 'Electron-dot drawings', 'Every outer electron as a dot, for molecules that share electrons.', electronDots(models.filter((m) => m.cid !== 297), els)),
        section(3, 'A salt crystal', 'Salts don’t form molecules: they form a repeating pattern of ions.', saltCrystal()),
        section(4, 'Before and after', 'What goes in, and what comes out. Only verified descriptions.', beforeAfter(data)),
        section(5, 'Count the atoms', 'Every atom you start with is still there at the end.', countAtoms(rx('sodium-chlorine'), data)),
        section(6, 'Energy hill', 'Going down gives energy out; going up takes energy in.', energyHill([rx('sodium-chlorine'), rx('water-splitting')])),
        section(7, 'Electronegativity tug-of-war', 'Which atom pulls on the electrons harder, from each element’s verified electronegativity.', tugOfWar(els)),
        section(8, 'Real photos', 'Photos from the source pages, with their credit and licence.',
          photo('nasa-salt-crystals.jpg', 'Close-up of cube-shaped salt crystals.', 'Salt crystals. Public domain (NASA).',
            'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Chemistry_for_Changing_Times_(Hill_and_McCreary)/04%3A_Chemical_Bonds/4.03%3A_The_Reaction_of_Sodium_with_Chlorine')),
        section(9, 'PubChem’s structure drawing', 'The standard flat drawing of a compound, here glucose.',
          photo('pubchem-cid-5793.png', 'PubChem’s structure drawing of glucose.', 'Glucose (CID 5793), drawn by PubChem.', 'https://pubchem.ncbi.nlm.nih.gov/compound/5793#section=2D-Structure')),
      );
    })
    .catch((e) => body.replaceChildren(el('p', 'error', `Couldn’t load the preview. ${String(e)}`)));
  return page;
}

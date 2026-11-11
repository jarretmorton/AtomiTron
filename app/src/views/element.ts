// An element page (spec 3.2). Every value goes through factRow(), which
// refuses anything unverified and puts a tappable citation beside it.

import { CONCEPTS } from '../content/concepts';
import { ELEMENTS, findBySymbol, loadElement, type IndexRow } from '../data/elements';
import { isRenderable } from '../data/facts';
import type { Element, Fact, Isotope } from '../data/schema';
import { atomLegend, atomSvg } from '../ui/atom';
import { citation, el, factRow, predictedBadge } from '../ui/fact';
import { configuration, halfLifeText, percent } from '../ui/format';
import { getTempUnit, setTempUnit, TEMP_UNITS, type TempUnit } from '../units';
import { CLASSES } from './table';

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  const s = el('section', 'card');
  s.append(el('h2', undefined, title), ...children.filter((c): c is Node => c !== null));
  return s;
}

function header(row: IndexRow, e: Element): HTMLElement {
  const h = el('header', 'element-header');
  const cls = row.classification ? CLASSES[row.classification] : null;
  const big = el('div', `big-tile ${cls?.key ?? 'unclassified'}${row.predicted ? ' predicted' : ''}`);
  big.append(el('span', 'tile-z', String(row.z)), el('span', 'tile-symbol', row.symbol));
  const titles = el('div', 'element-titles');
  titles.append(el('h1', undefined, row.name));
  const cl = e.classification && isRenderable(e.classification) ? e.classification : null;
  if (cl) {
    const p = el('p', 'element-class');
    p.append(`${cls?.shape ?? ''} ${cl.value}`, ...(cl.uncertain ? [' ', predictedBadge()] : []), ' ', citation(cl.source.url, cl.source.via));
    titles.append(p);
  }
  h.append(big, titles);
  return h;
}

function isotopeName(e: Element, a: number): string {
  return `${String(e.name.value).toLowerCase()}-${a}`;
}

function atomSection(e: Element): HTMLElement {
  const { protons, neutrons, electrons, shells } = e.atom;
  const ok = [protons, neutrons, electrons].every(isRenderable);
  const drawnShells = shells && isRenderable(shells) ? shells : undefined;
  const natural = e.isotopes.some((i) => i.abundance);
  const name = isotopeName(e, e.atom.isotope);
  const lower = String(e.name.value).toLowerCase();
  const intro = el('p', 'atom-caption',
    natural
      ? `Showing ${name}, the most common form of ${lower} in nature.`
      : `Showing ${name}, the longest-lived known form of ${lower}. Every form of ${lower} is radioactive.`);
  const figure = el('figure', 'atom-figure');
  if (ok) {
    const shellText = drawnShells ? `, electrons in shells of ${(drawnShells.value as number[]).join(', ')}` : '';
    figure.append(atomSvg({
      protons: protons.value as number,
      neutrons: neutrons.value as number,
      shells: drawnShells?.value as number[] | undefined,
      predicted: drawnShells?.uncertain,
      label: `Model of a ${name} atom: ${protons.value} protons and ${neutrons.value} neutrons in the nucleus${shellText}.`,
    }));
    figure.append(atomLegend());
    if (!drawnShells) {
      figure.append(el('p', 'atom-caption',
        `${e.name.value} has ${electrons.value} electrons, but our sources disagree about how its outermost electron is arranged, so the shells aren't drawn.`));
    } else if (drawnShells.uncertain) {
      figure.append(el('p', 'atom-caption', 'The dashed shells are predicted by calculation, not measured.'));
    }
  }
  const massNumber = e.atom.isotope;
  return section('The atom', intro, figure,
    factRow('Protons', protons, { detail: 'The same as the atomic number.' }),
    factRow('Neutrons', neutrons, { detail: `${massNumber} − ${protons.value} = ${neutrons.value}`, concept: CONCEPTS.neutrons }),
    factRow('Electrons', electrons, { concept: CONCEPTS.electrons }),
    drawnShells ? factRow('Electrons in each shell', drawnShells, { concept: CONCEPTS.shells }) : null,
  );
}

function numbersSection(e: Element): HTMLElement {
  return section('The numbers',
    factRow('Atomic number', e.atomicNumber, { concept: CONCEPTS.atomicNumber }),
    factRow('Symbol', e.symbol),
    factRow('Atomic weight', e.atomicWeight, {
      detail: e.atomicWeight && typeof e.atomicWeight.value === 'object'
        ? "A range, because it varies slightly from place to place in nature." : undefined,
    }),
    factRow('Mass number of its longest-lived isotope', e.longestLivedIsotopeMassNumber, {
      detail: 'IUPAC gives no standard atomic weight for this element, so this is the mass number of its longest-lived known form instead.',
    }),
    factRow('Electron configuration', e.electronConfiguration, { show: (f) => ({ text: configuration(String(f.value)) }) }),
    factRow('Valence electrons', e.valenceElectrons, { concept: CONCEPTS.valence }),
    factRow('Electronegativity (Pauling scale)', e.electronegativity),
    factRow('Period (row)', e.period),
    factRow('Group (column)', e.group),
  );
}

function unitPicker(onChange: () => void): HTMLElement {
  const wrap = el('div', 'unit-picker');
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', 'Temperature unit');
  const current = getTempUnit();
  for (const u of Object.keys(TEMP_UNITS) as TempUnit[]) {
    const b = el('button', 'unit-btn', TEMP_UNITS[u].symbol);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(u === current));
    b.title = TEMP_UNITS[u].name;
    b.addEventListener('click', () => {
      setTempUnit(u);
      onChange();
    });
    wrap.append(b);
  }
  return wrap;
}

function propertiesSection(e: Element): HTMLElement {
  const s = el('section', 'card');
  const render = () => {
    s.replaceChildren(el('h2', undefined, 'Physical properties'));
    const temps = [e.meltingPoint, e.boilingPoint].some((f) => f && isRenderable(f));
    if (temps) s.append(unitPicker(render));
    for (const row of [
      factRow('State at room temperature', e.state),
      factRow('Melting point', e.meltingPoint),
      factRow('Boiling point', e.boilingPoint),
      factRow('Density', e.density),
    ]) if (row) s.append(row);
  };
  render();
  return s;
}

function isotopeCard(e: Element, iso: Isotope): HTMLElement | null {
  if (!isRenderable(iso.massNumber)) return null;
  const a = iso.massNumber.value as number;
  const card = el('div', 'isotope');
  card.append(el('h3', undefined, isotopeName(e, a)));
  for (const row of [
    factRow('Mass number', iso.massNumber),
    factRow('Mass', iso.atomicMass),
    factRow('Share of atoms in nature', iso.abundance, {
      show: (f: Fact) => typeof f.value === 'number'
        ? { text: percent(f.value) }
        : { text: `${percent((f.value as { min: number }).min)} to ${percent((f.value as { max: number }).max)}` },
    }),
    factRow('Half-life', iso.halfLife, { show: (f) => ({ text: halfLifeText(f) }) }),
  ]) if (row) card.append(row);
  return card;
}

function isotopesSection(e: Element): HTMLElement {
  const list = el('div', 'isotopes');
  for (const iso of e.isotopes) {
    const card = isotopeCard(e, iso);
    if (card) list.append(card);
  }
  const intro = el('p', 'concept');
  intro.append(CONCEPTS.isotopes.text, ' ', citation(CONCEPTS.isotopes.url));
  return section(e.isotopes.some((i) => i.abundance) ? 'Isotopes found in nature' : 'Isotope shown', intro, list);
}

function nav(row: IndexRow): HTMLElement {
  const n = el('nav', 'element-nav');
  n.setAttribute('aria-label', 'Element navigation');
  const back = el('a', 'nav-btn', '← Table');
  back.href = '#/table';
  n.append(back);
  const i = ELEMENTS.indexOf(row);
  const prev = ELEMENTS[i - 1];
  const next = ELEMENTS[i + 1];
  const spacer = el('span', 'nav-spacer');
  n.append(spacer);
  if (prev) {
    const a = el('a', 'nav-btn', `‹ ${prev.symbol}`);
    a.href = `#/element/${prev.symbol}`;
    a.setAttribute('aria-label', `Previous: ${prev.name}`);
    n.append(a);
  }
  if (next) {
    const a = el('a', 'nav-btn', `${next.symbol} ›`);
    a.href = `#/element/${next.symbol}`;
    a.setAttribute('aria-label', `Next: ${next.name}`);
    n.append(a);
  }
  return n;
}

export function elementView(symbol: string | undefined): HTMLElement {
  const page = el('article', 'element-view');
  const row = symbol ? findBySymbol(symbol) : undefined;
  if (!row) {
    page.append(el('h1', undefined, 'Element not found'), nav(ELEMENTS[0]!));
    return page;
  }
  page.append(nav(row), el('p', 'loading', `Loading ${row.name}…`));
  loadElement(row)
    .then((e) => {
      page.replaceChildren(nav(row), header(row, e), atomSection(e), numbersSection(e), propertiesSection(e), isotopesSection(e),
        section('Discovery and uses', el('p', 'coming', 'Coming in a later update, once each statement has been checked against its source.')));
      document.title = `${row.name} — AtomiTron`;
    })
    .catch(() => {
      page.replaceChildren(nav(row), el('p', 'error', `Couldn't load ${row.name}. Check the connection and try again.`));
    });
  return page;
}

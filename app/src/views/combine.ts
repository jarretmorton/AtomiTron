// Combine mode (spec 3.3). Pick substances; see whether they react, and why,
// in five layers. Everything shown is a verified fact with its citation, a
// value derived from verified facts (the summary, the energy and its
// working, the diagram), or an explanation with its own verification record.
// A combination AtomiTron has no entry for says exactly that: it never
// claims that nothing happens.

import { CONCEPTS } from '../content/concepts';
import { parseFormula } from '../data/chemistry';
import { ELEMENTS, findBySymbol, loadElement } from '../data/elements';
import { isRenderable } from '../data/facts';
import {
  energyWorking,
  entriesWith,
  findEntries,
  fromTokens,
  loadReactions,
  pickables,
  substanceFor,
  type EnergyTerm,
  type Pickable,
  type ReactionData,
} from '../data/reactions';
import type { Compound, Fact, Phase, Range, Reaction } from '../data/schema';
import { bondDiagram, planBond, type AtomInfo } from '../ui/bond-diagram';
import { citation, conceptNote, el, factRow } from '../ui/fact';
import { num } from '../ui/format';
import { CLASSES } from './table';

/** The current selection, kept while moving between the picker and a result. */
let selection: string[] = [];

const PHASE: Record<Phase, string> = { s: 's', l: 'l', g: 'g' };

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

function statement(f: Fact): HTMLElement | null {
  if (!isRenderable(f)) return null;
  const li = el('li', 'statement');
  li.append(String(f.value), ' ', citation(f.source.url, f.source.via));
  return li;
}

function statements(facts: Fact[] | undefined): HTMLElement | null {
  const items = (facts ?? []).map(statement).filter((x): x is HTMLElement => x !== null);
  if (!items.length) return null;
  const ul = el('ul', 'statements');
  ul.append(...items);
  return ul;
}

function nameOf(c: Compound | undefined): string {
  return c && isRenderable(c.name) ? c.name.value : '?';
}

// ---- Picker -------------------------------------------------------------------------

function pickerView(data: ReactionData): HTMLElement {
  const page = el('section', 'combine-view');
  const items = pickables(data);
  const byToken = new Map(items.map((p) => [p.token, p]));
  selection = selection.filter((t) => byToken.has(t));

  page.append(
    el('h1', undefined, 'Combine'),
    el('p', 'lede', 'Pick two or more substances to see whether they react, and why. Pick one compound on its own to see whether it breaks down.'),
  );
  const tray = el('div', 'combine-tray');
  tray.setAttribute('aria-live', 'polite');
  const hints = el('div', 'combine-hints');
  const go = el('a', 'primary-btn', 'See what happens');

  const toggle = (token: string) => {
    selection = selection.includes(token) ? selection.filter((t) => t !== token) : [...selection, token];
    refresh();
  };

  const tiles = new Map<string, HTMLButtonElement>();
  const refresh = () => {
    tray.replaceChildren();
    if (!selection.length) tray.append(el('span', 'tray-empty', 'Nothing picked yet.'));
    for (const t of selection) {
      const p = byToken.get(t)!;
      const chip = el('button', 'chip selected');
      chip.type = 'button';
      chip.append(formulaNode(p.formula), el('span', 'chip-name', p.name), el('span', 'chip-x', '×'));
      chip.setAttribute('aria-label', `Remove ${p.name}`);
      chip.addEventListener('click', () => toggle(t));
      tray.append(chip);
    }
    for (const [t, b] of tiles) b.setAttribute('aria-pressed', String(selection.includes(t)));
    go.href = `#/combine/${selection.map(encodeURIComponent).join('+')}`;
    go.toggleAttribute('aria-disabled', selection.length === 0);
    // Hints: what AtomiTron's list has with everything picked so far.
    hints.replaceChildren();
    const ids = selection.map((t) => byToken.get(t)!.id);
    const more = ids.length ? entriesWith(ids, data) : [];
    const partners = [...new Set(more.flatMap((r) => r.inputs.filter((i) => !ids.includes(i))))];
    if (partners.length) {
      hints.append(el('span', 'hint-label', 'In AtomiTron’s list with these: '));
      for (const id of partners) {
        const p = items.find((x) => x.id === id);
        if (!p) continue;
        const b = el('button', 'chip');
        b.type = 'button';
        b.append(formulaNode(p.formula), el('span', 'chip-name', p.name));
        b.addEventListener('click', () => toggle(p.token));
        hints.append(b);
      }
    }
  };
  go.addEventListener('click', (e) => {
    if (!selection.length) e.preventDefault();
  });

  // Elements, laid out as in the periodic table. Only those in AtomiTron's
  // list can be picked for now; the others stay in place, dimmed.
  const frame = el('div', 'table-frame');
  const grid = el('div', 'ptable picker');
  const fIndex = new Map<number, number>();
  for (const period of [6, 7]) {
    ELEMENTS.filter((e) => e.group === null && e.period === period).forEach((e, i) => fIndex.set(e.z, i));
  }
  frame.tabIndex = 0;
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', 'Elements to pick, scrolls sideways');
  for (const row of ELEMENTS) {
    const p = byToken.get(row.symbol);
    const cls = row.classification ? CLASSES[row.classification] : null;
    const b = el('button', `tile ${cls?.key ?? 'unclassified'}${p ? '' : ' off'}`);
    b.type = 'button';
    b.style.gridColumn = String(row.group ?? 3 + fIndex.get(row.z)!);
    b.style.gridRow = String(row.group === null ? row.period + 3 : row.period);
    b.append(el('span', 'tile-z', String(row.z)), el('span', 'tile-symbol', row.symbol), el('span', 'tile-name', row.name));
    if (p) {
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', row.name);
      b.addEventListener('click', () => toggle(row.symbol));
      tiles.set(row.symbol, b);
    } else {
      b.disabled = true;
      b.setAttribute('aria-label', `${row.name}, not in the reaction list yet`);
    }
    grid.append(b);
  }
  frame.append(grid);

  const compounds = el('div', 'chip-list');
  for (const p of items.filter((x) => !x.isElement)) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.append(formulaNode(p.formula), el('span', 'chip-name', p.name));
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => toggle(p.token));
    tiles.set(p.token, b as HTMLButtonElement);
    compounds.append(b);
  }

  const actions = el('div', 'combine-actions');
  const clear = el('button', 'nav-btn', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => {
    selection = [];
    refresh();
  });
  actions.append(go, clear);

  page.append(
    el('h2', 'visually-hidden', 'Picked'),
    tray,
    actions,
    hints,
    el('h2', undefined, 'Elements'),
    el('p', 'table-note', `Elements in AtomiTron’s checked reactions can be picked. More will be added.`),
    frame,
    el('h2', undefined, 'Compounds'),
    compounds,
  );
  refresh();
  return page;
}

// ---- Result ---------------------------------------------------------------------------

function layer(n: number, title: string, open: boolean, ...children: (Node | null)[]): HTMLDetailsElement {
  const d = el('details', 'layer');
  // ?layers=open (development only) opens every layer, for screenshots.
  d.open = open || (import.meta.env.DEV && location.search.includes('layers=open'));
  const s = el('summary', undefined);
  s.append(el('span', 'layer-n', String(n)), ` ${title}`);
  d.append(s, ...children.filter((c): c is Node => c !== null));
  return d;
}

function hazardBox(r: Reaction): HTMLElement | null {
  const why = statements(r.hazard?.why);
  if (!why) return null;
  const box = el('aside', 'hazard-box');
  box.setAttribute('aria-label', 'Hazard');
  box.append(el('p', 'hazard-badge', '⚠ Hazard: why this is dangerous'), why);
  return box;
}

function equation(r: Reaction, data: ReactionData): HTMLElement {
  const p = el('p', 'equation');
  const side = (list: Reaction['reactants']) => {
    (list ?? []).forEach((s, i) => {
      if (i) p.append(' + ');
      if (s.coefficient > 1) p.append(`${s.coefficient} `);
      const c = data.compounds.get(s.substance);
      p.append(formulaNode(c && isRenderable(c.formula) ? c.formula.value : '?'), el('span', 'phase', `(${PHASE[s.phase]})`));
    });
  };
  side(r.reactants);
  p.append(' → ');
  side(r.products);
  return p;
}

function enthalpyText(v: number | Range): string {
  return typeof v === 'number' ? `${num(v)} kJ` : `${num(v.min)} to ${num(v.max)} kJ`;
}

function workingTerm(t: EnergyTerm): HTMLElement {
  const li = el('li', 'working-term');
  const v = t.fact.value;
  const value = typeof v === 'number' ? num(v) : `${num(v.min)} to ${num(v.max)}`;
  li.append(`${t.coefficient} × `, formulaNode(isRenderable(t.compound.formula) ? t.compound.formula.value : '?'), `(${PHASE[t.phase]}): `);
  li.append(el('strong', undefined, `${value} kJ/mol`));
  if (t.fact.qualifier) li.append(' ', el('span', 'badge-qualifier', t.fact.qualifier));
  li.append(' ', citation(t.fact.source.url, t.fact.source.via));
  return li;
}

function realChemistry(r: Reaction, data: ReactionData): HTMLElement[] {
  const out: HTMLElement[] = [equation(r, data)];
  const h = r.energy?.enthalpy;
  if (!h || !isRenderable(h)) {
    if (r.energy?.unavailable) out.push(el('p', 'note', `No reaction energy: ${r.energy.unavailable}`));
    return out;
  }
  const row = factRow('Reaction energy (ΔH)', h, { show: (f) => ({ text: enthalpyText(f.value as number | Range) }) });
  if (row) out.push(row);
  const w = energyWorking(r, data);
  if (w) {
    const box = el('div', 'working');
    box.append(el('p', undefined, 'How it’s worked out: the formation energies of what’s made, minus those of what you start with, each times its number in the equation.'));
    const list = (title: string, terms: EnergyTerm[]) => {
      const ul = el('ul', 'working-list');
      ul.append(...terms.map(workingTerm));
      box.append(el('p', 'working-head', title), ul);
    };
    list('What’s made:', w.products);
    list('What you start with:', w.reactants);
    box.append(el('p', 'working-result', `ΔH = ${enthalpyText(h.value as number | Range)}, rounded to the precision of the least precise value.`));
    if ([...w.products, ...w.reactants].some((t) => t.fact.value === 0)) box.append(conceptNote(CONCEPTS.formationZero));
    box.append(conceptNote(CONCEPTS.enthalpySign));
    out.push(box);
  }
  return out;
}

function substanceCard(c: Compound): HTMLElement {
  const card = el('div', 'substance');
  const head = el('h3', undefined);
  head.append(formulaNode(isRenderable(c.formula) ? c.formula.value : '?'));
  card.append(head);
  // A state worked out by code says how (rule state-at-room-temperature).
  const derived = c.standardState.derivation?.inputs.length;
  const stateHow = derived
    ? derived === 1
      ? 'Worked out from its melting point: it melts above room temperature (25 °C).'
      : 'Worked out from its melting and boiling points, against room temperature (25 °C).'
    : undefined;
  for (const row of [
    factRow('Name', c.name),
    factRow('State at room temperature', c.standardState, { detail: stateHow }),
    factRow('Melting point', c.meltingPoint),
    factRow('Boiling point', c.boilingPoint),
    factRow('What it looks like', c.appearance),
  ]) {
    if (row) card.append(row);
  }
  const uses = statements(c.uses);
  if (uses) card.append(el('h4', undefined, 'What it is used for'), uses);
  const hz = c.hazards.filter((x) => isRenderable(x.statement) && isRenderable(x.reportedBy));
  if (hz.length) {
    const ul = el('ul', 'statements ghs');
    for (const x of hz) {
      const li = el('li', 'statement');
      li.append(el('span', 'ghs-code', x.code), ` ${x.statement.value} `, el('span', 'fact-note', `(reported by ${num(x.reportedBy.value)}% of notifiers)`), ' ',
        citation(x.statement.source.url, x.statement.source.via));
      ul.append(li);
    }
    card.append(el('h4', undefined, 'Hazard statements (GHS)'), ul);
  }
  return card;
}

async function atomInfo(symbol: string): Promise<AtomInfo | undefined> {
  const row = findBySymbol(symbol);
  if (!row) return undefined;
  const e = await loadElement(row);
  const shells = e.atom.shells;
  const valence = e.valenceElectrons;
  if (!shells || !valence || !isRenderable(shells) || !isRenderable(valence) || !e.classification || !isRenderable(e.classification)) return undefined;
  return { symbol, shells: shells.value as number[], valence: valence.value as number, metal: e.classification.value === 'Metal' };
}

/** The bond diagram for a reaction with one product, when the data fits one. */
async function diagramFor(r: Reaction, data: ReactionData): Promise<HTMLElement | null> {
  const type = r.bonding?.type;
  if (!type || !isRenderable(type) || r.products?.length !== 1) return null;
  const product = data.compounds.get(r.products[0]!.substance);
  if (!product || !isRenderable(product.formula)) return null;
  const formula = parseFormula(product.formula.value);
  if (!formula) return null;
  const infos = new Map<string, AtomInfo | undefined>();
  for (const s of Object.keys(formula)) infos.set(s, await atomInfo(s));
  const plan = planBond(type.value, formula, (s) => infos.get(s));
  return plan ? bondDiagram(plan, `How the electrons move when ${nameOf(product)} forms`) : null;
}

function shellsList(r: Reaction, data: ReactionData): HTMLElement | null {
  // The electron shells of each element in the product, from the element pages.
  const product = r.products?.length === 1 ? data.compounds.get(r.products[0]!.substance) : undefined;
  const formula = product && isRenderable(product.formula) ? parseFormula(product.formula.value) : null;
  if (!formula) return null;
  const box = el('div', 'shell-list');
  for (const s of Object.keys(formula)) {
    const row = findBySymbol(s);
    if (!row) continue;
    const slot = el('div', undefined);
    box.append(slot);
    loadElement(row).then((e) => {
      const f = factRow(`${row.name}: electrons in each shell`, e.atom.shells, { show: (x) => ({ text: (x.value as number[]).join(', ') }) });
      if (f) slot.replaceWith(f);
    });
  }
  return box;
}

function entryView(r: Reaction, data: ReactionData): HTMLElement {
  const art = el('article', 'card entry');
  art.append(el('h2', undefined, r.title));
  const hz = hazardBox(r);
  if (hz) art.append(hz);

  if (r.kind === 'no-reaction') {
    art.append(statements(r.summary) ?? el('p', undefined, ''), el('h3', undefined, 'Why'), statements(r.whyNot) ?? el('p'));
    return art;
  }

  const diagramSlot = el('div', 'diagram-slot');
  diagramFor(r, data).then((d) => {
    if (d) diagramSlot.replaceWith(d);
    else diagramSlot.remove();
  });
  art.append(layer(1, 'What happens', true, statements(r.summary), diagramSlot));

  const bt = r.bonding?.type;
  art.append(
    bt && isRenderable(bt)
      ? layer(2, 'The bond', false, factRow('Kind of bond', bt), statements(r.bonding?.why), shellsList(r, data))
      : layer(2, 'The bond', false, el('p', 'note', 'The bond for this reaction hasn’t been checked against a source yet.')),
  );

  const dir = r.energy?.direction;
  const energy = layer(3, 'Energy', false);
  if (dir && isRenderable(dir)) {
    const concept = dir.value === 'exothermic' ? CONCEPTS.exothermic : CONCEPTS.endothermic;
    const row = factRow('Energy', dir, { show: (f) => ({ text: f.value === 'exothermic' ? 'Exothermic' : 'Endothermic' }), concept });
    if (row) energy.append(row);
  } else if (r.energy?.unavailable) {
    energy.append(el('p', 'note', r.energy.unavailable));
  }
  const trigger = r.energy?.trigger;
  if (trigger && isRenderable(trigger)) energy.append(el('h4', undefined, 'What starts it'), statements([trigger])!);
  art.append(energy);

  const made = (r.products ?? []).map((s) => data.compounds.get(s.substance)).filter((c): c is Compound => !!c);
  art.append(layer(4, made.length > 1 ? 'The new substances' : 'The new substance', false, ...made.map(substanceCard)));
  art.append(layer(5, 'The real chemistry', false, ...realChemistry(r, data)));
  return art;
}

function resultView(tokens: string[], data: ReactionData): HTMLElement {
  const page = el('section', 'combine-view');
  const nav = el('nav', 'element-nav');
  const back = el('a', 'nav-btn', '← Change');
  back.href = '#/combine';
  nav.append(back);
  page.append(nav);

  const { ids, unknown } = fromTokens(tokens, data);
  selection = tokens.filter((t) => !unknown.includes(t));
  const picked = el('p', 'picked');
  for (const id of ids) {
    const c = substanceFor(id, data);
    const chip = el('span', 'chip selected');
    chip.append(formulaNode(c && isRenderable(c.formula) ? c.formula.value : id), el('span', 'chip-name', nameOf(c)));
    picked.append(chip);
  }
  page.append(el('h1', 'visually-hidden', 'Result'), picked);

  const found = unknown.length ? [] : findEntries(ids, data);
  if (!found.length) {
    const card = el('article', 'card entry');
    card.append(
      el('h2', undefined, 'Not in AtomiTron’s list yet'),
      el('p', undefined, 'AtomiTron only shows reactions whose facts have been checked against their sources, and this combination isn’t one of them yet. That doesn’t mean nothing happens.'),
    );
    const near = ids.length ? data.reactions.filter((r) => ids.every((i) => r.inputs.includes(i)) || r.inputs.every((i) => ids.includes(i))) : [];
    if (near.length) {
      card.append(el('h3', undefined, 'Close to what you picked'));
      const ul = el('ul', 'link-list');
      for (const r of near.slice(0, 8)) {
        const li = el('li');
        const a = el('a', undefined, r.title);
        a.href = `#/combine/${r.inputs.map((i) => pickables(data).find((p) => p.id === i)?.token ?? '').join('+')}`;
        li.append(a);
        ul.append(li);
      }
      card.append(ul);
    }
    page.append(card);
    return page;
  }
  if (found.length > 1) page.append(el('p', 'note', `AtomiTron has ${found.length} entries for this combination: what forms depends on the conditions.`));
  for (const r of found) page.append(entryView(r, data));
  document.title = `${found.map((r) => r.title).join(' · ')} — AtomiTron`;
  return page;
}

export function combineView(params: string[]): HTMLElement {
  const outlet = el('div');
  outlet.append(el('p', 'loading', 'Loading reactions…'));
  loadReactions()
    .then((data) => {
      const tokens = (params[0] ?? '').split('+').filter(Boolean);
      outlet.replaceChildren(tokens.length ? resultView(tokens, data) : pickerView(data));
    })
    .catch(() => outlet.replaceChildren(el('p', 'error', 'Couldn’t load the reactions. Check the connection and try again.')));
  return outlet;
}

export type { Pickable };

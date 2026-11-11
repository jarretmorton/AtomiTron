// One displayed fact: label, value, a "predicted" badge when uncertain, and a
// tappable citation. This is the only way an element fact reaches the screen,
// and it refuses anything that fails isRenderable() (spec 10.3).

import type { Concept } from '../content/concepts';
import { isRenderable, sourceName } from '../data/facts';
import type { Fact } from '../data/schema';
import { showFact, type Shown } from './format';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
export { el };

/** A tappable citation chip: "PubChem · Jefferson Lab ↗". */
export function citation(url: string, via?: string): HTMLAnchorElement {
  const name = sourceName(url) ?? url;
  const a = el('a', 'cite');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const from = via && via !== name ? ` · ${via}` : '';
  a.textContent = `${name}${from}`;
  a.setAttribute('aria-label', `Source: ${name}${via && via !== name ? `, from ${via}` : ''} (opens in a new tab)`);
  return a;
}

export function predictedBadge(): HTMLElement {
  const b = el('span', 'badge-predicted', 'predicted');
  b.title = 'A prediction or estimate, not a measurement';
  return b;
}

export function conceptNote(c: Concept): HTMLElement {
  const p = el('p', 'concept');
  p.append(c.text, ' ', citation(c.url));
  return p;
}

export interface FactOptions {
  /** Custom display; defaults to showFact(). */
  show?: (f: Fact) => Shown;
  /** A short explanation with its own citation. */
  concept?: Concept;
  /** Extra line under the value, e.g. the arithmetic for a derived count. */
  detail?: string;
}

/** A labelled fact row, or null if the fact is missing or not renderable. */
export function factRow(label: string, fact: Fact | undefined, opts: FactOptions = {}): HTMLElement | null {
  if (fact === undefined) return null;
  if (!isRenderable(fact)) {
    if (import.meta.env.DEV) console.warn('[AtomiTron] refused to render an unverified fact:', label, fact);
    return null;
  }
  const row = el('div', 'fact');
  const name = el('div', 'fact-label', label);
  const value = el('div', 'fact-value');
  const shown = (opts.show ?? showFact)(fact);
  value.append(shown.text);
  if (fact.uncertain) value.append(' ', predictedBadge());
  row.append(name, value);
  if (shown.note) row.append(el('div', 'fact-note', shown.note));
  if (opts.detail) row.append(el('div', 'fact-note', opts.detail));
  row.append(citation(fact.source.url, fact.source.via));
  if (opts.concept) {
    // A derived fact already cites its concept page; don't link it twice.
    row.append(opts.concept.url === fact.source.url ? el('p', 'concept', opts.concept.text) : conceptNote(opts.concept));
  }
  return row;
}

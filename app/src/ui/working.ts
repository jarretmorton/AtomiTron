// The working behind the counts that come from an electron configuration,
// shown so a reader can redo them (checkpoint 1 found that these counts
// couldn't be confirmed from the cited pages alone). Everything here is
// arithmetic on verified facts; nothing adds a new claim.

import { parseConfiguration, shellWorking, valenceWorking, type ShellWorking } from '../data/derive';
import { isRenderable, sourceName } from '../data/facts';
import type { Element, Fact } from '../data/schema';
import { el } from './fact';
import { configuration } from './format';

const A1_TABLE = 'A1%3A_Atomic_Electron_Configurations';

/** "4s² 4p⁶ 4d² → 2 + 6 + 2 = 10", or "1s² → 2" for a single subshell. */
function sumLine(w: ShellWorking): DocumentFragment {
  const frag = document.createDocumentFragment();
  frag.append(configuration(w.parts.map((p) => `${p.subshell}${p.electrons}`).join(' ')));
  const sum = w.parts.map((p) => p.electrons).join(' + ');
  frag.append(w.parts.length > 1 ? ` → ${sum} = ${w.total}` : ` → ${w.total}`);
  return frag;
}

function occupancy(e: Element) {
  const c = e.electronConfiguration;
  return c && isRenderable(c) ? parseConfiguration(String(c.value)) : null;
}

/** A collapsed, shell-by-shell working for the shell counts. */
export function shellsWorking(e: Element): HTMLElement | null {
  const occ = occupancy(e);
  if (!occ) return null;
  const details = el('details', 'working');
  details.append(el('summary', undefined, 'Show the working'));
  details.append(el('p', 'fact-note', 'Every subshell in the configuration, grouped by shell and added up:'));
  const list = el('ol', 'working-list');
  for (const w of shellWorking(occ)) {
    const li = el('li');
    li.append(`Shell ${w.shell}: `, sumLine(w));
    list.append(li);
  }
  details.append(list);
  return details;
}

/** Where to find the shell row, when it's cited from the LibreTexts table. */
export function shellSourceNote(e: Element, shells: Fact): string | undefined {
  if (!shells.source.url.endsWith(A1_TABLE)) return undefined;
  return `The LibreTexts table lists this row under element ${e.atomicNumber.value} (${e.symbol.value}).`;
}

/** "Outer shell 3: 3s² 3p⁴ → 2 + 4 = 6" */
export function valenceWorkingNote(e: Element): Node | undefined {
  const occ = occupancy(e);
  if (!occ || !e.valenceElectrons) return undefined;
  const w = valenceWorking(occ);
  const frag = document.createDocumentFragment();
  frag.append(`Outer shell ${w.shell}: `, sumLine(w));
  return frag;
}

/** Says how the source spells a configuration the app lists in shell order. */
export function asWrittenNote(fact: Fact | undefined): Node | undefined {
  const written = fact?.source.asWritten;
  if (!fact || !written) return undefined;
  const frag = document.createDocumentFragment();
  frag.append(`${sourceName(fact.source.url) ?? 'The source'} writes this as `, configuration(written),
    ': the same subshells in a different order. AtomiTron lists them shell by shell.');
  return frag;
}

// Reaction data access and the logic behind Combine mode (spec 3.3): which
// substances can be picked, which entry a selection finds, and the working
// behind each reaction energy. Pure functions over the verified files, so
// tests can run them on the real data.

import type { Compound, Dataset, EntityId, Fact, Phase, Range, Reaction } from './schema';
import { isRenderable } from './facts';

export interface ReactionData {
  compounds: Map<string, Compound>;
  reactions: Reaction[];
}

const compoundFiles = import.meta.glob<Dataset<'compounds'>>('../../../data/verified/compounds.json', { import: 'default' });
const reactionFiles = import.meta.glob<Dataset<'reactions'>>('../../../data/verified/reactions.json', { import: 'default' });

let cache: Promise<ReactionData> | null = null;

/** Loads both files once, as a separate chunk from the periodic table. */
export function loadReactions(): Promise<ReactionData> {
  cache ??= Promise.all([Object.values(compoundFiles)[0]!(), Object.values(reactionFiles)[0]!()]).then(([c, r]) =>
    buildData(c, r),
  );
  return cache;
}

export function buildData(compounds: Dataset<'compounds'>, reactions: Dataset<'reactions'>): ReactionData {
  return { compounds: new Map(compounds.items.map((c) => [c.id, c])), reactions: reactions.items };
}

// ---- What can be picked ------------------------------------------------------------

export interface Pickable {
  /** element:Na or compound:cid-962, as in a reaction's inputs. */
  id: EntityId;
  /** The URL token: the symbol for an element (Na), the formula for a compound (H2O). */
  token: string;
  name: string;
  formula: string;
  isElement: boolean;
}

/** The substance for an input: a compound id, or an element's elemental substance. */
export function substanceFor(id: string, data: ReactionData): Compound | undefined {
  return data.compounds.get(id) ?? [...data.compounds.values()].find((c) => c.element === id);
}

/** Everything that appears as an input to some entry, elements first. */
export function pickables(data: ReactionData): Pickable[] {
  const ids = new Set(data.reactions.flatMap((r) => r.inputs));
  const out: Pickable[] = [];
  for (const id of ids) {
    const c = substanceFor(id, data);
    if (!c || !isRenderable(c.name) || !isRenderable(c.formula)) continue;
    const isElement = id.startsWith('element:');
    out.push({
      id,
      token: isElement ? id.slice('element:'.length) : c.formula.value,
      name: c.name.value,
      formula: c.formula.value,
      isElement,
    });
  }
  return out.sort((a, b) => Number(b.isElement) - Number(a.isElement) || a.name.localeCompare(b.name));
}

/** URL tokens to input ids. Unknown tokens are returned separately. */
export function fromTokens(tokens: string[], data: ReactionData): { ids: EntityId[]; unknown: string[] } {
  const byToken = new Map(pickables(data).map((p) => [p.token, p.id]));
  const ids: EntityId[] = [];
  const unknown: string[] = [];
  for (const t of tokens) {
    const id = byToken.get(t);
    if (id) {
      if (!ids.includes(id)) ids.push(id);
    } else unknown.push(t);
  }
  return { ids, unknown };
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The entries a selection finds: those whose inputs are exactly the selection. */
export function findEntries(selection: readonly string[], data: ReactionData): Reaction[] {
  return data.reactions.filter((r) => sameSet(r.inputs, selection));
}

/** Entries that contain the whole selection plus more: hints for what to add. */
export function entriesWith(selection: readonly string[], data: ReactionData): Reaction[] {
  return data.reactions.filter((r) => r.inputs.length > selection.length && selection.every((s) => r.inputs.includes(s as EntityId)));
}

// ---- The energy working ----------------------------------------------------------------

export interface EnergyTerm {
  compound: Compound;
  phase: Phase;
  coefficient: number;
  /** The formation enthalpy used, kJ/mol. */
  fact: Fact<number | Range>;
}

export interface EnergyWorking {
  products: EnergyTerm[];
  reactants: EnergyTerm[];
}

/**
 * The terms of the reaction-enthalpy derivation, read from the derivation
 * itself (its inputs and weights), so the working shown is exactly the sum
 * the build checked. Null if any input can't be found.
 */
export function energyWorking(r: Reaction, data: ReactionData): EnergyWorking | null {
  const d = r.energy?.enthalpy?.derivation;
  if (!d || d.rule !== 'reaction-enthalpy' || !d.weights) return null;
  const byRecord = new Map<string, { compound: Compound; phase: Phase; fact: Fact<number | Range> }>();
  for (const c of data.compounds.values()) {
    for (const h of c.formationEnthalpies) byRecord.set(h.value.verification.recordId, { compound: c, phase: h.phase, fact: h.value });
  }
  const out: EnergyWorking = { products: [], reactants: [] };
  for (const [i, id] of d.inputs.entries()) {
    const found = byRecord.get(id);
    const w = d.weights[i]!;
    if (!found || !isRenderable(found.fact)) return null;
    (w > 0 ? out.products : out.reactants).push({ ...found, coefficient: Math.abs(w) });
  }
  return out;
}

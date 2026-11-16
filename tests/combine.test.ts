// Combine mode's logic, run on the real verified data: every entry can be
// found from what you'd pick, the energy working is exactly the checked sum,
// and the bond diagrams appear only where the verified numbers fit.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFormula } from '../app/src/data/chemistry';
import { derive } from '../app/src/data/derive';
import { buildData, energyWorking, entriesWith, findEntries, fromTokens, pickables } from '../app/src/data/reactions';
import type { Dataset, Element } from '../app/src/data/schema';
import { planBond, type AtomInfo } from '../app/src/ui/bond-diagram';
import { ROOT } from './integrity';

const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
const data = buildData(read<Dataset<'compounds'>>('data/verified/compounds.json'), read<Dataset<'reactions'>>('data/verified/reactions.json'));

/** Verified shells, valence and class for an element, read from its file. */
function info(symbol: string): AtomInfo | undefined {
  const file = readdirSync(join(ROOT, 'data/verified/elements')).find((f) => f.endsWith(`-${symbol}.json`));
  if (!file) return undefined;
  const e = read<Dataset<'elements'>>(`data/verified/elements/${file}`).items[0] as Element;
  if (!e.atom.shells || !e.valenceElectrons || !e.classification) return undefined;
  return { symbol, shells: e.atom.shells.value as number[], valence: e.valenceElectrons.value as number, metal: e.classification.value === 'Metal' };
}

describe('picking', () => {
  const items = pickables(data);

  it('gives every pickable substance its own token', () => {
    expect(new Set(items.map((p) => p.token)).size).toBe(items.length);
  });

  it('finds every entry from the tokens of its inputs, in any order', () => {
    const tokenOf = new Map(items.map((p) => [p.id, p.token]));
    for (const r of data.reactions) {
      const tokens = r.inputs.map((i) => tokenOf.get(i)!).reverse();
      const { ids, unknown } = fromTokens(tokens, data);
      expect(unknown, r.id).toEqual([]);
      expect(findEntries(ids, data).map((x) => x.id), r.id).toContain(r.id);
    }
  });

  it('reports a combination that has no entry instead of guessing', () => {
    const { ids } = fromTokens(['He', 'Ne'], data);
    expect(findEntries(ids, data)).toEqual([]);
    expect(fromTokens(['Xx'], data).unknown).toEqual(['Xx']);
  });

  it('shows both entries when the conditions decide what forms', () => {
    const { ids } = fromTokens(['C', 'O'], data);
    expect(findEntries(ids, data).map((r) => r.id).sort()).toEqual(['reaction:carbon-oxygen', 'reaction:carbon-oxygen-monoxide']);
  });

  it('hints at partners for a partial selection', () => {
    const { ids } = fromTokens(['Na'], data);
    expect(entriesWith(ids, data).length).toBeGreaterThan(0);
  });
});

describe('energy working', () => {
  it('is exactly the sum the build checked, for every reaction with an energy', () => {
    let n = 0;
    for (const r of data.reactions) {
      const h = r.energy?.enthalpy;
      if (!h) continue;
      const w = energyWorking(r, data);
      expect(w, r.id).not.toBeNull();
      const values = [...w!.reactants, ...w!.products].map((t) => t.fact.value);
      const weights = [...w!.reactants.map((t) => -t.coefficient), ...w!.products.map((t) => t.coefficient)];
      expect(derive('reaction-enthalpy', values, weights), r.id).toEqual(h.value);
      n++;
    }
    expect(n).toBeGreaterThan(30);
  });
});

describe('bond diagrams', () => {
  const planFor = (id: string) => {
    const r = data.reactions.find((x) => x.id === `reaction:${id}`)!;
    const product = data.compounds.get(r.products![0]!.substance)!;
    return r.bonding ? planBond(r.bonding.type.value, parseFormula(product.formula.value)!, info) : 'no verified bond type';
  };

  it('draws electrons moving for simple salts, with what is given equal to what is taken', () => {
    const nacl = planFor('sodium-chlorine');
    expect(nacl).toMatchObject({ kind: 'ionic', transfers: [{ from: 0, to: 1 }] });
    // Aluminum oxide has no verified bond type yet, so test the plan itself on the real atoms.
    const al2o3 = planBond('ionic', { Al: 2, O: 3 }, info);
    expect(al2o3).toMatchObject({ kind: 'ionic' });
    if (al2o3?.kind !== 'ionic') throw new Error('expected an ionic plan');
    expect(al2o3.atoms.map((a) => a.symbol)).toEqual(['Al', 'Al', 'O', 'O', 'O']);
    expect(al2o3.transfers).toHaveLength(6);
  });

  it('draws shared pairs for hydrogen compounds', () => {
    expect(planFor('hydrogen-oxygen')).toMatchObject({ kind: 'covalent', hydrogens: 2, lonePairs: 2 });
    expect(planFor('nitrogen-hydrogen')).toMatchObject({ kind: 'covalent', hydrogens: 3, lonePairs: 1 });
  });

  it('draws nothing where the picture would be wrong', () => {
    const fake = (symbol: string, shells: number[], valence: number, metal: boolean): AtomInfo => ({ symbol, shells, valence, metal });
    const atoms: Record<string, AtomInfo> = {
      Na: fake('Na', [2, 8, 1], 1, true),
      Cl: fake('Cl', [2, 8, 7], 7, false),
      O: fake('O', [2, 6], 6, false),
      H: fake('H', [1], 1, false),
      C: fake('C', [2, 4], 4, false),
    };
    const at = (s: string) => atoms[s];
    expect(planBond('ionic', { Na: 1, Cl: 2 }, at)).toBeNull(); // charges don't balance
    expect(planBond('covalent', { Na: 1, Cl: 1 }, at)).toBeNull(); // not a hydrogen compound
    expect(planBond('ionic', { C: 1, O: 2 }, at)).toBeNull(); // no metal
    expect(planBond('covalent', { C: 1, O: 2 }, at)).toBeNull(); // double bonds: not drawn
    expect(planBond('covalent', { O: 1, H: 3 }, at)).toBeNull(); // wrong count for oxygen
    expect(planBond('ionic', { Na: 1, Fe: 1 }, at)).toBeNull(); // missing data
    expect(planBond('covalent', { C: 1, H: 4 }, at)).toMatchObject({ kind: 'covalent', hydrogens: 4, lonePairs: 0 });
  });

  it('every diagram the real data produces is consistent', () => {
    let drawn = 0;
    for (const r of data.reactions) {
      if (!r.bonding || r.products?.length !== 1) continue;
      const product = data.compounds.get(r.products[0]!.substance)!;
      const plan = planBond(r.bonding.type.value, parseFormula(product.formula.value)!, info);
      if (!plan) continue;
      drawn++;
      if (plan.kind === 'ionic') {
        const gained = new Map<number, number>();
        for (const t of plan.transfers) gained.set(t.to, (gained.get(t.to) ?? 0) + 1);
        // Every non-metal ends with eight outer electrons.
        for (const [i, g] of gained) expect(plan.atoms[i]!.shells.at(-1)! + g, r.id).toBe(8);
      } else {
        expect(plan.center.shells.at(-1)! + plan.hydrogens, r.id).toBe(8);
      }
    }
    expect(drawn).toBeGreaterThan(5);
  });
});

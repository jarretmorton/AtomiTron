// Compounds and reactions: formula and equation arithmetic, the enthalpy
// rule, and the gate checks that tie a reaction's energy to its equation.
// The sample data is shaped like table salt but is test data only.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inLowestTerms, isBalanced, parseFormula, sameComposition } from '../app/src/data/chemistry';
import { derive, reactionEnthalpy } from '../app/src/data/derive';
import type { Compound, Reaction } from '../app/src/data/schema';
import { checkData, makeAjv, ROOT } from './integrity';
import { derived, fact, recordsFor } from './samples';

describe('formulas', () => {
  it.each<[string, Record<string, number>]>([
    ['NaCl', { Na: 1, Cl: 1 }],
    ['Cl2', { Cl: 2 }],
    ['C6H12O6', { C: 6, H: 12, O: 6 }],
    ['Ca(OH)2', { Ca: 1, O: 2, H: 2 }],
    ['NH4Cl', { N: 1, H: 4, Cl: 1 }],
    ['Al2(SO4)3', { Al: 2, S: 3, O: 12 }],
  ])('parses %s', (formula, atoms) => {
    expect(parseFormula(formula)).toEqual(atoms);
  });

  it.each(['', 'nacl', 'Na+', 'Na Cl', 'Ca(OH', 'Ca)OH(', '2H2O', 'H0', 'CuSO4.5H2O'])('rejects %j', (formula) => {
    expect(parseFormula(formula)).toBeNull();
  });

  it('matches a formula to its Hill-order spelling', () => {
    expect(sameComposition(parseFormula('NaCl')!, parseFormula('ClNa')!)).toBe(true);
    expect(sameComposition(parseFormula('Ca(OH)2')!, parseFormula('CaH2O2')!)).toBe(true);
    expect(sameComposition(parseFormula('NaCl')!, parseFormula('NaCl2')!)).toBe(false);
  });
});

describe('equations', () => {
  const t = (coefficient: number, formula: string) => ({ coefficient, composition: parseFormula(formula)! });

  it('checks the balance by counting atoms', () => {
    expect(isBalanced([t(2, 'Na'), t(1, 'Cl2')], [t(2, 'NaCl')])).toBe(true);
    expect(isBalanced([t(1, 'CH4'), t(2, 'O2')], [t(1, 'CO2'), t(2, 'H2O')])).toBe(true);
    expect(isBalanced([t(1, 'Na'), t(1, 'Cl2')], [t(1, 'NaCl')])).toBe(false);
    expect(isBalanced([t(1, 'H2'), t(1, 'O2')], [t(1, 'H2O')])).toBe(false);
  });

  it('wants the smallest whole-number coefficients', () => {
    expect(inLowestTerms([2, 1, 2])).toBe(true);
    expect(inLowestTerms([4, 2, 4])).toBe(false);
  });
});

describe('reaction enthalpy', () => {
  it('is products minus reactants, weighted by coefficient', () => {
    expect(reactionEnthalpy([0, 0, -411.12], [-2, -1, 2])).toBe(-822.24);
    expect(reactionEnthalpy([0, 0, -285.83], [-2, -1, 2])).toBe(-571.66);
    expect(reactionEnthalpy([-285.83, 0, 0], [-2, 2, 1])).toBe(571.66); // splitting water
  });

  it('rounds to the least precise input', () => {
    // -393.51 + 2(-285.83) - (-74.6) = -890.57, given to one decimal place
    expect(reactionEnthalpy([-74.6, 0, -393.51, -285.83], [-1, -2, 1, 2])).toBe(-890.6);
    expect(reactionEnthalpy([0.25, 0.1], [1, 1])).toBe(0.4); // 0.35: half rounds away from zero
    expect(reactionEnthalpy([-0.25, -0.1], [1, 1])).toBe(-0.4);
  });

  it("doesn't let an element's exact zero limit the precision", () => {
    expect(reactionEnthalpy([0, 0, -411.12], [-2, -1, 2])).toBe(-822.24);
    expect(reactionEnthalpy([0, 0], [-1, 1])).toBe(0);
  });

  it('has no floating-point drift', () => {
    expect(reactionEnthalpy([0.1, 0.2], [1, 1])).toBe(0.3);
  });

  it('names the direction from the sign', () => {
    expect(derive('energy-direction', [-822.24])).toBe('exothermic');
    expect(derive('energy-direction', [571.66])).toBe('endothermic');
    expect(() => derive('energy-direction', [0])).toThrow(/no direction/);
    expect(() => derive('reaction-enthalpy', [1, 2])).toThrow(/weights/);
  });
});

// ---- Gate -------------------------------------------------------------------

const NIST = 'https://webbook.nist.gov/cgi/cbook.cgi?ID=C0000000';
const CONCEPT = 'https://chem.libretexts.org/Bookshelves';
const text = (id: string) => fact('Test sample text, not a real claim.', id, { source: { url: CONCEPT, retrieved: '2026-11-15' } });

function substance(n: number, key: string, formula: string, state: string, phase: 's' | 'l' | 'g', element?: string, written?: string): Compound {
  const stateFact = fact(state, `${key}.state`);
  return {
    id: `compound:cid-${n}`,
    ...(element ? { element: `element:${element}` as const } : {}),
    name: fact(`Test ${key}`, `${key}.name`),
    formula: fact(formula, `${key}.formula`, written ? { source: { url: NIST, retrieved: '2026-11-15', asWritten: written } } : {}),
    standardState: stateFact,
    formationEnthalpies: [{
      phase,
      value: element
        ? { ...derived(0, `${key}.dfH`, 'zero-for-element-in-standard-state', [`${key}.state`]), unit: 'kJ/mol' }
        : fact(-411.12, `${key}.dfH`, { unit: 'kJ/mol', source: { url: NIST, retrieved: '2026-11-15' } }),
    }],
    uses: [text(`${key}.use`)],
    hazards: [],
  };
}

const sampleCompounds = (): Compound[] => [
  substance(1, 'na', 'Na', 'solid', 's', 'Na'),
  substance(2, 'cl2', 'Cl2', 'gas', 'g', 'Cl'),
  substance(3, 'nacl', 'NaCl', 'solid', 's', undefined, 'ClNa'),
];

const sampleReaction = (): Reaction => ({
  id: 'reaction:test-salt',
  title: 'Test reaction',
  inputs: ['element:Na', 'element:Cl'],
  kind: 'reaction',
  reactants: [
    { substance: 'compound:cid-1', coefficient: 2, phase: 's' },
    { substance: 'compound:cid-2', coefficient: 1, phase: 'g' },
  ],
  products: [{ substance: 'compound:cid-3', coefficient: 2, phase: 's' }],
  summary: [text('rx.summary')],
  bonding: { type: fact('ionic', 'rx.bond', { source: { url: CONCEPT, retrieved: '2026-11-15' } }), why: [text('rx.bond.why')] },
  energy: {
    enthalpy: {
      ...derived(-822.24, 'rx.dH', 'reaction-enthalpy', ['na.dfH', 'cl2.dfH', 'nacl.dfH']),
      unit: 'kJ',
      derivation: { rule: 'reaction-enthalpy', inputs: ['na.dfH', 'cl2.dfH', 'nacl.dfH'], weights: [-2, -1, 2] },
    },
    direction: derived('exothermic', 'rx.dir', 'energy-direction', ['rx.dH']),
    trigger: text('rx.trigger'),
  },
  hazard: { why: [text('rx.hazard')] },
});

function gate(edit: (c: Compound[], r: Reaction) => void = () => {}): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'atomitron-rx-'));
  const compounds = sampleCompounds();
  const reaction = sampleReaction();
  edit(compounds, reaction);
  const records = [...compounds.flatMap(recordsFor), ...recordsFor(reaction)];
  mkdirSync(join(dir, 'verified'));
  mkdirSync(join(dir, 'records'));
  const write = (p: string, kind: string, items: unknown[]) =>
    writeFileSync(join(dir, p), JSON.stringify({ schemaVersion: 4, kind, items }));
  write('verified/compounds.json', 'compounds', compounds);
  write('verified/reactions.json', 'reactions', [reaction]);
  write('records/records.json', 'verification-records', records);
  return checkData(join(dir, 'verified'), join(dir, 'records'));
}

describe('gate: compounds and reactions', () => {
  it('passes a balanced reaction whose energy matches its equation', () => {
    expect(gate()).toEqual([]);
  });

  it.each<[string, (c: Compound[], r: Reaction) => void, RegExp]>([
    ['the equation does not balance', (_c, r) => (r.products![0]!.coefficient = 1), /doesn't balance/],
    [
      'the coefficients share a factor',
      (_c, r) => {
        r.reactants![0]!.coefficient = 4;
        r.reactants![1]!.coefficient = 2;
        r.products![0]!.coefficient = 4;
      },
      /common factor/,
    ],
    ['a species is not a verified compound', (_c, r) => (r.products![0]!.substance = 'compound:cid-99'), /isn't a verified compound/],
    ['the weights do not match the coefficients', (_c, r) => (r.energy!.enthalpy!.derivation!.weights = [-1, -1, 2]), /don't match the equation/],
    ['the enthalpy is miscalculated', (_c, r) => (r.energy!.enthalpy!.value = -411.12), /reaction-enthalpy gives -822.24/],
    ['the direction is wrong', (_c, r) => (r.energy!.direction!.value = 'endothermic'), /energy-direction gives "exothermic"/],
    ['a species has no enthalpy for its phase', (_c, r) => (r.products![0]!.phase = 'l'), /no formation enthalpy for compound:cid-3\(l\)/],
    ['a hazard note contains a number', (_c, r) => (r.hazard!.why[0]!.value = 'Use 5 grams.'), /hazard\.why\[0\] contains a number/],
    ['the trigger contains a number', (_c, r) => (r.energy!.trigger!.value = 'Heat to 400 degrees.'), /energy\.trigger contains a number/],
    ['the source spelling holds different atoms', (c) => (c[2]!.formula.source.asWritten = 'Cl2Na'), /holds different atoms/],
    ['an element link does not fit the formula', (c) => (c[2]!.element = 'element:Na'), /marked as element:Na/],
    ['a compound is given a zero enthalpy', (c) => (c[2]!.formationEnthalpies[0]!.value = c[0]!.formationEnthalpies[0]!.value), /also used by|only for an element/],
  ])('fails when %s', (_, edit, expected) => {
    expect(gate(edit).join('\n')).toMatch(expected);
  });

  it('accepts a reaction that says its energy is unavailable', () => {
    expect(gate((_c, r) => (r.energy = { unavailable: 'The sources have no formation enthalpy for a product.', trigger: r.energy!.trigger }))).toEqual([]);
  });
});

describe('reaction schema', () => {
  const schema = makeAjv().getSchema('urn:atomitron:schema:reaction')!;

  it('accepts the sample, and a no-reaction entry', () => {
    expect(schema(sampleReaction()), JSON.stringify(schema.errors)).toBe(true);
    const none = { id: 'reaction:test-none', title: 'Test', inputs: ['element:He', 'element:O'], kind: 'no-reaction', summary: [text('n.s')], whyNot: [text('n.w')] };
    expect(schema(none), JSON.stringify(schema.errors)).toBe(true);
  });

  it.each<[string, (r: Reaction) => void]>([
    ['a reaction without an energy layer', (r) => delete r.energy],
    ['an enthalpy together with "unavailable"', (r) => (r.energy!.unavailable = 'x')],
    ['an enthalpy without a direction', (r) => delete r.energy!.direction],
    ['a no-reaction entry with products', (r) => ((r.kind = 'no-reaction'), (r.whyNot = [text('w')]))],
    ['a single input', (r) => (r.inputs = ['element:Na'])],
    ['a zero coefficient', (r) => (r.products![0]!.coefficient = 0)],
  ])('rejects %s', (_, edit) => {
    const r = sampleReaction();
    edit(r);
    expect(schema(r)).toBe(false);
  });
});

// The pipeline's staged output (data/staged/reactions.json) isn't published
// yet, but its arithmetic is checked here with the TypeScript rules, which
// were written independently of the Python ones that produced it.
describe('staged reaction energies', () => {
  const file = join(ROOT, 'data', 'staged', 'reactions.json');
  const staged = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { substances: [], reactions: [], records: [] };
  const value = new Map<string, unknown>(staged.records.map((r: { id: string; claimedValue: unknown }) => [r.id, r.claimedValue]));
  const formula = new Map<string, string>(staged.substances.map((s: { id: string; formula: { value: string } }) => [s.id, s.formula.value]));

  it('every staged equation balances', () => {
    for (const r of staged.reactions.filter((x: Reaction) => x.kind === 'reaction')) {
      const side = (list: Reaction['reactants']) => list!.map((s) => ({ coefficient: s.coefficient, composition: parseFormula(formula.get(s.substance)!)! }));
      expect(isBalanced(side(r.reactants), side(r.products)), r.id).toBe(true);
    }
  });

  it('every staged enthalpy and direction recomputes to the same value', () => {
    let n = 0;
    for (const r of staged.reactions) {
      const h = r.energy?.enthalpy;
      if (!h) continue;
      const inputs = h.derivation.inputs.map((id: string) => value.get(id) as number);
      expect(derive('reaction-enthalpy', inputs, h.derivation.weights), r.id).toBe(h.value);
      expect(derive('energy-direction', [h.value]), r.id).toBe(r.energy.direction.value);
      n++;
    }
    if (staged.reactions.length) expect(n).toBeGreaterThan(0);
  });
});

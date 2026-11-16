// Derivation rules for facts calculated from other verified facts. Each rule
// is plain arithmetic over its inputs. The pipeline computes derived values,
// and the build gate recomputes them here from the verified inputs, so the
// two must agree. See verification/methodology.md.

import type { Counts, DerivationRule, FactValue, Range } from './schema';

export class DerivationError extends Error {}

const CAPACITY = { s: 2, p: 6, d: 10, f: 14 } as const;
type Letter = keyof typeof CAPACITY;
/** Lowest shell each subshell type exists in: 1s, 2p, 3d, 4f. */
const FIRST_SHELL: Record<Letter, number> = { s: 1, p: 2, d: 3, f: 4 };

const CORES: Record<string, string> = {
  He: '1s2',
  Ne: '[He] 2s2 2p6',
  Ar: '[Ne] 3s2 3p6',
  Kr: '[Ar] 3d10 4s2 4p6',
  Xe: '[Kr] 4d10 5s2 5p6',
  Rn: '[Xe] 4f14 5d10 6s2 6p6',
};

/** Subshell occupancy, e.g. "3d" -> 10. */
export type Occupancy = Map<string, number>;

/**
 * Parses an electron configuration such as "[Ar] 3d10 4s1". It also accepts
 * the superscript-less form PubChem serves ("[Ar]4s13d10"). Counts are split
 * by subshell capacity, with backtracking, so "4s13d10" reads as 4s1 3d10.
 * The "(predicted)", "(calculated)" and "probably" markers and stray whitespace (including zero-width spaces)
 * are ignored. Returns null if the text isn't a valid configuration.
 */
export function parseConfiguration(text: string): Occupancy | null {
  let s = text.replace(/\(?(predicted|calculated)\)?|probably/gi, '').replace(/[\s\u200b]+/g, '');
  const occ: Occupancy = new Map();
  const core = /^\[(He|Ne|Ar|Kr|Xe|Rn)\]/.exec(s);
  if (core) {
    const inner = parseConfiguration(CORES[core[1]!]!);
    if (!inner) return null;
    for (const [k, v] of inner) occ.set(k, v);
    s = s.slice(core[0].length);
  }
  const body = parseBody(s, 0);
  if (!body) return null;
  for (const [k, v] of body) {
    if (occ.has(k)) return null; // the same subshell listed twice
    occ.set(k, v);
  }
  return occ.size > 0 ? occ : null;
}

function parseBody(s: string, i: number): [string, number][] | null {
  if (i === s.length) return [];
  const m = /^([1-7])([spdf])/.exec(s.slice(i));
  if (!m) return null;
  const n = Number(m[1]);
  const letter = m[2] as Letter;
  if (n < FIRST_SHELL[letter]) return null; // e.g. "2d" doesn't exist
  const start = i + 2;
  for (const len of [2, 1]) {
    const digits = s.slice(start, start + len);
    if (digits.length !== len || !/^[1-9]\d?$/.test(digits)) continue;
    const count = Number(digits);
    if (count > CAPACITY[letter]) continue;
    const rest = parseBody(s, start + len);
    if (rest) return [[`${n}${letter}`, count], ...rest];
  }
  return null;
}

export function electronCount(occ: Occupancy): number {
  let total = 0;
  for (const v of occ.values()) total += v;
  return total;
}

/** Electrons per shell (principal quantum number n), innermost first. */
export function shellCounts(occ: Occupancy): Counts {
  const shells: number[] = [];
  for (const [sub, count] of occ) {
    const n = Number(sub[0]);
    while (shells.length < n) shells.push(0);
    shells[n - 1]! += count;
  }
  return shells;
}

/** One shell's part of the working: its subshells and their sum. */
export interface ShellWorking {
  shell: number;
  parts: { subshell: string; electrons: number }[];
  total: number;
}

const LETTERS = 'spdf';

/**
 * The working behind shellCounts(): each shell's subshells (s, p, d, f) and
 * their sum, innermost first. Shown on the page so a reader can redo the
 * addition (checkpoint 1 finding).
 */
export function shellWorking(occ: Occupancy): ShellWorking[] {
  const shells = new Map<number, ShellWorking>();
  for (const [subshell, electrons] of occ) {
    const shell = Number(subshell[0]);
    const w = shells.get(shell) ?? { shell, parts: [], total: 0 };
    w.parts.push({ subshell, electrons });
    w.total += electrons;
    shells.set(shell, w);
  }
  const out = [...shells.values()].sort((a, b) => a.shell - b.shell);
  for (const w of out) w.parts.sort((a, b) => LETTERS.indexOf(a.subshell[1]!) - LETTERS.indexOf(b.subshell[1]!));
  return out;
}

/** The working behind valenceMainGroup(): the outer shell's s and p electrons. */
export function valenceWorking(occ: Occupancy): ShellWorking {
  const all = shellWorking(occ);
  const outer = all.filter((w) => w.parts.some((p) => p.subshell[1] === 's' || p.subshell[1] === 'p')).at(-1)!;
  const parts = outer.parts.filter((p) => p.subshell[1] === 's' || p.subshell[1] === 'p');
  return { shell: outer.shell, parts, total: parts.reduce((sum, p) => sum + p.electrons, 0) };
}

const MAIN_GROUPS = new Set([1, 2, 13, 14, 15, 16, 17, 18]);

/**
 * Valence electrons for main-group elements: the s and p electrons in the
 * outermost shell. Not defined here for transition metals, lanthanides or
 * actinides, where textbooks disagree on a single number.
 */
export function valenceMainGroup(occ: Occupancy, group: number): number {
  if (!MAIN_GROUPS.has(group)) {
    throw new DerivationError(`valence is only derived for main groups, not group ${group}`);
  }
  let outer = 0;
  for (const sub of occ.keys()) if (sub[1] === 's' || sub[1] === 'p') outer = Math.max(outer, Number(sub[0]));
  let count = 0;
  for (const [sub, v] of occ) if (Number(sub[0]) === outer && (sub[1] === 's' || sub[1] === 'p')) count += v;
  return count;
}

function int(v: FactValue | undefined, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new DerivationError(`${what} must be an integer`);
  return v;
}

function config(v: FactValue | undefined): Occupancy {
  const occ = typeof v === 'string' ? parseConfiguration(v) : null;
  if (!occ) throw new DerivationError(`unparseable electron configuration: ${JSON.stringify(v)}`);
  return occ;
}

function decimals(v: number): number {
  const [, frac = ''] = String(v).split('e')[0]!.split('.');
  return frac.length;
}

/**
 * Reaction enthalpy from formation enthalpies: the sum of each value times
 * its weight (the coefficient: positive for products, negative for
 * reactants). The arithmetic is done in whole numbers, so 0.1 + 0.2 can't
 * go wrong, and the result is rounded half away from zero to the decimal
 * places of the least precise input, so it never claims more precision than
 * its inputs. A value of exactly 0 is an element in its standard state: it
 * is exact by definition, so it doesn't limit the precision.
 */
export function reactionEnthalpy(values: (number | Range)[], weights: number[]): number | Range {
  if (values.length !== weights.length) throw new DerivationError('one weight is needed per formation enthalpy');
  // An input may be a range, where two reviewed sources differ. The result is
  // then the range from the lowest possible sum to the highest.
  const ends = values.map((v) => (typeof v === 'number' ? { min: v, max: v } : v));
  const places = ends.flatMap((e) => [e.min, e.max]).filter((v) => v !== 0).map(decimals);
  if (places.length === 0) return 0;
  const most = Math.max(...places);
  const least = Math.min(...places);
  const step = 10 ** (most - least);
  const total = (pick: (e: Range, w: number) => number) => {
    let sum = 0;
    ends.forEach((e, i) => {
      sum += Math.round(pick(e, weights[i]!) * 10 ** most) * weights[i]!;
    });
    return (Math.sign(sum) * Math.round(Math.abs(sum) / step)) / 10 ** least || 0;
  };
  // A positive weight is lowest at the input's minimum; a negative one at its maximum.
  const min = total((e, w) => (w > 0 ? e.min : e.max));
  const max = total((e, w) => (w > 0 ? e.max : e.min));
  return min === max ? min : { min, max };
}

function isRangeValue(v: FactValue | undefined): v is Range {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof v.min === 'number' && typeof v.max === 'number';
}

/** Room temperature for the state rule, in °C (standard conditions). */
export const ROOM_TEMPERATURE_C = 25;

export function stateAtRoomTemperature(meltingC: number, boilingC?: number): 'solid' | 'liquid' | 'gas' {
  if (boilingC !== undefined && meltingC >= boilingC) throw new DerivationError('melting point must be below boiling point');
  if (meltingC > ROOM_TEMPERATURE_C) return 'solid';
  if (boilingC === undefined) throw new DerivationError('below room temperature, the state also needs the boiling point');
  if (boilingC < ROOM_TEMPERATURE_C) return 'gas';
  if (meltingC < ROOM_TEMPERATURE_C && boilingC > ROOM_TEMPERATURE_C) return 'liquid';
  throw new DerivationError('a melting or boiling point at exactly room temperature has no single state');
}

function text(v: FactValue | undefined, what: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new DerivationError(`${what} must be text`);
  return v;
}

function listed(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The plain-language summary of an equation. One reactant breaks down; one
 * product is made by combining; otherwise the reactants react to make the
 * products. With no products, it is a no-reaction pair.
 */
export function summaryFromEquation(names: string[], weights: number[]): string {
  if (weights.some((w) => w !== 1 && w !== -1)) throw new DerivationError('weights must be -1 (reactant) or 1 (product)');
  const reactants = names.filter((_, i) => weights[i] === -1);
  const products = names.filter((_, i) => weights[i] === 1);
  if (reactants.length === 0) throw new DerivationError('an equation needs at least one reactant');
  if (weights.indexOf(1) !== -1 && weights.lastIndexOf(-1) > weights.indexOf(1)) {
    throw new DerivationError('reactants must come before products');
  }
  let sentence: string;
  if (products.length === 0) {
    if (reactants.length < 2) throw new DerivationError('a no-reaction pair needs two substances');
    sentence = `${listed(reactants)} don't react with each other.`;
  } else if (reactants.length === 1) {
    sentence = `${reactants[0]} breaks down into ${listed(products)}.`;
  } else if (products.length === 1) {
    sentence = `${listed(reactants)} combine to make ${products[0]}.`;
  } else {
    sentence = `${listed(reactants)} react to make ${listed(products)}.`;
  }
  return sentence[0]!.toUpperCase() + sentence.slice(1);
}

function num(v: FactValue | undefined, what: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DerivationError(`${what} must be a number`);
  return v;
}

const RULES: Record<DerivationRule, { arity: number; run: (inputs: FactValue[], weights?: number[]) => FactValue }> = {
  // An element in its standard state has zero formation enthalpy, by definition.
  'zero-for-element-in-standard-state': {
    arity: 1,
    run: ([state]) => {
      if (state !== 'solid' && state !== 'liquid' && state !== 'gas') throw new DerivationError('standard state must be solid, liquid or gas');
      return 0;
    },
  },
  'reaction-enthalpy': {
    arity: -1, // one input per species
    run: (inputs, weights) => {
      if (!weights) throw new DerivationError('reaction-enthalpy needs weights');
      return reactionEnthalpy(inputs.map((v) => (isRangeValue(v) ? v : num(v, 'formation enthalpy'))), weights);
    },
  },
  // Solid, liquid or gas at 25 °C, from the melting and boiling points in
  // °C. A melting point alone is enough for a solid.
  'state-at-room-temperature': {
    arity: -1,
    run: (inputs) => {
      if (inputs.length === 1) {
        // A range (a substance that melts or decomposes over a span) is a
        // solid if even its lowest point is above room temperature.
        const mp = inputs[0];
        if (isRangeValue(mp)) {
          if (mp.min > ROOM_TEMPERATURE_C) return 'solid';
          throw new DerivationError('a melting range reaching room temperature has no single state');
        }
        return stateAtRoomTemperature(num(mp, 'melting point'));
      }
      if (inputs.length === 2) return stateAtRoomTemperature(num(inputs[0], 'melting point'), num(inputs[1], 'boiling point'));
      throw new DerivationError('state-at-room-temperature takes a melting point, and optionally a boiling point');
    },
  },
  // "Sodium and chlorine combine to make sodium chloride." from the names
  // of the reactants (weight -1) and products (weight 1).
  'summary-from-equation': {
    arity: -1,
    run: (inputs, weights) => {
      if (!weights || weights.length !== inputs.length) throw new DerivationError('summary-from-equation needs one weight per name');
      return summaryFromEquation(inputs.map((v) => text(v, 'name')), weights);
    },
  },
  'energy-direction': {
    arity: 1,
    run: ([h]) => {
      const { min, max } = isRangeValue(h) ? h : { min: num(h, 'reaction enthalpy'), max: num(h, 'reaction enthalpy') };
      if (max < 0) return 'exothermic';
      if (min > 0) return 'endothermic';
      throw new DerivationError('a reaction enthalpy of zero, or a range that spans zero, has no direction');
    },
  },
  'protons-equal-atomic-number': { arity: 1, run: ([z]) => int(z, 'atomic number') },
  'electrons-equal-atomic-number': { arity: 1, run: ([z]) => int(z, 'atomic number') },
  'neutrons-from-mass-number': {
    arity: 2,
    run: ([a, z]) => {
      const n = int(a, 'mass number') - int(z, 'atomic number');
      if (n < 0) throw new DerivationError('mass number is smaller than atomic number');
      return n;
    },
  },
  'shells-from-configuration': { arity: 1, run: ([c]) => shellCounts(config(c)) },
  'valence-main-group': { arity: 2, run: ([c, g]) => valenceMainGroup(config(c), int(g, 'group')) },
};

/** Recomputes a derived value from its input values, in the rule's order. */
export function derive(rule: DerivationRule, inputs: FactValue[], weights?: number[]): FactValue {
  const r = RULES[rule];
  if (r.arity >= 0 && inputs.length !== r.arity) {
    throw new DerivationError(`${rule} takes ${r.arity} input(s), got ${inputs.length}`);
  }
  return r.run(inputs, weights);
}

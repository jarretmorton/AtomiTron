// Derivation rules for facts calculated from other verified facts. Each rule
// is plain arithmetic over its inputs. The pipeline computes derived values,
// and the build gate recomputes them here from the verified inputs, so the
// two must agree. See verification/methodology.md.

import type { Counts, DerivationRule, FactValue } from './schema';

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

const RULES: Record<DerivationRule, { arity: number; run: (inputs: FactValue[]) => FactValue }> = {
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
export function derive(rule: DerivationRule, inputs: FactValue[]): FactValue {
  const r = RULES[rule];
  if (inputs.length !== r.arity) {
    throw new DerivationError(`${rule} takes ${r.arity} input(s), got ${inputs.length}`);
  }
  return r.run(inputs);
}

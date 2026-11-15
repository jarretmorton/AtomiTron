// Formula and equation arithmetic for compounds and reactions. Pure code, no
// chemistry knowledge beyond counting atoms: the build uses it to check that
// every equation balances and that a formula spelled two ways (NaCl and
// PubChem's ClNa) holds the same atoms. See verification/methodology.md.

/** Atoms in a formula, e.g. Ca(OH)2 -> { Ca: 1, O: 2, H: 2 }. */
export type Composition = Record<string, number>;

/**
 * Parses a formula with element symbols, counts and round brackets, such as
 * "NaCl", "C6H12O6" or "Ca(OH)2". Returns null for anything else: charges,
 * dots, square brackets and unknown characters aren't accepted.
 */
export function parseFormula(formula: string): Composition | null {
  let i = 0;
  const group = (closing: boolean): Composition | null => {
    const out: Composition = {};
    let any = false;
    while (i < formula.length) {
      const ch = formula[i]!;
      if (ch === ')') {
        if (!closing) return null;
        break;
      }
      let part: Composition | null;
      if (ch === '(') {
        i++;
        part = group(true);
        if (!part || formula[i] !== ')') return null;
        i++;
      } else {
        const m = /^[A-Z][a-z]?/.exec(formula.slice(i));
        if (!m) return null;
        i += m[0].length;
        part = { [m[0]]: 1 };
      }
      const n = /^[1-9][0-9]*/.exec(formula.slice(i));
      if (n) i += n[0].length;
      for (const [el, count] of Object.entries(part)) out[el] = (out[el] ?? 0) + count * (n ? Number(n[0]) : 1);
      any = true;
    }
    return any ? out : null;
  };
  const result = group(false);
  return result && i === formula.length ? result : null;
}

export function sameComposition(a: Composition, b: Composition): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => a[k] === b[k]);
}

export interface Term {
  coefficient: number;
  composition: Composition;
}

/** Total atoms on one side of an equation. */
export function atomTotals(terms: Term[]): Composition {
  const out: Composition = {};
  for (const t of terms) {
    for (const [el, n] of Object.entries(t.composition)) out[el] = (out[el] ?? 0) + n * t.coefficient;
  }
  return out;
}

/** True when both sides hold the same atoms. */
export function isBalanced(reactants: Term[], products: Term[]): boolean {
  return sameComposition(atomTotals(reactants), atomTotals(products));
}

/** The coefficients share no common factor (2 H2 + O2 -> 2 H2O, not 4 + 2 -> 4). */
export function inLowestTerms(coefficients: number[]): boolean {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  return coefficients.reduce(gcd) === 1;
}

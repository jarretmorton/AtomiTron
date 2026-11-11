// Turning verified values into display text. Formatting never adds precision:
// numbers show the digits the source gave, and conversions keep them
// (verification/methodology.md, section 10).

import { isRange } from '../data/facts';
import type { Fact } from '../data/schema';
import { getTempUnit, showTemperature, tempUnitOf } from '../units';

const MINUS = '−';

/** A number as stored, with a real minus sign and no exponent notation. */
export function num(v: number): string {
  let s = String(v);
  if (/e/i.test(s)) s = v.toFixed(Math.min(20, Math.max(0, -Math.floor(Math.log10(Math.abs(v))) + 6))).replace(/0+$/, '');
  return s.replace('-', MINUS);
}

/** Fraction to percent by shifting the decimal point, so 0.7576 -> "75.76%". */
export function percent(v: number): string {
  const [int = '0', frac = ''] = String(v).split('.');
  const digits = int + frac.padEnd(2, '0'); // "0" + "7576"
  const point = int.length + 2; // the decimal point moves two places right
  const whole = digits.slice(0, point).replace(/^0+(?=\d)/, '');
  const rest = digits.slice(point);
  return `${whole}${rest ? `.${rest}` : ''}%`;
}

const HALF_LIFE_UNITS: Record<string, string> = {
  ys: 'yoctoseconds', zs: 'zeptoseconds', as: 'attoseconds', fs: 'femtoseconds', ps: 'picoseconds',
  ns: 'nanoseconds', us: 'microseconds', ms: 'milliseconds', s: 'seconds', m: 'minutes', h: 'hours',
  d: 'days', y: 'years', ky: 'thousand years', My: 'million years', Gy: 'billion years',
  Ty: 'trillion years', Py: 'quadrillion years', Ey: 'quintillion years', Zy: 'sextillion years',
  Yy: 'septillion years',
};

export function halfLifeText(f: Fact): string {
  if (typeof f.value === 'string') return f.value; // "Stable"
  return `${num(f.value as number)} ${HALF_LIFE_UNITS[f.unit ?? ''] ?? f.unit ?? ''}`.trim();
}

/** "[Ar] 3d10 4s1" with the electron counts as superscripts. */
export function configuration(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const [i, token] of text.split(' ').entries()) {
    if (i > 0) frag.append(' ');
    const m = /^(\d[spdf])(\d+)$/.exec(token);
    if (!m) {
      frag.append(token);
      continue;
    }
    frag.append(m[1]!);
    const sup = document.createElement('sup');
    sup.textContent = m[2]!;
    frag.append(sup);
  }
  return frag;
}

export interface Shown {
  text: string | Node;
  /** e.g. "converted from 97.8 °C" */
  note?: string;
}

/** Default display for a verified fact's value and unit. */
export function showFact(f: Fact): Shown {
  const v = f.value;
  const temp = tempUnitOf(f.unit);
  if (temp && (typeof v === 'number' || isRange(v))) {
    const t = showTemperature(v, temp, getTempUnit());
    return { text: t.text, note: t.convertedFrom ?? undefined };
  }
  const unit = f.unit ? ` ${f.unit}` : '';
  if (isRange(v)) return { text: `${num(v.min)} to ${num(v.max)}${unit}` };
  if (Array.isArray(v)) return { text: v.join(', ') };
  if (typeof v === 'number') return { text: `${num(v)}${unit}` };
  return { text: `${v}${unit}` };
}

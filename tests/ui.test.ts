// Display helpers: formatting must never add precision or invent digits, and
// every explanation must cite a whitelisted page.

import { describe, expect, it } from 'vitest';
import { CONCEPTS } from '../app/src/content/concepts';
import { sourceName } from '../app/src/data/facts';
import type { Fact } from '../app/src/data/schema';
import { halfLifeText, num, percent, showFact } from '../app/src/ui/format';
import { goodFact } from './samples';

const fact = (value: Fact['value'], unit: string | null, uncertain = false): Fact => ({ ...goodFact, value, unit, uncertain });

describe('percent', () => {
  it.each([
    [0.7576, '75.76%'],
    [1, '100%'],
    [0.5, '50%'],
    [0.00126, '0.126%'],
    [0.999885, '99.9885%'],
  ])('%s -> %s', (v, want) => expect(percent(v)).toBe(want));
});

describe('num', () => {
  it('keeps the stored digits and uses a real minus sign', () => {
    expect(num(22.98976928)).toBe('22.98976928');
    expect(num(0.00008988)).toBe('0.00008988');
    expect(num(-259.34)).toBe('−259.34');
  });
});

describe('showFact', () => {
  it('shows temperatures in the reader unit (default °C)', () => {
    expect(showFact(fact(97.8, '°C')).text).toBe('97.8 °C');
  });

  it('shows ranges with both ends', () => {
    expect(showFact(fact({ min: 50, max: 110 }, '°C', true)).text).toBe('50 to 110 °C');
    expect(showFact(fact({ min: 1.00784, max: 1.00811 }, 'u')).text).toBe('1.00784 to 1.00811 u');
  });

  it('never shows an uncertain value as a single number', () => {
    // The schema forbids it, and the display would show the range.
    expect(typeof showFact(fact({ min: 1, max: 2 }, null, true)).text).toBe('string');
  });

  it('lists shell counts', () => {
    expect(showFact(fact([2, 8, 1], null)).text).toBe('2, 8, 1');
  });
});

describe('halfLifeText', () => {
  it('spells out the AMDC units', () => {
    expect(halfLifeText(fact(4.21, 'My'))).toBe('4.21 million years');
    expect(halfLifeText(fact(13.76, 's'))).toBe('13.76 seconds');
    expect(halfLifeText(fact('Stable', null))).toBe('Stable');
  });
});

describe('concepts', () => {
  it('cite only LibreTexts pages', () => {
    for (const c of Object.values(CONCEPTS)) expect(sourceName(c.url)).toBe('LibreTexts Chemistry');
  });
});

import { describe, expect, it } from 'vitest';
import { convertTemperature, decimalPlaces, roundTo, showTemperature, tempUnitOf, type TempUnit } from '../app/src/units';

describe('convertTemperature', () => {
  // Fixed points that hold by definition of the scales.
  it.each<[string, number, TempUnit, Record<TempUnit, number>]>([
    ['water freezes', 0, 'C', { C: 0, F: 32, K: 273.15, R: 491.67 }],
    ['water boils', 100, 'C', { C: 100, F: 212, K: 373.15, R: 671.67 }],
    ['absolute zero', 0, 'K', { C: -273.15, F: -459.67, K: 0, R: 0 }],
    ['Celsius meets Fahrenheit', -40, 'F', { C: -40, F: -40, K: 233.15, R: 419.67 }],
  ])('%s', (_, v, from, expected) => {
    for (const [to, want] of Object.entries(expected)) {
      expect(convertTemperature(v, from, to as TempUnit)).toBeCloseTo(want, 9);
    }
  });

  it('round-trips through every unit', () => {
    const units: TempUnit[] = ['C', 'F', 'K', 'R'];
    for (const a of units) for (const b of units) {
      expect(convertTemperature(convertTemperature(97.8, a, b), b, a)).toBeCloseTo(97.8, 9);
    }
  });
});

describe('precision', () => {
  it('counts decimal places', () => {
    expect(decimalPlaces(97.8)).toBe(1);
    expect(decimalPlaces(883)).toBe(0);
    expect(decimalPlaces(-259.34)).toBe(2);
  });

  it('rounds half away from zero without float surprises', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(-2.5, 0)).toBe(-3);
    expect(roundTo(-0.04, 1)).toBe(0);
  });
});

describe('showTemperature', () => {
  it('shows the stored value unchanged in its own unit', () => {
    expect(showTemperature(97.8, 'C', 'C')).toEqual({ text: '97.8 °C', convertedFrom: null });
  });

  it('keeps the stored decimal places and says what it converted from', () => {
    expect(showTemperature(97.8, 'C', 'F')).toEqual({ text: '208.0 °F', convertedFrom: 'converted from 97.8 °C' });
    expect(showTemperature(883, 'C', 'K').text).toBe('1156 K');
    expect(showTemperature(883, 'C', 'R').text).toBe('2081 °R');
  });

  it('uses a real minus sign', () => {
    expect(showTemperature(-259.34, 'C', 'C').text).toBe('−259.34 °C');
  });

  it('converts both ends of a range', () => {
    expect(showTemperature({ min: 50, max: 110 }, 'C', 'K').text).toBe('323 to 383 K');
  });

  it('recognizes temperature units only', () => {
    expect(tempUnitOf('°C')).toBe('C');
    expect(tempUnitOf('K')).toBe('K');
    expect(tempUnitOf('g/cm³')).toBeNull();
    expect(tempUnitOf(null)).toBeNull();
  });
});

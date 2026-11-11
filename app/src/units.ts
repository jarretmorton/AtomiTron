// Temperature display units: a reader setting (°C, °F, K, °R). Values are
// stored as the source states them. Conversion is exact arithmetic, because
// the scales are defined in terms of each other. A converted value keeps the
// stored value's decimal places, so it never claims more precision than the
// source (verification/methodology.md, section 4).

import type { Range } from './data/schema';

export type TempUnit = 'C' | 'F' | 'K' | 'R';

export const TEMP_UNITS: Record<TempUnit, { symbol: string; name: string }> = {
  C: { symbol: '°C', name: 'Celsius' },
  F: { symbol: '°F', name: 'Fahrenheit' },
  K: { symbol: 'K', name: 'Kelvin' },
  R: { symbol: '°R', name: 'Rankine' },
};

/** The TempUnit for a stored fact unit, or null if it isn't a temperature. */
export function tempUnitOf(unit: string | null): TempUnit | null {
  const found = (Object.keys(TEMP_UNITS) as TempUnit[]).find((u) => TEMP_UNITS[u].symbol === unit);
  return found ?? null;
}

function toKelvin(v: number, from: TempUnit): number {
  switch (from) {
    case 'K':
      return v;
    case 'C':
      return v + 273.15;
    case 'F':
      return ((v - 32) * 5) / 9 + 273.15;
    case 'R':
      return (v * 5) / 9;
  }
}

function fromKelvin(k: number, to: TempUnit): number {
  switch (to) {
    case 'K':
      return k;
    case 'C':
      return k - 273.15;
    case 'F':
      return ((k - 273.15) * 9) / 5 + 32;
    case 'R':
      return (k * 9) / 5;
  }
}

/** Exact conversion, before any rounding. */
export function convertTemperature(v: number, from: TempUnit, to: TempUnit): number {
  return from === to ? v : fromKelvin(toKelvin(v, from), to);
}

/** Decimal places in a number's shortest form: 97.8 -> 1, 883 -> 0. */
export function decimalPlaces(v: number): number {
  const [, frac = ''] = String(v).split('e')[0]!.split('.');
  return frac.length;
}

/** Round half away from zero, without binary floating-point surprises. */
export function roundTo(v: number, places: number): number {
  const sign = v < 0 ? -1 : 1;
  const rounded = Number(Math.round(Number(`${Math.abs(v)}e${places}`)) + `e-${places}`);
  return sign * rounded || 0; // normalize -0
}

function fmt(v: number, places: number): string {
  return roundTo(v, places)
    .toFixed(places)
    .replace('-', '−'); // a real minus sign, not a hyphen
}

export interface ShownTemperature {
  /** e.g. "208.0 °F" or "50 to 110 °C". */
  text: string;
  /** e.g. "converted from 97.8 °C"; null when shown in the source's unit. */
  convertedFrom: string | null;
}

/** Formats a stored temperature (number or range) in the reader's unit. */
export function showTemperature(value: number | Range, stored: TempUnit, shown: TempUnit): ShownTemperature {
  const one = (v: number, unit: TempUnit) =>
    fmt(convertTemperature(v, stored, unit), decimalPlaces(v));
  const render = (unit: TempUnit) =>
    typeof value === 'number'
      ? `${one(value, unit)} ${TEMP_UNITS[unit].symbol}`
      : `${one(value.min, unit)} to ${one(value.max, unit)} ${TEMP_UNITS[unit].symbol}`;
  return {
    text: render(shown),
    convertedFrom: shown === stored ? null : `converted from ${render(stored)}`,
  };
}

// ---- Reader setting ---------------------------------------------------------

const KEY = 'atomitron.tempUnit';
export const TEMP_UNIT_EVENT = 'atomitron:temp-unit';

export function getTempUnit(): TempUnit {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'C' || v === 'F' || v === 'K' || v === 'R') return v;
  } catch {
    // Storage blocked: fall through to the default.
  }
  return 'C';
}

export function setTempUnit(unit: TempUnit): void {
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    // Storage blocked (e.g. private browsing): the choice lasts this visit only.
  }
  window.dispatchEvent(new CustomEvent(TEMP_UNIT_EVENT, { detail: unit }));
}

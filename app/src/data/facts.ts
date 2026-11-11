// The render gate (spec 10.3): the app shows a fact only if isRenderable()
// passes. The data-integrity tests run the same predicate over every file in
// data/verified/, so the app and the build can't disagree about it.

import type { Fact, FactValue, Range } from './schema';

/** The only three citation hosts (spec 5.1), with their display names. */
export const SOURCES = {
  'pubchem.ncbi.nlm.nih.gov': 'PubChem',
  'webbook.nist.gov': 'NIST Chemistry WebBook',
  'chem.libretexts.org': 'LibreTexts Chemistry',
} as const;

export type SourceName = (typeof SOURCES)[keyof typeof SOURCES];

/** Display name of a whitelisted source, or null if the URL isn't one. */
export function sourceName(url: string): SourceName | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Same rule as the JSON Schema pattern: the raw string must start with
  // "https://<host>/" exactly. That excludes ports, user@host tricks,
  // uppercase hosts, and bare hosts with no path, which the URL parser
  // would otherwise normalize into something that looks valid.
  if (parsed.protocol !== 'https:' || !url.startsWith(`https://${parsed.hostname}/`)) {
    return null;
  }
  return Object.hasOwn(SOURCES, parsed.hostname)
    ? SOURCES[parsed.hostname as keyof typeof SOURCES]
    : null;
}

export function isRange(value: unknown): value is Range {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Range).min === 'number' &&
    typeof (value as Range).max === 'number'
  );
}

function isValidValue(value: unknown): value is FactValue {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((n) => Number.isInteger(n) && n >= 0);
  }
  return (
    isRange(value) &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min <= value.max
  );
}

/**
 * True only for a fact that has a passing verification record and a
 * whitelisted source. Anything else must not be shown.
 */
export function isRenderable(fact: unknown): fact is Fact {
  if (typeof fact !== 'object' || fact === null) return false;
  const f = fact as Partial<Fact>;
  return (
    isValidValue(f.value) &&
    (f.unit === null || (typeof f.unit === 'string' && f.unit.length > 0)) &&
    typeof f.uncertain === 'boolean' &&
    // An uncertain value is never one falsely precise number (spec 3.6).
    (!f.uncertain || typeof f.value !== 'number') &&
    typeof f.source?.url === 'string' &&
    sourceName(f.source.url) !== null &&
    typeof f.source.retrieved === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(f.source.retrieved) &&
    f.verification?.status === 'pass' &&
    typeof f.verification.recordId === 'string' &&
    f.verification.recordId.length > 0
  );
}

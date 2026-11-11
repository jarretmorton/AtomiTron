// Data-integrity gate (spec 10.5: "Zero unverified facts ship. A test fails
// the build if any are found."). It checks every JSON file under
// data/verified/ against the schema. It runs the app's own isRenderable() on
// every fact and requires a matching passing record in verification/records/.
// It recomputes every derived fact from its inputs and runs element-level
// consistency checks. See verification/methodology.md.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { derive, DerivationError, electronCount, parseConfiguration } from '../app/src/data/derive';
import { isRange, isRenderable } from '../app/src/data/facts';
import type { DerivationRule, Element, Fact, VerificationRecord } from '../app/src/data/schema';

export const ROOT = join(import.meta.dirname, '..');
export const SCHEMA_DIR = join(ROOT, 'data', 'schema');

// ajv-formats is CommonJS; depending on interop the function is the module or its default.
const addFormats = ((addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule) as typeof addFormatsModule;

export function makeAjv(): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  for (const file of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8')));
  }
  return ajv;
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(e.parentPath, e.name))
    .sort();
}

/** Every object with a "verification" key is a fact; yields [JSON Pointer, fact]. */
function* findFacts(node: unknown, path = ''): Generator<[string, unknown]> {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* findFacts(node[i], `${path}/${i}`);
  } else if (typeof node === 'object' && node !== null) {
    if ('verification' in node) {
      yield [path, node];
      return;
    }
    for (const [k, v] of Object.entries(node)) yield* findFacts(v, `${path}/${k}`);
  }
}

/** The rule each derived element field must use. */
const ELEMENT_RULES: [string, (e: Element) => Fact | undefined, DerivationRule][] = [
  ['atom.protons', (e) => e.atom.protons, 'protons-equal-atomic-number'],
  ['atom.electrons', (e) => e.atom.electrons, 'electrons-equal-atomic-number'],
  ['atom.neutrons', (e) => e.atom.neutrons, 'neutrons-from-mass-number'],
  ['atom.shells', (e) => e.atom.shells, 'shells-from-configuration'],
  ['valenceElectrons', (e) => e.valenceElectrons, 'valence-main-group'],
];

function checkElement(e: Element, at: string, errors: string[]): void {
  const z = e.atomicNumber.value;
  if (e.id !== `element:${e.symbol.value}`) errors.push(`${at}: id "${e.id}" doesn't match symbol "${e.symbol.value}"`);

  if (e.electronConfiguration) {
    const occ = parseConfiguration(e.electronConfiguration.value);
    if (!occ) errors.push(`${at}: electron configuration "${e.electronConfiguration.value}" doesn't parse`);
    else if (electronCount(occ) !== z) {
      errors.push(`${at}: electron configuration holds ${electronCount(occ)} electrons, atomic number is ${z}`);
    }
  } else if (e.atom.shells || e.valenceElectrons) {
    errors.push(`${at}: shells or valence without an electron configuration`);
  }

  for (const [field, get, rule] of ELEMENT_RULES) {
    const f = get(e);
    if (f && f.derivation?.rule !== rule) errors.push(`${at}: ${field} must be derived with rule ${rule}`);
  }

  // The atom shows the most abundant natural isotope, or, with none in
  // nature, the longest-lived isotope (methodology section 8).
  const natural = e.isotopes.filter((i) => i.abundance);
  const weight = (i: (typeof natural)[number]) => {
    const v = i.abundance!.value;
    return isRange(v) ? (v.min + v.max) / 2 : (v as number);
  };
  const expected = natural.length
    ? natural.reduce((a, b) => (weight(b) > weight(a) ? b : a)).massNumber.value
    : e.longestLivedIsotopeMassNumber?.value;
  if (expected === undefined) errors.push(`${at}: no natural isotope and no longest-lived mass number to draw`);
  else if (e.atom.isotope !== expected) errors.push(`${at}: atom shows isotope ${e.atom.isotope}, expected ${expected}`);
}

/** Returns a list of problems; an empty list means the data may ship. */
export function checkData(verifiedDir: string, recordsDir: string, ajv = makeAjv()): string[] {
  const errors: string[] = [];
  const validateDataset = ajv.getSchema('urn:atomitron:schema:dataset')!;
  const validateFact = ajv.getSchema('urn:atomitron:schema:fact')!;
  const rel = (p: string) => relative(ROOT, p).replaceAll('\\', '/');

  const load = (file: string): unknown => {
    try {
      return JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${rel(file)}: not valid JSON (${(e as Error).message})`);
      return undefined;
    }
  };

  // Verification records, indexed by id.
  const records = new Map<string, VerificationRecord>();
  for (const file of jsonFiles(recordsDir)) {
    const data = load(file) as { kind?: string; items?: VerificationRecord[] } | undefined;
    if (data === undefined) continue;
    if (!validateDataset(data)) {
      errors.push(`${rel(file)}: ${ajv.errorsText(validateDataset.errors)}`);
      continue;
    }
    if (data.kind !== 'verification-records') {
      errors.push(`${rel(file)}: kind must be "verification-records", got "${data.kind}"`);
      continue;
    }
    for (const r of data.items!) {
      if (records.has(r.id)) errors.push(`${rel(file)}: duplicate record id "${r.id}"`);
      records.set(r.id, r);
    }
  }

  // Verified data: the only data normal mode loads.
  const facts = new Map<string, { fact: Fact; at: string }>();
  for (const file of jsonFiles(verifiedDir)) {
    const data = load(file) as { kind?: string; items?: unknown[] } | undefined;
    if (data === undefined) continue;
    if (!validateDataset(data)) {
      errors.push(`${rel(file)}: ${ajv.errorsText(validateDataset.errors)}`);
      continue;
    }
    if (data.kind === 'verification-records') {
      errors.push(`${rel(file)}: verification records belong in verification/records/`);
      continue;
    }
    for (const [ptr, fact] of findFacts(data)) {
      const at = `${rel(file)}#${ptr}`;
      if (!validateFact(fact)) {
        errors.push(`${at}: ${ajv.errorsText(validateFact.errors)}`);
        continue;
      }
      if (!isRenderable(fact)) {
        errors.push(`${at}: fails isRenderable (unverified, bad source, or bad value)`);
        continue;
      }
      const id = fact.verification.recordId;
      if (facts.has(id)) errors.push(`${at}: record id "${id}" is also used by ${facts.get(id)!.at}`);
      facts.set(id, { fact, at });
      const record = records.get(id);
      if (!record) {
        errors.push(`${at}: no verification record "${id}"`);
        continue;
      }
      if (record.result !== 'pass') errors.push(`${at}: record "${id}" did not pass`);
      if (record.sourceUrl !== fact.source.url) errors.push(`${at}: source URL differs from record "${id}"`);
      if (!isDeepStrictEqual(record.claimedValue, fact.value) || record.unit !== fact.unit) {
        errors.push(`${at}: value or unit differs from what record "${id}" verified`);
      }
      if ((record.method === 'derive') !== Boolean(fact.derivation)) {
        errors.push(`${at}: record "${id}" method "${record.method}" doesn't match whether the fact is derived`);
      }
    }
    if (data.kind === 'elements') {
      data.items!.forEach((e, i) => checkElement(e as Element, `${rel(file)}#/items/${i}`, errors));
    }
  }

  // Recompute every derived fact from its verified inputs.
  for (const { fact, at } of facts.values()) {
    if (!fact.derivation) continue;
    const inputs = fact.derivation.inputs.map((id) => facts.get(id)?.fact);
    const missing = fact.derivation.inputs.filter((_, i) => !inputs[i]);
    if (missing.length) {
      errors.push(`${at}: derivation inputs not found among verified facts: ${missing.join(', ')}`);
      continue;
    }
    let value;
    try {
      value = derive(fact.derivation.rule, inputs.map((f) => f!.value));
    } catch (e) {
      if (!(e instanceof DerivationError)) throw e;
      errors.push(`${at}: ${fact.derivation.rule}: ${e.message}`);
      continue;
    }
    if (!isDeepStrictEqual(value, fact.value)) {
      errors.push(`${at}: ${fact.derivation.rule} gives ${JSON.stringify(value)}, fact says ${JSON.stringify(fact.value)}`);
    }
    if (fact.uncertain !== inputs.some((f) => f!.uncertain)) {
      errors.push(`${at}: derived fact must be uncertain exactly when one of its inputs is`);
    }
  }
  return errors;
}

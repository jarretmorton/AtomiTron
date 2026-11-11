// Data-integrity gate (spec 10.5: "Zero unverified facts ship. A test fails
// the build if any are found."). Checks every JSON file under data/verified/
// against the schema, runs the app's own isRenderable() on every fact, and
// requires a matching passing record in verification/records/.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { isRenderable } from '../app/src/data/facts';
import type { VerificationRecord } from '../app/src/data/schema';

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
  for (const file of jsonFiles(verifiedDir)) {
    const data = load(file) as { kind?: string } | undefined;
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
      const record = records.get(fact.verification.recordId);
      if (!record) {
        errors.push(`${at}: no verification record "${fact.verification.recordId}"`);
        continue;
      }
      if (record.result !== 'pass') errors.push(`${at}: record "${record.id}" did not pass`);
      if (record.sourceUrl !== fact.source.url) errors.push(`${at}: source URL differs from record "${record.id}"`);
      if (!isDeepStrictEqual(record.claimedValue, fact.value) || record.unit !== fact.unit) {
        errors.push(`${at}: value or unit differs from what record "${record.id}" verified`);
      }
    }
  }
  return errors;
}

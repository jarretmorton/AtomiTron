// The build gate. The first test runs over the real repo data; if it fails,
// CI fails and nothing deploys. The rest prove the gate catches each way an
// unverified or inconsistent fact could slip through.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Element, OpenQuestion, VerificationRecord } from '../app/src/data/schema';
import { CONCEPTS } from '../app/src/content/concepts';
import { checkData, ROOT } from './integrity';
import { goodElement, goodOpenQuestion, recordsFor } from './samples';

it('repo data: every fact in data/verified/ is verified', () => {
  const errors = checkData(join(ROOT, 'data', 'verified'), join(ROOT, 'verification', 'records'));
  expect(errors).toEqual([]);
});

it('every explanation sentence in the app has a passing record', () => {
  const file = join(ROOT, 'verification', 'records', 'concepts.json');
  const records: VerificationRecord[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).items : [];
  for (const [key, c] of Object.entries(CONCEPTS)) {
    const r = records.find((x) => x.id === `concept.${key}`);
    expect(r, `no record for concept.${key}`).toBeDefined();
    expect(r!.result).toBe('pass');
    expect(r!.claimedValue).toBe(c.text);
    expect(r!.sourceUrl).toBe(c.url);
  }
});

/**
 * Writes the samples to a temp dir, applies an edit, and runs the gate.
 * Records are made before the edit, so editing a fact simulates a change
 * after verification. Pass `rerecord` to regenerate records after the edit,
 * which simulates a pipeline that recorded the bad value too.
 */
function scenario(
  edit: (q: OpenQuestion, e: Element, records: VerificationRecord[]) => void = () => {},
  { rerecord = false } = {},
): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'atomitron-'));
  const q = structuredClone(goodOpenQuestion);
  const e = structuredClone(goodElement);
  let records = [...recordsFor(q), ...recordsFor(e)];
  edit(q, e, records);
  if (rerecord) records = [...recordsFor(q), ...recordsFor(e)];
  mkdirSync(join(dir, 'verified'));
  mkdirSync(join(dir, 'records'));
  const write = (p: string, kind: string, items: unknown[]) =>
    writeFileSync(join(dir, p), JSON.stringify({ schemaVersion: 2, kind, items }));
  write('verified/open-questions.json', 'open-questions', [q]);
  write('verified/011-Na.json', 'elements', [e]);
  write('records/records.json', 'verification-records', records);
  return checkData(join(dir, 'verified'), join(dir, 'records'));
}

type Edit = (q: OpenQuestion, e: Element, r: VerificationRecord[]) => void;

describe('gate', () => {
  it('passes fully verified data', () => {
    expect(scenario()).toEqual([]);
  });

  it.each<[string, Edit, RegExp]>([
    ['fact not passed', (q) => (q.known[0]!.verification.status = 'pending'), /fails isRenderable/],
    ['record missing', (_q, _e, r) => r.splice(0, 1), /no verification record/],
    ['record failed', (_q, _e, r) => (r[0]!.result = 'fail'), /did not pass/],
    ['value edited after verification', (q) => (q.known[0]!.value = 999), /value or unit differs/],
    ['unit edited after verification', (q) => (q.known[0]!.unit = 'kJ/mol'), /value or unit differs/],
    ['source swapped after verification', (q) => (q.known[0]!.source.url = 'https://webbook.nist.gov/x'), /source URL differs/],
    ['non-whitelisted source', (q) => (q.known[0]!.source.url = 'https://example.com/'), /must match pattern/],
    ['duplicate record id', (_q, _e, r) => r.push(r[0]!), /duplicate record id/],
    ['record method mislabelled', (_q, _e, r) => (r.find((x) => x.id === 'na-shells')!.method = 'extract'), /method "extract"/],
  ])('fails when %s', (_, edit, expected) => {
    expect(scenario(edit).join('\n')).toMatch(expected);
  });
});

describe('gate: elements', () => {
  // These edits are re-recorded, as if the pipeline had verified the bad
  // value. The gate must still catch them on structure alone.
  it.each<[string, Edit, RegExp]>([
    ['neutrons miscounted', (_q, e) => (e.atom.neutrons.value = 13), /neutrons-from-mass-number gives 12, fact says 13/],
    ['shells miscounted', (_q, e) => (e.atom.shells!.value = [2, 8, 2]), /shells-from-configuration gives \[2,8,1\]/],
    ['configuration does not match atomic number', (_q, e) => (e.electronConfiguration!.value = '[Ne] 3s2'), /holds 12 electrons, atomic number is 11/],
    ['unparseable configuration', (_q, e) => (e.electronConfiguration!.value = '[Ne] 3x1'), /doesn't parse/],
    ['id does not match symbol', (_q, e) => (e.id = 'element:K'), /doesn't match symbol/],
    ['wrong isotope drawn', (_q, e) => (e.atom.isotope = 24), /atom shows isotope 24, expected 23/],
    ['derived field without its rule', (_q, e) => delete e.atom.protons.derivation, /must be derived with rule protons-equal-atomic-number/],
    ['derivation input missing', (_q, e) => (e.atom.neutrons.derivation!.inputs = ['na-iso99', 'na-z']), /inputs not found.*na-iso99/],
    ['valence for a non-main group', (_q, e) => (e.group!.value = 11), /only derived for main groups/],
    [
      'uncertainty not inherited',
      (_q, e) => {
        e.electronConfiguration!.uncertain = true;
      },
      /uncertain exactly when one of its inputs is/,
    ],
    ['two facts sharing a record', (_q, e) => (e.name.verification.recordId = 'na-symbol'), /also used by/],
    ['a number in a use', (_q, e) => (e.uses[0]!.value = 'Used in 3 ways.'), /uses\[0\] contains a number/],
    ['a non-year number in history', (_q, e) => (e.discovery!.story[0]!.value = 'Found in 1807 by 2 chemists.'), /isn't a year/],
  ])('fails when %s', (_, edit, expected) => {
    expect(scenario(edit, { rerecord: true }).join('\n')).toMatch(expected);
  });

  it('ships an element whose configuration is disputed, without shells or valence', () => {
    const errors = scenario(
      (_q, e) => {
        delete e.electronConfiguration;
        delete e.atom.shells;
        delete e.valenceElectrons;
      },
      { rerecord: true },
    );
    expect(errors).toEqual([]);
  });

  it('fails when shells are kept without a configuration', () => {
    const errors = scenario(
      (_q, e) => {
        delete e.electronConfiguration;
        delete e.valenceElectrons;
      },
      { rerecord: true },
    );
    expect(errors.join('\n')).toMatch(/shells or valence without an electron configuration/);
  });

  it('uses the longest-lived mass number when no isotope occurs naturally', () => {
    const errors = scenario(
      (_q, e) => {
        delete e.isotopes[0]!.abundance;
        e.longestLivedIsotopeMassNumber = { ...structuredClone(e.period), value: 23 };
        e.longestLivedIsotopeMassNumber.verification.recordId = 'na-longest';
      },
      { rerecord: true },
    );
    expect(errors).toEqual([]);
  });
});

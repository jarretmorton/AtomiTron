// The build gate. The first test runs over the real repo data; if it fails,
// CI fails and nothing deploys. The rest prove the gate catches each way an
// unverified fact could slip through.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OpenQuestion, VerificationRecord } from '../app/src/data/schema';
import { checkData, ROOT } from './integrity';
import { goodOpenQuestion, recordsFor } from './samples';

it('repo data: every fact in data/verified/ is verified', () => {
  const errors = checkData(join(ROOT, 'data', 'verified'), join(ROOT, 'verification', 'records'));
  expect(errors).toEqual([]);
});

function scenario(
  edit: (q: OpenQuestion, records: VerificationRecord[]) => void = () => {},
): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'atomitron-'));
  const q = structuredClone(goodOpenQuestion);
  const records = recordsFor(q);
  edit(q, records);
  mkdirSync(join(dir, 'verified'));
  mkdirSync(join(dir, 'records'));
  const write = (p: string, kind: string, items: unknown[]) =>
    writeFileSync(join(dir, p), JSON.stringify({ schemaVersion: 1, kind, items }));
  write('verified/open-questions.json', 'open-questions', [q]);
  write('records/records.json', 'verification-records', records);
  return checkData(join(dir, 'verified'), join(dir, 'records'));
}

describe('gate', () => {
  it('passes fully verified data', () => {
    expect(scenario()).toEqual([]);
  });

  it.each<[string, (q: OpenQuestion, r: VerificationRecord[]) => void, RegExp]>([
    ['fact not passed', (q) => (q.known[0]!.verification.status = 'pending'), /fails isRenderable/],
    ['record missing', (_, r) => r.splice(0, 1), /no verification record/],
    ['record failed', (_, r) => (r[0]!.result = 'fail'), /did not pass/],
    ['value edited after verification', (q) => (q.known[0]!.value = 999), /value or unit differs/],
    ['unit edited after verification', (q) => (q.known[0]!.unit = 'kJ/mol'), /value or unit differs/],
    ['source swapped after verification', (q) => (q.known[0]!.source.url = 'https://webbook.nist.gov/x'), /source URL differs/],
    ['non-whitelisted source', (q) => (q.known[0]!.source.url = 'https://example.com/'), /must match pattern/],
    ['duplicate record id', (_, r) => r.push(r[0]!), /duplicate record id/],
  ])('fails when %s', (_, edit, expected) => {
    const errors = scenario(edit);
    expect(errors.join('\n')).toMatch(expected);
  });
});

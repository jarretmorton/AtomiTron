// Test samples. These are NOT real data. They exercise the schema and the gate
// only, and must never be copied into data/verified/. Text values say so
// explicitly, and numbers are arbitrary.

import type { Fact, OpenQuestion, VerificationRecord } from '../app/src/data/schema';

export const goodFact: Fact = {
  value: 123.4,
  unit: 'K',
  uncertain: false,
  source: { url: 'https://pubchem.ncbi.nlm.nih.gov/element/1', retrieved: '2026-11-08' },
  verification: { status: 'pass', recordId: 'vr-test-1' },
};

const textFact = (recordId: string): Fact<string> => ({
  value: 'Test sample text, not a real claim.',
  unit: null,
  uncertain: false,
  source: { url: 'https://chem.libretexts.org/Bookshelves', retrieved: '2026-11-08' },
  verification: { status: 'pass', recordId },
});

export const goodOpenQuestion: OpenQuestion = {
  id: 'oq-test-question',
  title: 'Test question',
  links: ['element:H'],
  isOpen: textFact('vr-test-2'),
  known: [goodFact],
  unknown: [textFact('vr-test-3')],
  ideas: [{ name: 'Test idea', summary: textFact('vr-test-4') }],
  hypothesisPrompt: 'What do you think?',
};

/** A passing record for each fact in goodOpenQuestion. */
export function recordsFor(q: OpenQuestion): VerificationRecord[] {
  const facts: [string, Fact][] = [
    ['/isOpen', q.isOpen],
    ...q.known.map((f, i): [string, Fact] => [`/known/${i}`, f]),
    ...q.unknown.map((f, i): [string, Fact] => [`/unknown/${i}`, f]),
    ...q.ideas.map((x, i): [string, Fact] => [`/ideas/${i}/summary`, x.summary]),
  ];
  return facts.map(([field, f]) => ({
    id: f.verification.recordId,
    subject: { entity: q.id, field },
    claimedValue: f.value,
    unit: f.unit,
    sourceUrl: f.source.url,
    retrievedValue: f.value,
    result: 'pass',
    checkedAt: '2026-11-08T12:00:00Z',
    consistency: { runs: 3, agreeing: 3 },
    verifier: 'test',
  }));
}

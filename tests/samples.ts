// Test samples. These are NOT verified data. They exercise the schema and the
// gate only, and must never be copied into data/verified/. Text values say so
// explicitly. Measured numbers (melting point and so on) are arbitrary. The
// sample element is sodium-shaped only so the structural checks have
// something consistent to check: atomic number vs configuration, and isotope
// vs neutrons.

import type { Element, Fact, FactValue, OpenQuestion, VerificationRecord } from '../app/src/data/schema';

const PUBCHEM_NA = 'https://pubchem.ncbi.nlm.nih.gov/element/11';
const CONCEPT = 'https://chem.libretexts.org/Bookshelves';

function fact<V extends FactValue>(value: V, recordId: string, extra: Partial<Fact<V>> = {}): Fact<V> {
  return {
    value,
    unit: null,
    uncertain: false,
    source: { url: PUBCHEM_NA, retrieved: '2026-11-08' },
    verification: { status: 'pass', recordId },
    ...extra,
  };
}

const derived = <V extends FactValue>(value: V, id: string, rule: NonNullable<Fact['derivation']>['rule'], inputs: string[]) =>
  fact(value, id, { source: { url: CONCEPT, retrieved: '2026-11-08' }, derivation: { rule, inputs } });

export const goodFact: Fact = fact(123.4, 'vr-test-1', { unit: 'K' });

const textFact = (recordId: string): Fact<string> =>
  fact('Test sample text, not a real claim.', recordId, { source: { url: CONCEPT, retrieved: '2026-11-08' } });

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

export const goodElement: Element = {
  id: 'element:Na',
  atomicNumber: fact(11, 'na-z'),
  symbol: fact('Na', 'na-symbol'),
  name: fact('Sodium', 'na-name'),
  period: fact(3, 'na-period'),
  group: fact(1, 'na-group'),
  atomicWeight: fact(22.98976928, 'na-weight', { unit: 'u', source: { url: PUBCHEM_NA, retrieved: '2026-11-08', via: 'IUPAC CIAAW' } }),
  electronConfiguration: fact('[Ne] 3s1', 'na-config'),
  electronegativity: fact(1.5, 'na-en'),
  valenceElectrons: derived(1, 'na-valence', 'valence-main-group', ['na-config', 'na-group']),
  state: fact('Test state, not a real claim', 'na-state'),
  meltingPoint: fact(50, 'na-mp', { unit: '°C' }),
  isotopes: [
    { massNumber: fact(23, 'na-iso23'), atomicMass: fact(22.99, 'na-iso23-mass', { unit: 'u' }), abundance: fact(1, 'na-iso23-abund') },
  ],
  atom: {
    isotope: 23,
    protons: derived(11, 'na-protons', 'protons-equal-atomic-number', ['na-z']),
    neutrons: derived(12, 'na-neutrons', 'neutrons-from-mass-number', ['na-iso23', 'na-z']),
    electrons: derived(11, 'na-electrons', 'electrons-equal-atomic-number', ['na-z']),
    shells: derived([2, 8, 1], 'na-shells', 'shells-from-configuration', ['na-config']),
  },
  discovery: { year: fact(1900, 'na-year'), story: [textFact('na-story-0')] },
  uses: [textFact('na-use-0')],
};

function* factsIn(node: unknown, path = ''): Generator<[string, Fact]> {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* factsIn(node[i], `${path}/${i}`);
  } else if (typeof node === 'object' && node !== null) {
    if ('verification' in node) {
      yield [path, node as Fact];
      return;
    }
    for (const [k, v] of Object.entries(node)) yield* factsIn(v, `${path}/${k}`);
  }
}

/** A passing record for every fact inside an entity. */
export function recordsFor(entity: OpenQuestion | Element): VerificationRecord[] {
  return [...factsIn(entity)].map(([field, f]) => ({
    id: f.verification.recordId,
    subject: { entity: entity.id, field },
    method: f.derivation ? 'derive' : 'extract',
    claimedValue: f.value,
    unit: f.unit,
    sourceUrl: f.source.url,
    retrievedValue: f.value,
    result: 'pass',
    checkedAt: '2026-11-08T12:00:00Z',
    consistency: { runs: 1, agreeing: 1 },
    verifier: 'test',
  }));
}

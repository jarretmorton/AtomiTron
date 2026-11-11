// The JSON Schema (shared with the pipeline) and the app's isRenderable() gate
// must agree. Every fact the schema rejects, the app must refuse to render.

import { describe, expect, it } from 'vitest';
import { isRenderable, sourceName } from '../app/src/data/facts';
import type { Fact } from '../app/src/data/schema';
import { makeAjv } from './integrity';
import { goodElement, goodFact, goodOpenQuestion } from './samples';

const ajv = makeAjv();
const factSchema = ajv.getSchema('urn:atomitron:schema:fact')!;
const oqSchema = ajv.getSchema('urn:atomitron:schema:open-question')!;
const elementSchema = ajv.getSchema('urn:atomitron:schema:element')!;
const entityId = (id: string) =>
  ajv.validate({ $ref: 'urn:atomitron:schema:fact#/$defs/entityId' }, id);

const mutate = (fn: (f: Fact) => void): Fact => {
  const f = structuredClone(goodFact);
  fn(f);
  return f;
};

describe('fact', () => {
  it('accepts a verified fact, in schema and at render', () => {
    expect(factSchema(goodFact), ajv.errorsText(factSchema.errors)).toBe(true);
    expect(isRenderable(goodFact)).toBe(true);
  });

  it.each<[string, Fact['value']]>([
    ['predicted text', 'Expected to be a gas'],
    ['predicted counts', [2, 8, 18, 32, 32, 18, 8]],
  ])('accepts an uncertain non-numeric value (%s)', (_, value) => {
    const f = mutate((f) => {
      f.value = value;
      f.unit = null;
      f.uncertain = true;
    });
    expect(factSchema(f), ajv.errorsText(factSchema.errors)).toBe(true);
    expect(isRenderable(f)).toBe(true);
  });

  it('accepts a range that is not uncertain (varies in nature)', () => {
    const f = mutate((f) => (f.value = { min: 1.00784, max: 1.00811 }));
    expect(factSchema(f)).toBe(true);
    expect(isRenderable(f)).toBe(true);
  });

  it('accepts an uncertain value stored as a range', () => {
    const f = mutate((f) => {
      f.value = { min: 600, max: 700 };
      f.uncertain = true;
    });
    expect(factSchema(f)).toBe(true);
    expect(isRenderable(f)).toBe(true);
  });

  it.each(['pending', 'fail'] as const)(
    'allows status %s in the schema (pipeline drafts) but refuses to render it',
    (status) => {
      const f = mutate((f) => (f.verification.status = status));
      expect(factSchema(f)).toBe(true);
      expect(isRenderable(f)).toBe(false);
    },
  );

  const rejected: [string, Fact][] = [
    ['empty record id', mutate((f) => (f.verification.recordId = ''))],
    ['non-whitelisted host', mutate((f) => (f.source.url = 'https://en.wikipedia.org/wiki/Sodium'))],
    ['look-alike host', mutate((f) => (f.source.url = 'https://pubchem.ncbi.nlm.nih.gov.example.com/x'))],
    ['userinfo trick', mutate((f) => (f.source.url = 'https://pubchem.ncbi.nlm.nih.gov@example.com/x'))],
    ['plain http', mutate((f) => (f.source.url = 'http://pubchem.ncbi.nlm.nih.gov/element/11'))],
    ['bare host, no path', mutate((f) => (f.source.url = 'https://webbook.nist.gov'))],
    ['bad retrieval date', mutate((f) => (f.source.retrieved = '11/08/2026'))],
    ['uncertain but a single number', mutate((f) => (f.uncertain = true))],
    ['empty string value', mutate((f) => (f.value = ''))],
    ['empty unit string', mutate((f) => (f.unit = ''))],
    ['missing unit key', mutate((f) => delete (f as Partial<Fact>).unit)],
    ['missing verification', mutate((f) => delete (f as Partial<Fact>).verification)],
    ['empty counts', mutate((f) => (f.value = []))],
    ['negative count', mutate((f) => (f.value = [2, -1]))],
    ['fractional count', mutate((f) => (f.value = [2, 1.5]))],
  ];

  it.each(rejected)('rejects %s, in schema and at render', (_, f) => {
    expect(factSchema(f)).toBe(false);
    expect(isRenderable(f)).toBe(false);
  });

  it('rejects an inverted range at render (schema cannot compare fields)', () => {
    const f = mutate((f) => (f.value = { min: 5, max: 1 }));
    expect(isRenderable(f)).toBe(false);
  });

  it('rejects unknown properties', () => {
    expect(factSchema({ ...goodFact, note: 'x' })).toBe(false);
  });
});

describe('element', () => {
  it('accepts a complete element', () => {
    expect(elementSchema(goodElement), ajv.errorsText(elementSchema.errors)).toBe(true);
  });

  it.each<[string, (e: typeof goodElement) => void]>([
    ['atomic number with a unit', (e) => (e.atomicNumber.unit = 'u')],
    ['fractional period', (e) => (e.period.value = 3.5)],
    ['group zero', (e) => (e.group!.value = 0)],
    ['bad id', (e) => (e.id = 'element:na' as typeof e.id)],
    ['missing atom', (e) => delete (e as Partial<typeof e>).atom],
    ['unknown derivation rule', (e) => ((e.atom.protons.derivation!.rule as string) = 'guess')],
    ['unknown field', (e) => ((e as unknown as Record<string, unknown>).colour = 'silver')],
  ])('rejects %s', (_, edit) => {
    const e = structuredClone(goodElement);
    edit(e);
    expect(elementSchema(e)).toBe(false);
  });
});

describe('sources', () => {
  it('names exactly the three whitelisted sources', () => {
    expect(sourceName('https://pubchem.ncbi.nlm.nih.gov/element/11')).toBe('PubChem');
    expect(sourceName('https://webbook.nist.gov/cgi/cbook.cgi?ID=C7647145')).toBe('NIST Chemistry WebBook');
    expect(sourceName('https://chem.libretexts.org/Bookshelves')).toBe('LibreTexts Chemistry');
    expect(sourceName('https://pubchem.ncbi.nlm.nih.gov:8443/x')).toBeNull();
    expect(sourceName('https://libretexts.org/x')).toBeNull();
    expect(sourceName('not a url')).toBeNull();
  });
});

describe('entity ids', () => {
  it.each(['element:H', 'element:Na', 'element:Og', 'compound:cid-5234', 'reaction:sodium-chlorine'])(
    'accepts %s',
    (id) => expect(entityId(id)).toBe(true),
  );
  it.each(['element:na', 'element:Uue1', 'compound:5234', 'compound:cid-0', 'reaction:Sodium', 'reaction:a--b', 'Na'])(
    'rejects %s',
    (id) => expect(entityId(id)).toBe(false),
  );
});

describe('open question', () => {
  it('accepts a sourced open question linked to entities', () => {
    expect(oqSchema(goodOpenQuestion), ajv.errorsText(oqSchema.errors)).toBe(true);
  });

  it('requires the "is open" claim itself to be a sourced fact', () => {
    const q = { ...goodOpenQuestion, isOpen: 'Nobody knows yet.' };
    expect(oqSchema(q)).toBe(false);
  });

  it('requires at least one linked entity', () => {
    expect(oqSchema({ ...goodOpenQuestion, links: [] })).toBe(false);
  });
});

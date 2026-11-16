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
import { inLowestTerms, isBalanced, parseFormula, sameComposition, type Term } from '../app/src/data/chemistry';
import type { Compound, DerivationRule, Element, Fact, Reaction, Species, VerificationRecord } from '../app/src/data/schema';

export const ROOT = join(import.meta.dirname, '..');
export const SCHEMA_DIR = join(ROOT, 'data', 'schema');

// ajv-formats is CommonJS; depending on interop the function is the module or its default.
const addFormats = ((addFormatsModule as unknown as { default?: typeof addFormatsModule }).default ??
  addFormatsModule) as typeof addFormatsModule;

export function makeAjv(): Ajv2020 {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    allowUnionTypes: true,
    // The reaction schema names properties in if/then/not branches ("a
    // no-reaction entry has no energy"), which this check would reject.
    strictRequired: false,
  });
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
    const written = e.electronConfiguration.source.asWritten;
    if (written !== undefined) {
      const w = parseConfiguration(written);
      if (!w || !occ || !isDeepStrictEqual(new Map([...w].sort()), new Map([...occ].sort()))) {
        errors.push(`${at}: electron configuration as written by the source ("${written}") doesn't match the value`);
      }
    }
  } else if (e.atom.shells || e.valenceElectrons) {
    errors.push(`${at}: shells or valence without an electron configuration`);
  }

  for (const [field, get, rule] of ELEMENT_RULES) {
    const f = get(e);
    if (f && f.derivation?.rule !== rule) errors.push(`${at}: ${field} must be derived with rule ${rule}`);
  }

  // Safety screen on text (spec 4, 10.5): no numbers in uses; only years in history.
  for (const [i, f] of e.uses.entries()) {
    if (/\d/.test(String(f.value))) errors.push(`${at}: uses[${i}] contains a number`);
  }
  for (const [i, f] of (e.discovery?.story ?? []).entries()) {
    if (/\d/.test(String(f.value).replace(/\b1\d{3}\b|\b20\d{2}\b/g, ''))) {
      errors.push(`${at}: discovery.story[${i}] contains a number that isn't a year`);
    }
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

function checkCompound(c: Compound, at: string, errors: string[]): void {
  const comp = parseFormula(c.formula.value);
  if (!comp) {
    errors.push(`${at}: formula "${c.formula.value}" doesn't parse`);
    return;
  }
  const written = c.formula.source.asWritten;
  if (written !== undefined) {
    const w = parseFormula(written);
    if (!w || !sameComposition(w, comp)) errors.push(`${at}: formula as written by the source ("${written}") holds different atoms`);
  }
  if (c.element) {
    const symbol = c.element.slice('element:'.length);
    if (Object.keys(comp).length !== 1 || !(symbol in comp)) errors.push(`${at}: marked as ${c.element} but its formula is ${c.formula.value}`);
  }
  const sd = c.standardState.derivation;
  if (sd) {
    const symbol = c.element?.slice('element:'.length);
    if (sd.rule !== 'state-at-room-temperature' || !symbol) {
      errors.push(`${at}: a derived state must use state-at-room-temperature, for an element`);
    } else if (
      !isDeepStrictEqual(sd.inputs, [`${symbol}.meltingPoint`, `${symbol}.boilingPoint`]) &&
      !isDeepStrictEqual(sd.inputs, [`${symbol}.meltingPoint`])
    ) {
      errors.push(`${at}: the state must be derived from ${symbol}'s own melting and boiling points`);
    }
  }
  const phases = new Set<string>();
  for (const h of c.formationEnthalpies) {
    if (phases.has(h.phase)) errors.push(`${at}: two formation enthalpies for phase ${h.phase}`);
    phases.add(h.phase);
    if (h.value.unit !== 'kJ/mol') errors.push(`${at}: formation enthalpy must be in kJ/mol`);
    if (h.value.derivation?.rule === 'zero-for-element-in-standard-state') {
      const standard = { solid: 's', liquid: 'l', gas: 'g' }[c.standardState.value];
      if (!c.element || h.phase !== standard) errors.push(`${at}: a zero formation enthalpy is only for an element in its standard state`);
      if (h.value.derivation.inputs[0] !== c.standardState.verification.recordId) errors.push(`${at}: the zero rule must rest on this substance's standard state`);
    }
  }
  for (const [i, f] of c.uses.entries()) {
    if (/\d/.test(f.value)) errors.push(`${at}: uses[${i}] contains a number`);
  }
}

function checkReaction(r: Reaction, at: string, compounds: Map<string, Compound>, errors: string[]): void {
  // Hazard notes are textbook level: no quantities, so no digits at all (spec 4).
  for (const [i, f] of (r.hazard?.why ?? []).entries()) {
    if (/\d/.test(f.value)) errors.push(`${at}: hazard.why[${i}] contains a number`);
  }
  if (r.energy?.trigger && /\d/.test(r.energy.trigger.value)) errors.push(`${at}: energy.trigger contains a number`);

  // The first summary is written by code from this entry's own substances.
  const nameOf = (id: string) => (compounds.get(id) ?? [...compounds.values()].find((c) => c.element === id))?.name;
  const summary = r.summary[0]?.derivation;
  const parts: [string, number][] =
    r.kind === 'reaction'
      ? [...r.reactants!.map((s) => [s.substance, -1] as [string, number]), ...r.products!.map((s) => [s.substance, 1] as [string, number])]
      : r.inputs.map((id) => [id, -1] as [string, number]);
  const names = parts.map(([id]) => nameOf(id)?.verification.recordId);
  if (
    summary?.rule !== 'summary-from-equation' ||
    names.some((n) => !n) ||
    !isDeepStrictEqual(summary.inputs, names) ||
    !isDeepStrictEqual(summary.weights, parts.map(([, w]) => w))
  ) {
    errors.push(`${at}: the first summary must be derived (summary-from-equation) from this entry's own substances`);
  }
  for (const [i, f] of r.summary.entries()) {
    if (i > 0 && /\d/.test(f.value)) errors.push(`${at}: summary[${i}] contains a number`);
  }
  if (r.kind !== 'reaction') return;

  const sides = { reactants: r.reactants!, products: r.products! };
  const terms: Record<string, Term[]> = { reactants: [], products: [] };
  let known = true;
  for (const [side, list] of Object.entries(sides)) {
    for (const s of list) {
      const c = compounds.get(s.substance);
      const comp = c && parseFormula(c.formula.value);
      if (!c || !comp) {
        errors.push(`${at}: ${side} name ${s.substance}, which isn't a verified compound`);
        known = false;
        continue;
      }
      terms[side]!.push({ coefficient: s.coefficient, composition: comp });
    }
  }
  if (!known) return;
  if (!isBalanced(terms.reactants!, terms.products!)) errors.push(`${at}: the equation doesn't balance`);
  const all: Species[] = [...sides.reactants, ...sides.products];
  if (!inLowestTerms(all.map((s) => s.coefficient))) errors.push(`${at}: the coefficients share a common factor`);

  // The enthalpy must be computed from exactly this equation: one formation
  // enthalpy per species, in the species' phase, weighted by its coefficient.
  const d = r.energy?.enthalpy?.derivation;
  if (r.energy?.enthalpy) {
    if (r.energy.enthalpy.unit !== 'kJ') errors.push(`${at}: reaction enthalpy must be in kJ`);
    const want = all.map((s, i) => {
      const h = compounds.get(s.substance)!.formationEnthalpies.find((x) => x.phase === s.phase);
      return { id: h?.value.verification.recordId, weight: i < sides.reactants.length ? -s.coefficient : s.coefficient, s };
    });
    const missing = want.filter((w) => !w.id).map((w) => `${w.s.substance}(${w.s.phase})`);
    if (missing.length) errors.push(`${at}: no formation enthalpy for ${missing.join(', ')}`);
    else if (
      d?.rule !== 'reaction-enthalpy' ||
      !isDeepStrictEqual(d.inputs, want.map((w) => w.id)) ||
      !isDeepStrictEqual(d.weights, want.map((w) => w.weight))
    ) {
      errors.push(`${at}: the enthalpy's inputs and weights don't match the equation's species and coefficients`);
    }
    const dir = r.energy.direction?.derivation;
    if (dir?.rule !== 'energy-direction' || dir.inputs[0] !== r.energy.enthalpy.verification.recordId) {
      errors.push(`${at}: the direction must be derived from this reaction's enthalpy`);
    }
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
  const facts = new Map<string, { fact: Fact; at: string }>();
  const compounds = new Map<string, Compound>();
  const reactions: [Reaction, string][] = [];
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
      if (record.method === 'agent') {
        // Agent-checked text: all independent runs must agree, with evidence (methodology section 3).
        if (record.consistency.runs < 3 || record.consistency.agreeing !== record.consistency.runs || !record.evidence) {
          errors.push(`${at}: agent record "${id}" needs 3 or more runs, all agreeing, with evidence`);
        }
      }
      if ((record.method === 'derive') !== Boolean(fact.derivation)) {
        errors.push(`${at}: record "${id}" method "${record.method}" doesn't match whether the fact is derived`);
      }
    }
    if (data.kind === 'elements') {
      data.items!.forEach((e, i) => checkElement(e as Element, `${rel(file)}#/items/${i}`, errors));
    }
    if (data.kind === 'compounds') {
      data.items!.forEach((c, i) => {
        const compound = c as Compound;
        if (compounds.has(compound.id)) errors.push(`${rel(file)}#/items/${i}: ${compound.id} appears twice`);
        compounds.set(compound.id, compound);
        checkCompound(compound, `${rel(file)}#/items/${i}`, errors);
      });
    }
    if (data.kind === 'reactions') {
      data.items!.forEach((r, i) => reactions.push([r as Reaction, `${rel(file)}#/items/${i}`]));
    }
  }

  for (const [r, at] of reactions) checkReaction(r, at, compounds, errors);

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
      value = derive(fact.derivation.rule, inputs.map((f) => f!.value), fact.derivation.weights);
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

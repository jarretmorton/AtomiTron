// TypeScript mirror of data/schema/*.schema.json. The JSON Schema is the
// contract shared with the Python pipeline. Change both together, and the
// schema tests will catch drift between them.

export type EntityId =
  | `element:${string}`
  | `compound:cid-${number}`
  | `reaction:${string}`;

export type OpenQuestionId = `oq-${string}`;

export interface Range {
  min: number;
  max: number;
}

/** Electrons per shell, innermost first, e.g. [2, 8, 1]. */
export type Counts = number[];

export type FactValue = number | string | Range | Counts;

export type VerificationStatus = 'pass' | 'fail' | 'pending';

export interface Fact<V extends FactValue = FactValue> {
  value: V;
  /** null when the value has no unit (counts, text, configurations). */
  unit: string | null;
  /** Predicted, estimated or extrapolated. When true, value is never a single number. */
  uncertain: boolean;
  source: {
    /** https URL on one of the three whitelisted hosts. */
    url: string;
    /** YYYY-MM-DD */
    retrieved: string;
    /** Original contributor the page credits, e.g. "IUPAC CIAAW". Display only. */
    via?: string;
  };
  verification: {
    status: VerificationStatus;
    recordId: string;
  };
  /** Calculated from other verified facts by a named rule (derive.ts). */
  derivation?: { rule: DerivationRule; inputs: string[] };
}

export type DerivationRule =
  | 'protons-equal-atomic-number'
  | 'electrons-equal-atomic-number'
  | 'neutrons-from-mass-number'
  | 'shells-from-configuration'
  | 'valence-main-group';

export interface Isotope {
  massNumber: Fact<number>;
  atomicMass?: Fact<number>;
  abundance?: Fact<number | Range>;
}

export interface Element {
  id: `element:${string}`;
  atomicNumber: Fact<number>;
  symbol: Fact<string>;
  name: Fact<string>;
  period: Fact<number>;
  /** Omitted for lanthanides and actinides. */
  group?: Fact<number>;
  /** Number, or a Range where IUPAC gives an interval. Omitted with no stable isotopes. */
  atomicWeight?: Fact<number | Range>;
  /** No natural isotopes: longest-lived isotope per the AMDC half-life table. A mass number, not an atomic weight. */
  longestLivedIsotopeMassNumber?: Fact<number>;
  electronConfiguration: Fact<string>;
  electronegativity?: Fact<number>;
  valenceElectrons?: Fact<number>;
  state?: Fact<string>;
  meltingPoint?: Fact;
  boilingPoint?: Fact;
  density?: Fact;
  isotopes: Isotope[];
  atom: {
    /** Mass number of the isotope drawn. */
    isotope: number;
    protons: Fact<number>;
    neutrons: Fact<number>;
    electrons: Fact<number>;
    shells: Fact<Counts>;
  };
  discovery?: { year?: Fact<number | string>; story: Fact<string>[] };
  uses: Fact<string>[];
}

export interface OpenQuestion {
  id: OpenQuestionId;
  title: string;
  links: EntityId[];
  /** Sourced statement that the question is still unresolved. */
  isOpen: Fact<string>;
  known: Fact[];
  unknown: Fact[];
  ideas: { name: string; summary: Fact }[];
  hypothesisPrompt: string;
}

export interface VerificationRecord {
  id: string;
  subject: { entity: EntityId | OpenQuestionId; field: string };
  method: 'extract' | 'agent' | 'derive';
  claimedValue: FactValue;
  unit: string | null;
  sourceUrl: string;
  upstream?: string;
  retrievedValue: FactValue | null;
  evidence?: string;
  tolerance?: { absolute?: number; relative?: number };
  result: 'pass' | 'fail';
  /** ISO 8601 date-time */
  checkedAt: string;
  consistency: { runs: number; agreeing: number };
  verifier: string;
  notes?: string;
}

export type DatasetKind = 'elements' | 'open-questions' | 'verification-records';

export interface Dataset<K extends DatasetKind = DatasetKind> {
  schemaVersion: 2;
  kind: K;
  items: K extends 'elements'
    ? Element[]
    : K extends 'open-questions'
    ? OpenQuestion[]
    : K extends 'verification-records'
      ? VerificationRecord[]
      : unknown[];
}

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
    /** The value as the source spells it, when the app's spelling differs. */
    asWritten?: string;
  };
  verification: {
    status: VerificationStatus;
    recordId: string;
  };
  /** A condition, form or caveat the value carries, e.g. "sublimes". Always shown with it. */
  qualifier?: string;
  /** Calculated from other verified facts by a named rule (derive.ts). */
  derivation?: { rule: DerivationRule; inputs: string[]; weights?: number[] };
}

export type DerivationRule =
  | 'protons-equal-atomic-number'
  | 'electrons-equal-atomic-number'
  | 'neutrons-from-mass-number'
  | 'shells-from-configuration'
  | 'valence-main-group'
  | 'zero-for-element-in-standard-state'
  | 'reaction-enthalpy'
  | 'energy-direction';

export type Phase = 's' | 'l' | 'g';

/** A substance in a reaction: a compound, or an element as it occurs (Cl2, Na). */
export interface Compound {
  id: `compound:cid-${number}`;
  /** Set for a pure element: the element page it belongs to. */
  element?: `element:${string}`;
  /** Exact NIST WebBook ID, e.g. C7647145. */
  nistId?: string;
  name: Fact<string>;
  /** As chemists write it ("NaCl"); source.asWritten holds the source's spelling ("ClNa"). */
  formula: Fact<string>;
  /** State at 25 °C: "solid", "liquid" or "gas". */
  standardState: Fact<string>;
  /** kJ/mol, per phase. Empty when the sources have no value. */
  formationEnthalpies: { phase: Phase; value: Fact<number> }[];
  appearance?: Fact<string>;
  meltingPoint?: Fact;
  boilingPoint?: Fact;
  uses: Fact<string>[];
  /** GHS statements more than half of PubChem's notifiers report. */
  hazards: { code: string; statement: Fact<string>; reportedBy: Fact<number> }[];
}

export interface Species {
  substance: Compound['id'];
  coefficient: number;
  phase: Phase;
}

export interface Reaction {
  id: `reaction:${string}`;
  title: string;
  /** What the user picks in Combine mode to find this entry. */
  inputs: (EntityId)[];
  kind: 'reaction' | 'no-reaction';
  reactants?: Species[];
  products?: Species[];
  summary: Fact<string>[];
  whyNot?: Fact<string>[];
  bonding?: { type: Fact<string>; why: Fact<string>[] };
  energy?: {
    /** kJ for the equation as written; derived, with weights. */
    enthalpy?: Fact<number>;
    direction?: Fact<string>;
    trigger?: Fact<string>;
    /** Shown instead of the enthalpy when the sources have no value. */
    unavailable?: string;
  };
  hazard?: { why: Fact<string>[] };
}

export interface Isotope {
  massNumber: Fact<number>;
  atomicMass?: Fact<number>;
  abundance?: Fact<number | Range>;
  /** e.g. 4.21 with unit "My", or "Stable". */
  halfLife?: Fact<number | string>;
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
  /** Omitted when the contributors disagree (lawrencium). */
  electronConfiguration?: Fact<string>;
  electronegativity?: Fact<number>;
  valenceElectrons?: Fact<number>;
  /** "Metal", "Non-metal" or "Semi-metal". */
  classification?: Fact<string>;
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
    /** Omitted when the electron configuration is. */
    shells?: Fact<Counts>;
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
  subject: { entity: EntityId | OpenQuestionId | `concept:${string}`; field: string };
  method: 'extract' | 'agent' | 'derive';
  claimedValue: FactValue;
  unit: string | null;
  sourceUrl: string;
  upstream?: string;
  retrievedValue: FactValue | null;
  evidence?: string;
  /** Agreeing values from other contributors or sources. */
  corroboration?: { sourceUrl: string; upstream?: string; value: string | number }[];
  tolerance?: { absolute?: number; relative?: number };
  result: 'pass' | 'fail';
  /** ISO 8601 date-time */
  checkedAt: string;
  consistency: { runs: number; agreeing: number };
  verifier: string;
  notes?: string;
}

export type DatasetKind = 'elements' | 'compounds' | 'reactions' | 'open-questions' | 'verification-records';

export interface Dataset<K extends DatasetKind = DatasetKind> {
  schemaVersion: 4;
  kind: K;
  items: K extends 'elements'
    ? Element[]
    : K extends 'compounds'
    ? Compound[]
    : K extends 'reactions'
    ? Reaction[]
    : K extends 'open-questions'
    ? OpenQuestion[]
    : K extends 'verification-records'
      ? VerificationRecord[]
      : unknown[];
}

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

export type FactValue = number | string | Range;

export type VerificationStatus = 'pass' | 'fail' | 'pending';

export interface Fact<V extends FactValue = FactValue> {
  value: V;
  /** null when the value has no unit (counts, text, configurations). */
  unit: string | null;
  /** Predicted or disputed. When true, value is a Range. */
  uncertain: boolean;
  source: {
    /** https URL on one of the three whitelisted hosts. */
    url: string;
    /** YYYY-MM-DD */
    retrieved: string;
  };
  verification: {
    status: VerificationStatus;
    recordId: string;
  };
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
  claimedValue: FactValue;
  unit: string | null;
  sourceUrl: string;
  retrievedValue: FactValue | null;
  tolerance?: { absolute?: number; relative?: number };
  result: 'pass' | 'fail';
  /** ISO 8601 date-time */
  checkedAt: string;
  consistency: { runs: number; agreeing: number };
  verifier: string;
  notes?: string;
}

export type DatasetKind = 'open-questions' | 'verification-records';

export interface Dataset<K extends DatasetKind = DatasetKind> {
  schemaVersion: 1;
  kind: K;
  items: K extends 'open-questions'
    ? OpenQuestion[]
    : K extends 'verification-records'
      ? VerificationRecord[]
      : unknown[];
}

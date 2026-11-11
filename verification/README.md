# verification

The published audit trail (spec 6.1).

- [methodology.md](methodology.md): how facts are sourced, matched,
  cross-checked and dropped
- `records/`: per-fact verification records
  ([schema](../data/schema/verification-record.schema.json)), for example
  `records/elements/011-Na.json`
- `reports/`: one report per pipeline run, with coverage and every value left
  out and why
- `spot-reviews/`: human sampling audits at each checkpoint (spec 10.4a)

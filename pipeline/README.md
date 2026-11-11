# pipeline

The build-time content pipeline (spec 6). Python 3.12, standard library only:
no installs and no API key needed. It follows
[verification/methodology.md](../verification/methodology.md).

## Elements

```bash
python -m pipeline.elements            # all 118, using the download cache
python -m pipeline.elements --refresh  # fetch everything from the sources again
python -m pipeline.elements --only 11  # one element, printed, for debugging
python -m unittest discover -s pipeline/tests -t .
```

It reads PubChem element pages (PUG View), the LibreTexts electron
configuration table, and the NIST WebBook when contributors disagree. It
writes:

- `data/verified/elements/<Z>-<symbol>.json`: what the app loads
- `verification/records/elements/<Z>-<symbol>.json`: one record per fact
- `verification/reports/elements-<date>.md`: coverage, plus every value left
  out and why

Then `npm test` checks the result independently. It recomputes every derived
value in TypeScript and fails the build on anything unverified.

| File | Job |
|---|---|
| `fetch.py` | Polite, cached downloads (`pipeline/.cache/`, git-ignored). The cache date becomes each fact's retrieval date |
| `parse.py` | Strict parsers for every value format found on the 118 element pages |
| `derive.py` | Python twin of `app/src/data/derive.ts` |
| `nist.py` | NIST WebBook phase-change data, used only to break ties |
| `elements.py` | Builds each element: cross-checks, consistency checks, derived values, records, report |

Text facts (history, uses) are drafted and verified by agents in a later step.

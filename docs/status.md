# AtomiTron status

*Updated 2026-11-11. Phase 1 is complete and live. Phase 2 has started: the
element schema and verification methodology are approved and committed.
No elements have been verified yet.*

## Where things stand

**Phase 1 (skeleton): complete.** Merged through
[PR #1](https://github.com/jarretmorton/AtomiTron/pull/1) and live at
<https://jarretmorton.github.io/AtomiTron/>. It was checked on the iPad mini in
Safari. The repo is public, and Pages deploys through GitHub Actions on every
push to `main`.

**Phase 2 (elements): schema and methodology approved.** The work is on the
local branch `claude/phase-2-elements`, committed but not pushed.

- `npm test`: 108 of 108 tests pass
- `npm run typecheck`: clean
- `npm run build`: clean

## Phase 2 so far

| Area | Files | What changed |
|---|---|---|
| Element schema | [data/schema/element.schema.json](../data/schema/element.schema.json) | Every spec 3.2 field as a `Fact`: identity, period and group, atomic weight, configuration, electronegativity, valence, state, melting and boiling points, density, isotopes, the atom (protons, neutrons, electrons, shells), discovery, uses |
| Fact schema | [data/schema/fact.schema.json](../data/schema/fact.schema.json) | Adds derived values (`derivation`: a named rule plus input record IDs), count arrays (electrons per shell), and `source.via` (original contributor). Uncertain now means "never a single number" rather than "always a range" |
| Records | [data/schema/verification-record.schema.json](../data/schema/verification-record.schema.json) | Adds `method` (extract, agent or derive), `upstream`, and `evidence` (a short excerpt) |
| Envelope | [data/schema/dataset.schema.json](../data/schema/dataset.schema.json) | Adds the `elements` kind. `schemaVersion` bumped to 2 |
| Derivation rules | [app/src/data/derive.ts](../app/src/data/derive.ts) | Protons, electrons, neutrons, shells, valence. The configuration parser handles PubChem's flattened form (`[Ar]4s13d10`) |
| Build gate | [tests/integrity.ts](../tests/integrity.ts) | Recomputes every derived fact; checks that configuration electrons equal the atomic number, that the ID matches the symbol, that the right isotope is drawn, that uncertainty passes to derived values, and that each fact has its own record |
| Methodology | [verification/methodology.md](../verification/methodology.md) | **Approved.** Sources, match rules, tolerances, disagreement handling, consistency checks, derived values, which isotope the atom shows, uncertain values |

### What the PubChem survey found (all 118 elements, 2026-11-10)

- **PubChem's periodic-table summary disagrees with its own element pages**
  (technetium 96.90636 vs [98]). Only the element-page data is used.
- **Contributors contain real errors.**
  - Melting points: 18 elements disagree by more than 1 °C.
  - Boiling points: 28 elements disagree by more than 1 °C.
  - Krypton's boiling point appears with its minus sign missing.
  - Neon's melting point appears 10 °C apart, probably a typo.
  - No single contributor is always right.
- **Contributors disagree on the longest-lived isotope** of 11 radioactive
  elements, so the methodology uses the IAEA half-life table instead.

## Methodology decisions (approved 2026-11-11)

1. **Numbers are checked by code, not agents.** This deliberately departs
   from spec 6's wording. Code reading PubChem's structured data is exact,
   repeatable and needs no API key. Agents check written statements only.
2. **When contributors disagree:**
   - They must agree within 1 °C (melting and boiling points).
   - If they don't, the NIST WebBook breaks the tie.
   - If NIST can't, the value is dropped and listed in the release report.
   - Values given by only one contributor must pass the consistency checks.
3. **Valence electrons are shown only for main-group elements.**
4. **For radioactive elements,** the atom shows the longest-lived isotope from
   the IAEA half-life table.
5. **Temperatures are stored in °C** as the contributor states them. A reader
   setting shows them in °C, °F, K or °R, converted exactly
   ([app/src/units.ts](../app/src/units.ts)). A converted value keeps the
   stored decimal places and says "converted from ...". The settings control
   arrives with the element pages.

Still open from requirements section 9:
- trademark check on the name
- size and priority order of the first reaction set
- model and budget for the pipeline

## Decisions made earlier, and why

- **Deploy through GitHub Actions**, because Vite needs a build. It's the same
  `jarretmorton.github.io` host as Rock ID and Addonaut, and a failing test
  blocks the deploy.
- **Hash routes**, because Pages has no fallback for single-page apps.
- **The JSON Schema is the contract** between pipeline and app. The
  TypeScript types mirror it, and tests keep the two in agreement.
- **Drafts may use the `pending` and `fail` statuses.** Only `pass` renders
  or ships.
- **Entity IDs:** `element:Na`, `compound:cid-5234`,
  `reaction:sodium-chlorine`, `oq-...`.
- **LF line endings**, so records hash the same on every OS.
- **The repo is public; phases ship through a branch and pull request.**

## Known gaps, deliberately left for later

- **Phase 3:** compound and reaction data shapes, a derivation rule for
  reaction enthalpy (Hess's law over NIST inputs), and the hazard "no
  quantities or procedures" test.
- **Phase 5:** the Spot the Error isolation test.
- **Category colors** for the periodic table (which grouping scheme, and how
  it stays color-blind-safe) are decided when the table UI is built.

## Next steps

1. ~~Review the methodology draft.~~ Approved 2026-11-11.
2. ~~Commit the reviewed schema and methodology.~~ Done.
3. Build the extractor in `pipeline/` (Python):
   - fetch the PUG View data
   - parse each field
   - cross-check contributors, with the NIST tiebreak
   - run the consistency checks
   - write `data/verified/elements/` and `verification/records/elements/`
4. Draft and verify the text facts (history, uses) with verifier agents:
   three runs each, keeping short evidence excerpts.
5. Run all 118 elements, and write the first release report listing what was
   dropped and why.
6. Build the periodic table and element pages with the animated atom.
7. Open the phase 2 PR. **Checkpoint 1** follows: a human spot review of
   about 25 sampled facts, logged in `verification/spot-reviews/`.

## Picking it back up

Open the repo in Claude Code and say: *"Read docs/status.md and
docs/requirements.md, then continue from Next steps."* Update this file at
each pause.

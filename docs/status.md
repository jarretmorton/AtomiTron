# AtomiTron status

*Updated 2026-11-11. Phase 1 is complete and live. Phase 2: all 118
elements are verified (2,960 facts), and the methodology additions are
approved, with one deferred. Next: the text facts, then the periodic table
and element pages.*

## Where things stand

**Phase 1 (skeleton): complete.** Merged through
[PR #1](https://github.com/jarretmorton/AtomiTron/pull/1) and live at
<https://jarretmorton.github.io/AtomiTron/>. It was checked on the iPad mini in
Safari. The repo is public, and Pages deploys through GitHub Actions on every
push to `main`.

**Phase 2 (elements): numeric facts extracted and verified.** The work is on
the local branch `claude/phase-2-elements`, committed but not pushed.

- `python -m pipeline.elements` shipped **all 118 elements**: 2,960 facts,
  each with a passing record. The values left out are each listed with their
  reason in
  [verification/reports/elements-2026-11-11.md](../verification/reports/elements-2026-11-11.md).
- Lawrencium ships without its electron configuration, shells or valence,
  because the configuration is genuinely disputed: PubChem gives 6d1 and
  LibreTexts "probably" 7p1. Everything else about it ships.
- Spot-checked against well-known values (H, C, N, O, Na, Cl, Fe, Cu, Tc,
  Hg, U, Cn, Og), and all correct.
- `npm test`: 110 of 110 pass, and the gate accepts every generated fact.
- Python pipeline tests: 24 of 24 pass. They now also run in CI.
- `npm run typecheck` and `npm run build`: clean.

## Phase 2 so far

| Area | Files | What changed |
|---|---|---|
| Element schema | [data/schema/element.schema.json](../data/schema/element.schema.json) | Every spec 3.2 field as a `Fact`: identity, period and group, atomic weight, configuration, electronegativity, valence, state, melting and boiling points, density, isotopes, the atom (protons, neutrons, electrons, shells), discovery, uses |
| Fact schema | [data/schema/fact.schema.json](../data/schema/fact.schema.json) | Adds derived values (`derivation`: a named rule plus input record IDs), count arrays (electrons per shell), and `source.via` (original contributor). Uncertain now means "never a single number" rather than "always a range" |
| Records | [data/schema/verification-record.schema.json](../data/schema/verification-record.schema.json) | Adds `method` (extract, agent or derive), `upstream`, and `evidence` (a short excerpt) |
| Envelope | [data/schema/dataset.schema.json](../data/schema/dataset.schema.json) | Adds the `elements` kind. `schemaVersion` bumped to 2 |
| Derivation rules | [app/src/data/derive.ts](../app/src/data/derive.ts) | Protons, electrons, neutrons, shells, valence. The configuration parser handles PubChem's flattened form (`[Ar]4s13d10`) |
| Build gate | [tests/integrity.ts](../tests/integrity.ts) | Recomputes every derived fact; checks that configuration electrons equal the atomic number, that the ID matches the symbol, that the right isotope is drawn, that uncertainty passes to derived values, and that each fact has its own record |
| Methodology | [verification/methodology.md](../verification/methodology.md) | **Approved**, with additions from the first run marked *(pending)* |
| Pipeline | [pipeline/](../pipeline/) | Python, standard library only. Fetches and caches the sources, parses every value format strictly, cross-checks contributors (NIST tiebreak), runs consistency checks, derives the atom, and writes data, records and the report |
| Element data | `data/verified/elements/`, `verification/records/elements/` | 118 elements, about 1.7 MB of data plus 2.4 MB of records |
| Units | [app/src/units.ts](../app/src/units.ts) | Exact °C, °F, K and °R conversion for the reader's setting |

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

## Methodology additions from the first run (2026-11-11)

Approved:
- agreement within stated uncertainty
- IUPAC CIAAW as the authority for atomic weights and isotope abundances
- the IAEA mass table as the tiebreak for isotope masses
- LibreTexts table A1 as a second contributor for electron configurations
- predicted status for Z >= 100 bulk properties and Z >= 104 configurations
- a NIST tiebreak value recorded as corroboration

**Deferred:** approximate values ("~817 °C") and qualified values ("diamond",
"sublimation", "white phosphorus") are left out until we revisit them. This
affects carbon's and phosphorus's melting and boiling points, and astatine's
density.

**Known issue for that discussion: arsenic.** Its melting point ships as
817 °C from Jefferson Lab alone, after Los Alamos's "~817 °C" was set aside
as approximate. It passes the current checks. But arsenic doesn't melt at
normal pressure: it turns straight to gas at about 614 °C, and 817 °C is its
melting point under high pressure. The value is real but missing its
qualifier. Decided 2026-11-11: leave it as is, and handle it with #5 when
the qualified-values rule is revisited.

**Lawrencium** ships with everything except its disputed configuration: the
atom shows the nucleus and the electron count but no shells.

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
- **Loading element data:** 1.7 MB is too much to bundle at once for the iPad.
  The table needs a small index (symbol, name, position), and each element
  page should load its own file.
- **Lawrencium's page** needs an atom drawing with no shells, and a note
  that the electron arrangement is disputed. It's also a good phase 5 Open
  Question ("Where does lawrencium's outermost electron go?").
- **Approximate and qualified values** (deferred; see above).
- **PubChem section anchors** in the citation links (`#section=Melting-Point`)
  follow PubChem's pattern but haven't been checked in a browser yet.

## Next steps

1. ~~Review the methodology draft.~~ Approved 2026-11-11.
2. ~~Commit the reviewed schema and methodology.~~ Done.
3. ~~Build the extractor and run all 118 elements.~~ Done: 117 shipped, with
   a report.
4. ~~Approve the methodology additions.~~ Approved 2026-11-11; one deferred.
5. Draft and verify the text facts (history, uses) with verifier agents:
   three runs each, keeping short evidence excerpts.
6. Build the periodic table and element pages with the animated atom, the
   temperature-unit setting, and per-element loading.
7. Open the phase 2 PR. **Checkpoint 1** follows: a human spot review of
   about 25 sampled facts, logged in `verification/spot-reviews/`.

## Picking it back up

Open the repo in Claude Code and say: *"Read docs/status.md and
docs/requirements.md, then continue from Next steps."* Update this file at
each pause.

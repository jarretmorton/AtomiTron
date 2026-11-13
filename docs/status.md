# AtomiTron status

*Updated 2026-11-12. Phase 1 and phase 2 part 1 are live: the periodic
table and element pages for all 118 elements, with every fact verified and
cited, plus a 3D atom trial on the vanadium page. The history and uses
pilot (10 elements) is live for review on the iPad, ahead of the Claude API
re-run.*

## Where things stand

**Phase 1 (skeleton): complete.** Merged through
[PR #1](https://github.com/jarretmorton/AtomiTron/pull/1) and live at
<https://jarretmorton.github.io/AtomiTron/>. It was checked on the iPad mini in
Safari. The repo is public, and Pages deploys through GitHub Actions on every
push to `main`.

**Phase 2, part 1 (elements): live.** Merged through
[PR #2](https://github.com/jarretmorton/AtomiTron/pull/2) on 2026-11-11, and
deployed successfully.

- **Data:** `python -m pipeline.elements` shipped all 118 elements, 3,077
  facts, each with a passing record. The values left out are each listed
  with their reason in
  [verification/reports/elements-2026-11-11.md](../verification/reports/elements-2026-11-11.md).
- **Spot checks:** H, C, N, O, Na, Cl, Fe, Cu, Tc, Hg, U, Cn and Og were
  compared with well-known values, and all were correct.
- **App:**
  - a periodic table colored by metal, semi-metal or non-metal, with a shape
    for each as well
  - element pages with the animated atom, the numbers explained, physical
    properties with a °C/°F/K/°R setting, and isotopes
  - a citation chip on every value
- **Checked in headless Edge** at iPad mini size, portrait and landscape,
  light and dark. **Not yet seen on the real iPad.**
- **Tests:** on current `main`, `npm test` passes 125 of 125 and the Python
  pipeline 24 of 24. Typecheck and build are clean.
- **Local test runs on Windows:** run them from `C:/Users/...` (uppercase
  drive letter). From a `c:/...` path, vitest loads itself twice and every
  suite fails with "Cannot read properties of undefined (reading 'config')".
  CI isn't affected.

## Explanations corrected and verified (2026-11-12)

The six short explanations beside an element's numbers
([app/src/content/concepts.ts](../app/src/content/concepts.ts)) now each
have a verification record in `verification/records/concepts.json`. Three
independent verifiers (Claude Code subagents) passed every one. A test fails
the build if any sentence lacks a passing record for its exact text and
link.

Two of the original sentences failed, because they said more than their
LibreTexts pages do:
- **Shells:** now "Orbitals that have the same principal quantum number form
  a shell, and each shell is divided into subshells."
- **Valence:** now "Valence electrons are the electrons in the
  highest-numbered shell, plus any in the last unfilled subshell. They
  largely control an atom's chemistry."

They went live early, at your request, so you can review them on the iPad.
They were verified by subagents rather than the Claude API pipeline. The
methodology section describing this procedure is still marked for review.

## Phase 2, part 2: history and uses (pilot, live for review)

Prototyped with Claude Code subagents. **Published early on 2026-11-12, at
your request, so the wording can be reviewed on the iPad.** The spec
(10.1) says to switch to the Claude API pipeline before anything is
published. That re-run is still required before a wider release, and it
will replace these records.

- **Pilot elements:** H, C, N, O, Na, Mg, Cl, Fe, Cu, Au.
- **The run:** one drafter wrote 70 statements and 7 discovery years. Code
  checks rejected none. Three independent verifiers then judged them.
- **Result:** 71 element statements passed with 3 of 3 agreement, and ship
  in this branch's data, with records.
- **Left out:**
  - Iron, copper and gold discovery years: their passages say
    "prehistoric", not "ancient".
  - Gold's name origin: it gave two of the passage's three sources, and
    passed only 2 of 3.
- **Discovery years left blank** because the sources conflict: hydrogen
  (1766 vs 1776), oxygen (1771 vs 1774), magnesium (three years).
- **Audit trail:** `verification/agent-runs/2026-11-12-elements-text-pilot/`
  (already on `main` with the explanation fix). Full source passages stay in
  the local cache; only short excerpts are committed.
- **Known limit:** a record keeps one excerpt of at most 25 words. For a
  two-sentence claim, that may cover only the first sentence, although the
  verifier judged both.

## The moving 3D atom (all elements with shells)

Live: merged through [PR #3](https://github.com/jarretmorton/AtomiTron/pull/3)
and [PR #4](https://github.com/jarretmorton/AtomiTron/pull/4) on 2026-11-11,
from a separate Claude Code session. On the vanadium page, tapping the
flat atom (it now has a "Tap for 3D" label) opens a full-screen 3D version of
the same shell model: [app/src/ui/atom3d.ts](../app/src/ui/atom3d.ts).

- It uses the same verified counts as the flat atom and adds no new facts.
  Each shell's electrons are spread over up to three tilted rings (vanadium:
  2 / 4+4 / 4+4+3 / 2). A test checks the rings always add up to the shell.
- Canvas 2D with its own projection: no library, no network. Drag (or arrow
  keys) to turn it, flick to spin it (the spin eases back to a slow turn),
  and pinch, wheel or the − / + buttons to zoom. With reduced motion on, it
  only moves when dragged.
- Particle colors, flat and 3D: protons red, neutrons blue, electrons yellow
  (asked for 2026-11-11), all solid. Neutrons were hollow rings so they
  could be told from protons without color; solid blue was asked for, so
  red versus blue (plus the labelled legend) is now the only cue. Electrons
  have a darker edge in light mode because yellow is faint on paper. Pinch
  zoom couldn't be exercised headlessly; check it on the iPad.
- Checked in headless Chromium at iPad mini size, both orientations, light
  and dark. **Not yet seen on the real iPad.**
- **Rolled out to every element with verified shells** on 2026-11-12, after
  you tried the vanadium trial on the iPad. Lawrencium stays flat, because
  its shell arrangement is disputed. Oganesson (7 shells, 21 rings, 295
  nucleons) was checked in a headless browser: it's dense but renders. Worth
  a spin on the iPad to check it stays smooth.

## What was built in phase 2

| Area | Files | What it does |
|---|---|---|
| Element schema | [data/schema/element.schema.json](../data/schema/element.schema.json) | Every spec 3.2 field as a `Fact`, plus classification and isotope half-lives. The configuration and shells are optional (lawrencium) |
| Fact schema | [data/schema/fact.schema.json](../data/schema/fact.schema.json) | Derived values (named rule plus inputs), count arrays, the original contributor (`source.via`). Uncertain means "never a single number" |
| Records | [data/schema/verification-record.schema.json](../data/schema/verification-record.schema.json) | `method` (extract, agent or derive), `upstream`, `evidence`, `corroboration` |
| Pipeline | [pipeline/](../pipeline/) | Python, standard library only. Strict parsers, contributor cross-checks, the NIST and IAEA tiebreaks, consistency checks, the derived atom, records and a report |
| Build gate | [tests/integrity.ts](../tests/integrity.ts) | Recomputes every derived fact in TypeScript and runs the element checks. Fails the deploy on anything unverified |
| Methodology | [verification/methodology.md](../verification/methodology.md) | Approved, with one rule deferred (approximate and qualified values) |
| Element index | [vite.config.ts](../vite.config.ts) | Builds a small table index from verified facts only. Each element page loads its own file (about 15 KB) |
| Periodic table | [app/src/views/table.ts](../app/src/views/table.ts) | 44 px tiles, sideways scrolling in portrait, metal / semi-metal / non-metal colors with shapes (● ◆ ▲), dashed borders for predictions |
| Element page | [app/src/views/element.ts](../app/src/views/element.ts) | The atom, the numbers, physical properties with the unit picker, isotopes. Every value goes through `factRow()`, which refuses unverified facts |
| The atom | [app/src/ui/atom.ts](../app/src/ui/atom.ts) | SVG plus CSS rotation. Solid protons, hollow neutrons, dashed predicted shells, and no shells when the configuration is disputed |
| Explanations | [app/src/content/concepts.ts](../app/src/content/concepts.ts) | Six short definitions, each citing the LibreTexts page that states it |
| Units | [app/src/units.ts](../app/src/units.ts) | Exact °C, °F, K and °R conversion. Keeps the stored decimal places and says "converted from ..." |

### What the PubChem survey found (all 118 elements, 2026-11-10)

- **PubChem's periodic-table summary disagrees with its own element pages**
  (technetium 96.90636 vs [98]). Only the element-page data is used.
- **Contributors contain real errors.**
  - Krypton's boiling point appears with its minus sign missing.
  - Neon's melting point appears 10 °C apart.
  - Melting points of 18 elements disagree by more than 1 °C, and boiling
    points of 28.
  - No single contributor is always right.
- **PubChem's nitrogen page has no electron configuration**, so it comes from
  LibreTexts table A1.
- **Lawrencium's configuration is genuinely disputed:** PubChem gives 6d1 and
  LibreTexts "probably" 7p1.

## Methodology decisions (all approved 2026-11-11)

1. Numbers are checked by code, not agents. This deliberately departs from
   spec 6's wording.
2. Contributors must agree within 1 °C. If they don't, the NIST WebBook
   breaks the tie, or the value is dropped. Single-contributor values must
   pass the consistency checks.
3. Valence electrons are shown only for main-group elements.
4. Radioactive elements show their longest-lived isotope, from the IAEA
   half-life table.
5. Temperatures are stored in °C and shown in the reader's unit (°C, °F, K
   or °R), converted exactly.
6. Values agree when they're within their stated uncertainties.
7. IUPAC CIAAW is the authority for atomic weights and isotope abundances.
8. The IAEA mass table breaks ties on isotope masses.
9. LibreTexts table A1 is the second contributor for electron configurations.
10. From Z = 100, bulk properties are predictions. From Z = 104,
    configurations are too.
11. A NIST tiebreak value is recorded as corroboration.

**Deferred (#5 from the review):** approximate values ("~817 °C") and
qualified values ("diamond", "sublimation", "white phosphorus") are left out
until we revisit them. This affects carbon's and phosphorus's melting and
boiling points, and astatine's density.

**Known issue for that discussion: arsenic.** Its melting point ships as
817 °C from Jefferson Lab alone. But arsenic doesn't melt at normal pressure:
it turns straight to gas at about 614 °C, and 817 °C is its melting point
under high pressure. Decided 2026-11-11: leave it, and handle it with #5.

**Lawrencium** ships with everything except its disputed configuration. Its
atom shows the nucleus and a note instead of shells.

Still open from requirements section 9:
- trademark check on the name
- size and priority order of the first reaction set
- model and budget for the pipeline

## Decisions made earlier, and why

- **Deploy through GitHub Actions**, because Vite needs a build. It's the same
  `jarretmorton.github.io` host as Rock ID and Addonaut, and a failing test
  blocks the deploy.
- **Hash routes** (`#/element/Na`), because Pages has no fallback for
  single-page apps.
- **The JSON Schema is the contract** between pipeline and app. The
  TypeScript types mirror it, and tests keep the two in agreement.
- **The table is colored by Jefferson Lab's classification** (metal,
  semi-metal, non-metal), not by the 18 groups. Three classes stay
  color-blind-safe and each color stands for a sourced fact. Metal versus
  non-metal is also what phase 3's bonding explanations need.
- **The repo is public; phases ship through a branch and pull request.**

## Known gaps, deliberately left for later

- **Table tiles** show symbol, number and name as navigation. Each tile's
  values are cited on its element page, one tap away, rather than on the
  tile itself.
- **The explanations** in `concepts.ts` were checked against their LibreTexts
  pages by hand. They get formal verification records in the text-facts
  step.
- **Approximate and qualified values** (deferred; see above).
- **Phase 3:** compound and reaction data shapes, a derivation rule for
  reaction enthalpy (Hess's law over NIST inputs), and the hazard "no
  quantities or procedures" test.
- **Phase 5:** the Spot the Error isolation test, and lawrencium as a "Nobody
  knows yet" Open Question.

## Next steps

1. ~~Review and merge the phase 2 PR.~~ Merged and live 2026-11-11.
   **Still to do: check it on the iPad mini**, along with the 3D atom trial
   on vanadium (pinch zoom, flick to spin, the − / + buttons):
   - the table in both orientations, including the sideways swipe in
     portrait
   - a few element pages
   - the temperature-unit buttons
   - ~~that citation links open PubChem at the right section~~ Confirmed
     working on the iPad, 2026-11-12.
2. **Phase 2, part 2: history and uses.** The pilot of 10 elements is live
   for review (see above). Next:
   - review the pilot's wording
   - ~~build the Claude API version~~ Built 2026-11-13: `pipeline/agents_api.py`
     plus the "Run verification" workflow, on Claude Opus 5.5 at high effort.
     The `ANTHROPIC_API_KEY` repository secret is set.
   - run "Run verification" (reverify-pilot), about $1–2: it re-checks the
     pilot's statements through the API and compares them claim by claim with
     the subagent run. Review and merge its results PR.
   - then scale to all 118 elements
3. **Checkpoint 1:** a human spot review of about 25 sampled facts, logged
   in `verification/spot-reviews/`.

## Picking it back up

Open the repo in Claude Code and say: *"Read docs/status.md and
docs/requirements.md, then continue from Next steps."* Update this file at
each pause.

# AtomiTron status

*Updated 2026-11-15. Phases 1 and 2 are complete and live: all 118 elements
with verified facts, 3D atoms, and history and uses checked through the
Claude API. Checkpoint 1 is done and its fixes are live. Phase 3
(reactions) has started: the plan is decided, and the schema and build
checks are drafted for review.*

## Phase 3: reactions (started 2026-11-15)

On branch `claude/phase-3-reactions`. The plan and its decisions are in
[phase-3-plan.md](phase-3-plan.md).

- **Decided:** the starter list of 50 (thermite out), hazardous classics in
  with badges, reactions without energy data ship without energy numbers,
  qualified values shown with their qualifier, hazard statements only when
  most notifiers report them, reactions in water later, and glucose's
  energy shown with a "single measurement" label.
- **Coverage check:** 33 of 35 compounds have a reviewed formation enthalpy
  in the NIST WebBook. Calcium carbonate and zinc sulfide have none.
- **Schema (drafted, for review):** `compound.schema.json` and
  `reaction.schema.json`, a `qualifier` field on facts, three new
  derivation rules, and `schemaVersion` 4.
- **Build checks (drafted):** every equation must balance and use the
  smallest whole-number coefficients, and a reaction's enthalpy must be
  computed from exactly its own species and coefficients.
- **Methodology:** section 14 is a draft for review.
- **Pipeline, first part (2026-11-15):** `python -m pipeline.compounds`
  reads the curated list in `data/reactions/definitions.json` (57 substances
  with exact PubChem and NIST IDs, 43 equations and 6 no-reaction pairs). It
  checks every formula against both sources, checks every equation
  balances, extracts formation enthalpies and computes reaction energies.
  - **Result:** all 57 substances resolved, and 34 of 43 reactions have a
    computed energy (35 after the magnesium oxide decision below). The
    TypeScript rules recompute them all to the same values.
  - **Output:** `data/staged/reactions.json` (staged, not published) and
    `verification/reports/reactions-2026-11-15.md`.
  - **Without energy, 8:** calcium carbonate (2) and zinc sulfide (1) have no
    WebBook value, and five happen in water (the alkali metals with water,
    and the two halogen displacements).
  - **Magnesium oxide (decided 2026-11-15):** its two reviewed values
    differ by slightly more than the stated uncertainty, so it's shown as a
    range, and magnesium burning gets an energy range (−1203.2 to
    −1202.5 kJ). That makes 35 of 43 reactions with an energy.
  - **Calcium and water** keeps its energy (decided 2026-11-15), because
    calcium hydroxide mostly forms as a solid.
  - The list has 49 entries, not 50: "nitrogen and oxygen at room
    temperature" is the same pair as the nitrogen and oxygen reaction.
- **Text step (2026-11-16, PR #22):**
  `pipeline/reaction_text.py` drafts and verifies each reaction's text
  (summary, bonding, trigger, hazard note, why-not) and each substance's
  state, appearance and uses through the Claude API, with the same 3-of-3
  rule and code checks as element text. A pilot of five reactions
  (sodium + chlorine, hydrogen + oxygen, methane + oxygen, iron + sulfur,
  helium + oxygen) is the `reactions-pilot` task in the "Run verification"
  workflow.
  - **States:** 21 of the 22 elemental substances get their state at
    25 °C from code, from their verified melting and boiling points (a
    melting point above 25 °C settles it alone). Carbon, and all compounds,
    are agent-checked.
  - **Hazard statements:** extracted for all 57 substances (those more than
    half of ECHA's notifiers report).
- **Full run (2026-11-16, run 43786687113, $18.62):** 363 of 397
  statements passed 3 of 3. States come from code where possible (elements
  from their points, compounds from PubChem melting points).
- **Decided 2026-11-16 after the full run:** CAMEO's glucose entry (a
  solution) is left out of glucose's melting points; no-reaction pairs
  "don't react under everyday conditions"; lithium + oxygen replaces
  sodium + oxygen (sodium makes a mixture with its peroxide).
- **Re-run (run 43789107123, $0.60)** for lithium + oxygen and gold +
  oxygen. Assembled from both runs: **all 57 compounds and 49 reactions**
  are verified and pass the gate, in `data/verified/`.
  Pilots: $2.00 and $2.11. **Total API spend so far: about $67.**
- **Not built yet:** the Combine screens.
- **Arsenic's melting point** still needs its fix, to be confirmed when the
  qualifier rule is built into the element pipeline.

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

## Checkpoint 1: spot review (done 2026-11-15)

The record is [verification/spot-reviews/checkpoint-1.md](../verification/spot-reviews/checkpoint-1.md).

- **Result:** 24 of 25 sampled facts were checked by hand. The reviewer
  agreed with the pipeline on 21 (88%). One fact had been removed from the
  app before the review.
- **Three "Doesn't match" findings,** all derived counts: sulfur's valence
  electrons, and the shell counts of zirconium and neptunium. No value was
  wrong. The finding is that a reader can't confirm these counts from what
  the app cites: the working isn't shown, and the app writes configurations
  in a different order than PubChem does.
- **Category re-check** (required by spec 10.4a):
  - All 103 shell counts that LibreTexts table A1 covers match its printed
    shell rows.
  - All 44 valence counts match an independent group-number rule.
- **Four fixes, approved and built 2026-11-15:**
  1. Shell counts cite LibreTexts table A1 directly (103 elements); the
     derivation stays as the build's cross-check.
  2. The page shows the working for shell and valence counts.
  3. Where PubChem orders a configuration differently, the page shows its
     spelling beside the app's (87 elements; new `source.asWritten` field,
     `schemaVersion` 3).
  4. A new explanation of how to read a configuration, verified through the
     Claude API (the `verify-explanations` task, which checks only new or
     reworded explanations).

## Phase 2, part 2: history and uses (pilot, live for review)

Prototyped with Claude Code subagents, and published early on 2026-11-12 at
your request, for review on the iPad.

**Re-verified through the Claude API on 2026-11-13**, in Run verification
43385337386 (about $1.95). [PR #10](https://github.com/jarretmorton/AtomiTron/pull/10)
publishes those records, which replaces the subagent ones and closes the
early-publication exception.
- **Result:** 74 of 83 claims passed.
- **Dropped:** five uses sentences, which an over-broad reading of the new
  partial-list rule rejected. That rule has since been narrowed for future
  runs.
- **Agreement with the subagent run:** 94% on identically worded claims.
- **Earlier runs:** two that day were superseded. One ran before the
  discovery-year check (iron's "ancient" claim passed); the other ran
  before PR #9 was merged.
- **API spend so far:** about $43.25 (including $0.24 on 2026-11-15 for the
  new configuration explanation). That includes run #4 (the 108
  elements, about $17.62), whose results were lost; run #5 (about $2.83),
  which stopped early; and run #6 (about $17.00), the one published.

**Run #6 (2026-11-14): history and uses for the other 108 elements.**
- **Calls:** 108 drafting and 324 verifier calls, all answered by Claude
  Opus 5.5, with no refusals or errors.
- **Results:** 701 claims verified and **691 passed** 3 of 3. 10 failed, and
  13 were rejected by code first (mostly by the safety screen, on wording
  such as "mixed with" or "bombarding").
- **Reviewed before publishing:** a safety scan of all passing statements
  (no weapons, poisons, drugs or procedures), and a read of arsenic,
  mercury, polonium and uranium.
- **Audit trail:** `verification/agent-runs/2026-11-14-api-elements/`.

**Run #4 (2026-11-13, 108 elements) was lost.** It drafted 708 claims, and
699 passed 3 of 3. The gate then failed: the run had also re-checked the six
explanations, and one verifier rejected the neutrons sentence (which passed
in every earlier run), so its record was removed. The workflow only saved
results after a passing gate, so nothing was kept. Fixed since:
- element runs leave the explanations alone
- results are pushed before the gate
- an API error now fails only its own claims, not the whole run

**Run #5 (2026-11-14) stopped making progress after 49 drafts.** Every later
request was refused with "400 Bad Request". That's almost certainly the
account's credit or spend limit running out at about $26 of total spend
(the message wasn't recorded then). The run carried on and returned "no
verdict" for all 369 claims; its branch `verification/run-43563709054` must
not be merged. Since then, a refused request (bad request, key, permission,
credit) stops the whole run at once, records the API's message, and keeps
what's done.

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

## Color mode: System, Light, Dark

Since 2026-11-15 the header button shows the current color mode and steps
System → Light → Dark ([app/src/theme.ts](../app/src/theme.ts)). System
follows the iPad's own setting and is the default; choosing it clears the
saved choice. Checked in headless Chromium, not yet on the real iPad.

## The version number counts itself

Since 2026-11-15 the version in the header is `major.minor` from
`package.json` plus the number of commits being built (for example
`v0.1.40`), worked out in [vite.config.ts](../vite.config.ts). Every merge to
`main` raises it, so small changes show up as a new number without anyone
bumping it. The deploy workflow fetches the full history so the count is
right.

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
   - ~~re-verify the pilot through the API~~ Done; PR #10 publishes it.
   - ~~scale to the remaining 108 elements~~ Done in run #6 (PR from
     `verification/run-43564971048`). Every element now has history and
     uses text verified through the Claude API.
3. ~~Checkpoint 1.~~ Done 2026-11-15: see the section above. Its four
   fixes are built.

## Picking it back up

Open the repo in Claude Code and say: *"Read docs/status.md and
docs/requirements.md, then continue from Next steps."* Update this file at
each pause.

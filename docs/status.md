# AtomiTron status

*Updated 2026-11-10. Phase 1 (skeleton) is built and in a pull request; merging it deploys.*

## Where things stand

Phase 1 from [requirements.md](requirements.md) section 10.4 is done. It's
committed on the branch `claude/phase-1-skeleton`, with a pull request into
`main`. The repo is now public, and GitHub Pages is set to deploy through
GitHub Actions.

Checks at pause:

- `npm test`: 44 of 44 tests pass (schema tests and the verified-data gate)
- `npm run typecheck`: clean
- `npm run build`: builds `dist/` with relative asset paths
- Served locally under `/AtomiTron/` the way Pages serves it, every file
  loaded. Checked in headless Edge at iPad mini size, portrait and landscape,
  light and dark. **Not yet seen on the real iPad in Safari.**

## What was built

| Area | Files | Notes |
|---|---|---|
| Project rules | [CLAUDE.md](../CLAUDE.md) | Correctness first, exactly three sources, no how-to content for hazards, touch first, static at runtime, Spot the Error isolation, data rules, layout, deploy |
| Data schema | [data/schema/](../data/schema/) | JSON Schema 2020-12, shared with the future Python pipeline. Defines facts, open questions, verification records, and the file envelope |
| TypeScript types | [app/src/data/schema.ts](../app/src/data/schema.ts) | Mirror of the JSON Schema |
| Render gate | [app/src/data/facts.ts](../app/src/data/facts.ts) | `isRenderable()` shows a fact only with a passing status, a record ID and a whitelisted source |
| Build gate | [tests/integrity.ts](../tests/integrity.ts), [tests/](../tests/) | Every fact in `data/verified/` must pass the schema and `isRenderable()`, and have a passing record in `verification/records/` with the same source URL, value and unit |
| App shell | [app/](../app/) | Vite and TypeScript. Table, Combine and Journal tabs as placeholders, hash routing, light/dark toggle, 44 px touch targets, iPad safe areas |
| Icons | [app/public/](../app/public/), [scripts/make_icons.py](../scripts/make_icons.py) | Carbon-atom icon. The script generates the SVG and both PNGs from the same shapes |
| Deploy | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | Test, then build, then publish `dist/` to Pages. Pull requests test and build but don't deploy |
| Placeholders | `data/verified/`, `data/spot-the-error/`, `pipeline/`, `verification/` | READMEs only, filled in from phase 2 |

## Decisions made, and why

- **Deploy through GitHub Actions, not straight from a branch.** Rock ID and
  Addonaut publish `main` / root because they have no build step. Vite needs
  one. The things that matter on the iPad are unchanged: the same
  `jarretmorton.github.io` host (already allowed), relative paths, and the
  same three icon files. The workflow also provides the spec 10.5 gate,
  because a failing test blocks the deploy.
- **Hash routes** (`#/table`, later `#/element/Na`), because Pages has no
  fallback for single-page apps.
- **The JSON Schema is the contract** between the Python pipeline and the app.
  TypeScript types mirror it. Tests check that the schema and `isRenderable()`
  reject the same bad facts.
- **The fact schema allows `pending` and `fail`** so pipeline drafts can use
  it. Only `isRenderable()` and the build gate require `pass`.
- **Entity IDs:** `element:Na`, `compound:cid-5234` (PubChem CID),
  `reaction:sodium-chlorine`. Open questions use `oq-...`.
- **The gate finds facts by their `verification` key** anywhere in a file, so
  it keeps working when the phase 2 and 3 data shapes are added.
- **LF line endings** (`.gitattributes`), so data and verification records
  hash the same on every OS.

## Decisions

Settled on 2026-11-10:

- The repo is **public**, matching Rock ID, Addonaut and spec 6.1.
- Pages source is **GitHub Actions**.
- Phase 1 ships through a branch and pull request, like the Rock ID flow.

Still open from requirements section 9:
- trademark check on the name
- size and priority order of the first reaction set
- model and budget for the pipeline

Hosting is now answered: same host, deployed through Actions.

## Known gaps, deliberately left for later phases

- **Element, compound and reaction data shapes:** the file envelope only knows
  `open-questions` and `verification-records` so far. Phase 2 adds `elements`,
  and phase 3 adds `compounds` and `reactions`.
- **Calculated values** such as reaction enthalpies come from several NIST
  inputs. A fact currently has one `source`, so phase 3 needs a way to show
  the calculation and link every input.
- **Hazard test:** no quantities or procedures (spec 10.5), due in phase 3.
- **Spot the Error isolation test:** a guard that normal-mode code never
  imports `data/spot-the-error/`, due in phase 5.
- **Verification methodology document**, with match rules and numeric
  tolerances, due with the pipeline in phase 2.

## Next steps

1. Review phase 1: read [CLAUDE.md](../CLAUDE.md), skim the schema, and run
   `npm install && npm run dev`.
2. Merge the phase 1 pull request, which deploys it. Then confirm that
   <https://jarretmorton.github.io/AtomiTron/> loads on the iPad mini in
   Safari, and that Add to Home Screen picks up the icon.
3. Start **phase 2 (elements)**:
   - Add the `elements` kind and element schema, with every displayed value a
     `Fact`.
   - Write `verification/methodology.md`: what counts as a match, and the
     numeric tolerances.
   - Run verification for all 118 elements with Claude Code subagents (the
     execution path for phases 1 to 3), using PubChem PUG REST. Each fact
     gets a verification record, and failures get one retry before being
     dropped and listed.
   - Build the periodic table (color-blind-safe group colors, each with a
     label) and element pages with the animated atom and a source link on
     every fact.
4. **Checkpoint 1** comes after phase 2: a human spot review of about 25
   sampled facts, logged in `verification/spot-reviews/`.

## Picking it back up

Open the repo in Claude Code and say: *"Read docs/status.md and
docs/requirements.md, then continue from Next steps."* Update this file at
each pause.

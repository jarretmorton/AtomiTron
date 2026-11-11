# AtomiTron — project rules

An interactive chemistry explorer for one advanced young learner on an iPad mini.
The full spec is [docs/requirements.md](docs/requirements.md) and it wins over
anything here. Build in the phases of section 10.4, and **stop for review at the
end of each phase** with a summary. Current progress, open decisions and next
steps are in [docs/status.md](docs/status.md). Read it first, and update it
whenever work pauses.

## Non-negotiables

1. **Correctness first.** This is an educational tool for a child, so a wrong
   fact is the worst possible bug. Anything that can't be verified does not
   ship. Drop it and list it in the release report. Never ship a guess, an
   approximation dressed as a fact, or a value "from memory".

2. **Exactly three sources.** Every fact shown in the app has a tappable
   citation to one of these, over `https`, and nothing else:
   - `pubchem.ncbi.nlm.nih.gov`: element and compound data, properties, GHS
     hazards, uses
   - `webbook.nist.gov`: formation enthalpies (reaction energies are
     calculated from these, with the math shown and the inputs linked)
   - `chem.libretexts.org`: conceptual explanations

   No Wikipedia, no textbooks, no other sites, not even as a "second source".
   Adding a domain is a spec change that only the user can make.

3. **Hazards: textbook level only.** Dangerous reactions are included with a
   hazard badge and a "why this is dangerous" note built from PubChem GHS data.
   **Never** include quantities, concentrations, setups, procedures, or how-to
   steps anywhere: app copy, data, pipeline prompts or their output, comments,
   or test fixtures. The energy layer may name the *kind* of trigger (heat,
   spark, catalyst) and nothing more operational than that.

4. **Touch first, on an iPad mini in Safari.** Usable one-handed in portrait
   and landscape. Touch targets are at least 44 pt. Nothing is hover-only. The
   look is serious and professional, like a real lab reference, not cartoonish.
   Use readable type, a color-blind-safe palette (color never carries meaning
   on its own; pair it with a label, symbol or pattern), and support light and
   dark mode.

5. **Static at runtime.** No backend, no API keys, no live AI calls, and no
   network requests beyond the bundle itself (the only exception is a source
   link the user taps). No accounts, no logins, no personal data. Persistence
   is `localStorage` plus JSON export and import of the journal.

6. **Spot the Error stays isolated.** Planted errors live only in
   `data/spot-the-error/` and never mix with verified data. Normal mode never
   imports that folder. Entering the mode is deliberate. While it's on, the
   mode is visually unmistakable (distinct color scheme plus a persistent
   banner). Leaving it restores the verified data immediately.

## Data rules (spec 10.3)

The schema lives in [data/schema/](data/schema/) (JSON Schema 2020-12, shared
with the Python pipeline). It's mirrored by the TypeScript types in
[app/src/data/schema.ts](app/src/data/schema.ts).

- Every displayed fact is a `Fact`: `value`, `unit`, `uncertain`,
  `source.url`, `source.retrieved` (date) and `verification.status` plus
  `verification.recordId`.
- **The app renders a fact only if `isRenderable(fact)` passes**
  ([app/src/data/facts.ts](app/src/data/facts.ts)). That means a passing
  status, a record ID, and a whitelisted source URL. Never bypass it.
- **The build fails on any unverified fact.** The test suite checks every fact
  in `data/verified/` against the schema and `isRenderable`. It also requires
  a passing record in `verification/records/` with a matching source URL and
  value.
- Uncertain values (such as superheavy predictions) are `{ min, max }` ranges
  with `uncertain: true`. Show the range, never one falsely precise number.
- Open questions are objects linked to entity IDs. The claim that a question
  is open is itself a sourced `Fact`.
- Entity IDs: `element:Na`, `compound:cid-5234` (PubChem CID),
  `reaction:sodium-chlorine`.
- When the schema changes, update the JSON Schema, the TypeScript types and the
  tests together, and bump `schemaVersion`.

## Repo layout

```
app/                 the web app (Vite root): index.html, public/ icons, src/
data/schema/         JSON Schema for facts, open questions, verification records
data/verified/       verified element and reaction JSON; the ONLY data normal mode loads
data/spot-the-error/ planted errors, kept separate
pipeline/            Python orchestrator, drafting, verifier and evaluator agents and prompts
verification/        methodology, per-fact records, review log, spot reviews, release reports
tests/               schema tests and the data-integrity gate
scripts/             one-off tools (icon generation)
```

## Commands

```
npm run dev        # local dev server
npm test           # schema tests + data-integrity gate
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then build to dist/
npm run preview    # serve dist/ locally
```

## Deployment

- The app is hosted on GitHub Pages at <https://jarretmorton.github.io/AtomiTron/>.
  That's the same `jarretmorton.github.io` origin as Rock ID and Addonaut,
  which is already allowed on his iPad.
- Those two apps have no build step and deploy from `main` / root. AtomiTron
  needs Vite, so [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
  runs the tests, builds, and deploys `dist/`. A failing test blocks the
  deploy.
- Asset paths are relative (Vite `base: './'`), like Rock ID. Use hash routes
  (`#/element/Na`), because Pages has no fallback for single-page apps.
- Always ship the icons. Without them, a github.io page shows whatever icon the
  browser cached for the origin (the Rock ID lesson). `app/public/icon.svg` is
  the master. Regenerate the PNGs with `python scripts/make_icons.py`, never
  by hand.

## Pipeline execution path (spec 10.1)

Phases 1 to 3 run verification with Claude Code subagents on the subscription.
Before anything is published, switch to the Python and Claude API pipeline in
`pipeline/`, so anyone can reproduce the published verification record from
the public repo.

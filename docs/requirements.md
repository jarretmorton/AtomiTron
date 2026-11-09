# AtomiTron — Requirements v0.3

*Name chosen: AtomiTron (previously TronForge, and before that the placeholder Bondsmith).*

## 1. Purpose

An interactive chemistry exploration web app for an advanced young learner. He starts at the periodic table, picks elements, sees whether and how they combine, and digs as deep as his curiosity takes him. Every fact can be checked against a whitelisted source.

The content is generated and verified by a multi-agent pipeline (orchestrator-workers plus evaluator-optimizer), applying aerospace-style verification and validation discipline to AI-generated educational content.

## 2. Users and platform

- Primary user: one child, using an iPad mini (touchscreen, Safari).
- Hosted the same way as Rock ID and Addonaut (static web app, already approved in his iOS settings).
- Touch first: large tap targets, no hover-only interactions.
- The app runs entirely from static data at runtime. No API keys, no live AI calls.

## 3. Core features

### 3.1 Periodic table

- Full interactive table, color-coded by group using color-blind-safe colors.
- Tapping an element opens its element page.

### 3.2 Element page

- Animated atom: protons and neutrons in the nucleus, electrons in their shells.
- All the table numbers explained: atomic number, mass, proton, neutron and electron counts, electron configuration, valence electrons, electronegativity.
- Isotopes, physical properties, discovery, and uses.
- A source link next to every fact.

### 3.3 Combine mode

- Select two or more elements (or compounds) to see whether they react.
- If they don't react: explain why in plain language.
- If they do, show the result in layers:
  1. **Summary:** what forms, in plain language, plus an animated reaction diagram showing the electrons transferring or being shared.
  2. **Bonding:** ionic, covalent or metallic, and why, with a detailed electron and shell diagram.
  3. **Energy:** exothermic or endothermic, and what it takes to start the reaction (heat, spark, catalyst).
  4. **New substance:** melting point, boiling point, state, appearance, uses.
  5. **Real chemistry:** balanced equation and enthalpy, with the calculation shown.

### 3.4 Discovery journal and challenges

- Open sandbox by default.
- A journal that automatically collects every compound he discovers.
- Badges and optional challenges, like "Can you make table salt?"

### 3.5 Spot the Error mode

- A separate mode he has to switch on deliberately. Normal mode never contains planted errors, so he can always trust it.
- While the mode is on, it's always visible: a distinct color scheme and a persistent banner.
- Planted errors are harmless and plausible, like a wrong melting point or a miscounted neutron number.
- He finds them by checking facts against the linked sources, then reports them in the app.
- Found errors are revealed with an explanation of the correct value and the source. Progress counts toward badges.
- Planted errors live in a separate data file and never mix with the verified data.
- Leaving the mode restores the verified data immediately.

### 3.6 Open Questions

- Not a separate section. Real unsolved problems are attached to the elements, compounds and reactions they involve, so he discovers them along the way. For example, a quiet "Nobody knows yet" marker on hydrogen's page leads to metallic hydrogen. Discovered questions get collected in his journal.
- Candidate topics: predicted properties of superheavy elements and the island of stability, how high-temperature superconductors work, water's strange behaviors, what glass really is, and metallic hydrogen.
- Each topic covers what's known, what isn't, and the competing ideas, at his level.
- Prompts invite him to form and write his own hypothesis, saved in his journal.
- Elements with predicted or uncertain values (like the superheavies) get an "uncertain" badge, with the uncertainty shown instead of one false-precise number.
- Verification still applies: the claim that a question is open must itself be sourced.

### 3.7 Saving

- Autosave to browser storage.
- Export the journal as a file to the iPad Files app, and import it to restore.
- No accounts, no logins, no personal data.

## 4. Safety

- Dangerous reactions are included, with a hazard badge and a "why this is dangerous" note.
- Textbook-level description only. Never any quantities, procedures, or how-to steps.
- Hazard info comes from PubChem GHS data.

## 5. Sources and verification

### 5.1 Whitelisted domains (exactly three)

- **PubChem** (pubchem.ncbi.nlm.nih.gov): element and compound data, properties, hazards, uses.
- **NIST Chemistry WebBook** (webbook.nist.gov): formation enthalpies. Reaction energies are calculated from these, with the math shown and the inputs linked.
- **LibreTexts Chemistry** (chem.libretexts.org): conceptual explanations, like why a bond is ionic.

### 5.2 Rule

Every fact displayed has a tappable citation to one of these three domains. Anything that can't be verified does not ship.

## 6. Content pipeline (build time)

- **Orchestrator:** works through the list of elements and candidate reactions.
- **Drafting agent:** writes each element and reaction entry as structured data.
- **Verifier agents:** check every number and claim against the whitelisted sources and attach a citation to each.
- **Evaluator:** flags mismatches or unverifiable claims into a review queue for a human, instead of shipping them.
- **Output:** static JSON data bundled into the app, plus a verification report in the repo as an audit trail.
- **Target scale:** all 118 elements, plus a very large curated reaction set (hundreds or more).

### 6.1 Published verification artifacts

Correctness is the top requirement, because this is an educational tool. Everything below is published in the public GitHub repo alongside the app.

- **Verification methodology:** a document explaining how the agents draft, check and cite each fact, what counts as a match, and the tolerances for numeric values.
- **Per-fact verification record:** for every fact shown in the app, the claimed value, the source URL, the value retrieved, and a pass or fail result with a timestamp.
- **Review log:** every flagged item, the human decision on it, and why.
- **Summary report:** pass rates and coverage for each release, plus anything left out because it couldn't be verified.
- **Reproducibility:** the pipeline code and prompts are in the repo, so anyone can re-run verification.
- **In-app link:** an "How we verify" page linking to these artifacts, plus a way to report an error.

## 7. Design

- Serious and professional, like a real lab reference. Not cartoonish.
- Accessible: readable type, large touch targets, color-blind-safe palette.
- Light and dark mode.

## 8. Future options (not in v1)

- Live AI mode for free-form combinations, possibly using a free-tier API.
- More challenges and lesson paths.

* Pipeline eval: moved into v1 (see 10.4b).

## 9. Open questions

- Name decided: AtomiTron. Check for trademark conflicts before publishing widely.
- Confirm hosting details match the Rock ID and Addonaut setup.
- Size and priority order for the first reaction set.
- Which model and budget to use for the build-time agent pipeline.

## 10. Build plan for Claude Code

Hand this whole doc to Claude Code. Build in the phases below, and stop for review at the end of each one.

### 10.1 Stack

- **App:** static site, TypeScript and Vite, no backend. Deployed to GitHub Pages, matching Rock ID and Addonaut (confirm their setup and mirror it).
- **Animations:** SVG plus CSS or a light library. It has to run smoothly on an iPad mini.
- **Storage:** localStorage for autosave, plus a JSON file for journal export and import.
- **Pipeline:** Python, run locally or in GitHub Actions. Uses the Anthropic SDK for the agents, the PubChem PUG REST API for data, NIST WebBook pages for enthalpies, and LibreTexts URLs for explanations.

* **Execution path:** phases 1 to 3 run verification with Claude Code subagents on the subscription, to prototype cheaply. Before anything is published, switch to the Claude API pipeline so the published verification record can be reproduced by anyone from the public repo.

### 10.2 Repo layout

- `app/`: the web app.
- `data/verified/`: element and reaction JSON. This is the only data normal mode loads.
- `data/spot-the-error/`: planted errors, kept separate.
- `pipeline/`: orchestrator, drafting, verifier and evaluator agents, plus their prompts.
- `verification/`: methodology, per-fact records, review log and release reports.
- `CLAUDE.md`: project rules, including correctness first, the three-source whitelist, no how-to content for hazards, and touch-first design.

### 10.3 Data rules

- Every displayed fact is stored as a value, unit, source URL, retrieval date and verification status.
- The app refuses to render a fact with no passing verification record.
- Uncertain values are stored as ranges with an "uncertain" flag.
- Open questions are stored as objects linked to element, compound or reaction IDs.

### 10.4 Phases

1. **Skeleton:** repo, CLAUDE.md, data schema, app shell, GitHub Pages deploy.
2. **Elements:** pipeline verifies all 118 elements. Build the periodic table and element pages with animated atoms.
3. **Reactions v1:** pipeline drafts and verifies a starter set of about 50 common reactions. Build combine mode with all five layers.
4. **Journal and challenges:** discovery journal, badges, challenges, export and import.
5. **Open questions and Spot the Error:** markers attached to elements, plus the separate error mode.
6. **Scale up:** grow the reaction set to hundreds, publish the verification reports, and add the "How we verify" page.

### 10.4a Human involvement (mostly automated)

- **Setup, once:** create the repo, turn on GitHub Pages, add an API key, set a budget.
- **Three checkpoints instead of six phase reviews:** after phase 2 (elements), after phase 4 (journal and challenges), and before public release.
- **Auto-retry before flagging:** verifier agents re-source and retry a failed fact first. Anything still unverified is dropped automatically rather than queued, and is listed in the release report.
- **Hazard content:** screened by an automated test plus a second reviewer agent. Human spot-check only.
- **Human spot reviews of agent verification:** at each checkpoint, randomly sample verified facts (suggested: about 25 per checkpoint, weighted toward reactions and energy values) and check them against the sources by hand. Results are logged in `verification/spot-reviews/` and published, including the agreement rate between human and agent. Any disagreement triggers a re-check of that fact's category.
- **Releases:** short human approval of the summary report before each publish.

### 10.4b Verification quality measures

- **Consistency as a confidence signal:** each verifier check runs several times. Agreement across runs is recorded per fact, and low-consistency facts get extra scrutiny. Human spot reviews serve as ground truth for whether consistency predicts correctness.
- **Planted-error catch rate (v1, not future):** known errors are seeded into draft data, and the verifiers' catch rate is measured and published each release.
- **Reusable data-access tool:** PubChem and NIST lookups are wrapped in a small MCP server, so the pipeline and other projects can share them.
- **Pattern documentation:** the verification approach is written up as a reusable pattern (multi-agent verification with a human sampling audit) for anyone building trustworthy AI-generated content.
- **Write-up:** a short public post on the approach, the human-agent agreement rate, and what the agents got wrong.

### 10.5 Acceptance criteria

- Every fact in normal mode has a tappable source link to one of the three whitelisted domains, and nothing else.
- Zero unverified facts ship. A test fails the build if any are found.
- Hazard content has no quantities or procedures. A review checklist and a test enforce this.
- Usable one-handed on an iPad mini in portrait and landscape, with 44 pt minimum touch targets.
- Spot the Error mode is visually unmistakable and can't load into normal mode.
- Works in both light and dark mode, and passes a color-blindness check.

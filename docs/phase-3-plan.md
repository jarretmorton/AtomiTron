# Phase 3 plan: reactions

*Drafted 2026-11-12 from a survey of real PubChem and NIST WebBook data.
Decisions settled 2026-11-15 (section 4). Nothing here is in the app yet.*

## 1. Worked examples from real data

Energies come from NIST WebBook standard enthalpies of formation (ΔfH°, kJ/mol).
The reaction energy is products minus reactants, for the balanced equation as
written. An element in its standard state has ΔfH° = 0 by definition. This is
how the app's "Real chemistry" layer would show its working.

### Table salt: 2 Na(s) + Cl₂(g) → 2 NaCl(s)

- **Inputs:** NaCl(s) −411.12 (WebBook, Chase 1998). Na(s) and Cl₂(g) are 0.
- **Working:** ΔH = 2 × (−411.12) − 0 = **−822.24 kJ**. Exothermic.
- **New substance (PubChem CID 5234):** melts at 800.7 °C and boils at
  1465 °C (Hazardous Substances Data Bank).
- **Catch:** PubChem's GHS section for table salt includes "H318: Causes
  serious eye damage" with the signal word **Danger**, reported by some
  notifiers. Shown as-is, table salt would get a danger badge. Hazard
  statements need a rule (section 2).

### Water: 2 H₂(g) + O₂(g) → 2 H₂O(l)

- **Inputs:** H₂O(l) −285.830 ± 0.040 (CODATA, Cox, Wagman et al. 1984) and
  −285.83 (JANAF, Chase 1998). Two reviewed sources agree.
- **Working:** ΔH = 2 × (−285.83) = **−571.66 kJ**.
- **Catch:** the phase matters. As steam, H₂O(g) is −241.83, which gives
  **−483.66 kJ**. Every species needs its state at 25 °C, (s), (l) or (g),
  and that state has to be verified too.

### Burning methane: CH₄(g) + 2 O₂(g) → CO₂(g) + 2 H₂O(l)

- **Inputs:** CO₂(g) −393.51, H₂O(l) −285.83. For CH₄(g), the WebBook has
  five values, from −73.4 to −74.87. The two reviews give −74.6 (Manion 2002)
  and −74.87 (Chase 1998).
- **Working:** ΔH = −393.51 + 2 × (−285.83) − (−74.6) = **−890.57 kJ**
  (−890.30 with Chase's value).
- **Bonus:** the WebBook also lists a *measured* combustion enthalpy of
  −890.7 ± 0.4 kJ. The calculated and measured values agree to within
  0.4 kJ. That's a free, independent cross-check wherever a combustion
  enthalpy exists.

### Magnesium burning: 2 Mg(s) + O₂(g) → 2 MgO(s)

- **Inputs:** MgO(s) −601.60 ± 0.30 (CODATA) and −601.24 (JANAF).
- **Working:** **−1203.20 kJ** (CODATA) or −1202.48 kJ (JANAF). They agree
  to within 0.06%.

### Rusting: 4 Fe(s) + 3 O₂(g) → 2 Fe₂O₃(s)

- **Inputs:** Fe₂O₃(s) −825.50 (Chase 1998).
- **Working:** ΔH = 2 × (−825.50) = **−1651.00 kJ**.
- **Catch:** this only turned up by searching the formula. Searching by name
  found entries called "Indian red oxide" and "Venetian red" with no energy
  data. The real entry is "Hematite (Fe2O3)".

### Limestone: CaCO₃(s) → CaO(s) + CO₂(g): blocked

- **Problem:** the WebBook has **no ΔfH° for calcium carbonate** under any
  name or formula search. CaO(s) is there (−634.92 ± 0.90 and −635.09), and
  so is CO₂.
- **Effect:** this classic decomposition can't have a verified energy layer
  from the three whitelisted sources. It could still ship its other layers,
  or wait.

## 2. What the survey changes

1. **Look substances up by ID, never by name.** Name searches returned
   "Search Results" pages for chlorine, hydrogen, oxygen, nitrogen and carbon,
   and the wrong entry for iron(III) oxide. PubChem's name lookup failed for
   "iron(III) oxide" too. Each substance needs a curated PubChem CID and NIST
   ID, and the pipeline checks the formula matches in both.
2. **Every species needs a verified state** at 25 °C, because the energy
   depends on it (water: −571.66 vs −483.66 kJ).
3. **Use reviewed thermochemistry and cross-check it.** Prefer the two
   evaluated compilations (CODATA, Cox, Wagman et al. 1984; JANAF, Chase
   1998), and require them to agree when both exist (they did in every case
   here). Where a measured combustion enthalpy exists, check the calculated
   reaction energy against it.
4. **Balance equations by code** (atoms counted on both sides) and show the
   arithmetic, like the neutron count on element pages.
5. **Check coverage first.** Some classics (limestone) have no WebBook data.
   A reaction joins the list only after its data has been checked.
6. **Compound properties are messier than element properties.** PubChem
   gives melting and boiling points from many contributors, in °F and °C,
   and often with qualifiers like "decomposes", "sublimes", or "for a 39%
   solution". **The deferred rule #5 (qualified values) needs deciding before
   phase 3**, because it affects compounds far more than elements.
7. **Hazard statements need a rule.** PubChem's GHS data combines many
   notifiers, each with its own percentage. A proposal: show a hazard
   statement only when most notifiers report it (PubChem gives the
   percentages), and always from PubChem's GHS section, never from prose.
   Table salt shows why this matters.
8. **Water-based reactions are harder.** Reactions in water (acids, bases,
   displacement in solution) need energies for dissolved ions, which the
   WebBook covers far less. Suggest leaving them for a later batch.

## 3. Draft starter list (about 50 reactions)

Grouped by what each one teaches.
- **Data:** ✓ means its WebBook energy data was checked in this survey, ✗
  means none was found, and "check" means not yet surveyed.
- **⚠ Hazard:** the reaction is included with a hazard badge and a "why this
  is dangerous" note, at textbook level only (CLAUDE.md rule 3).

### A. Metals + chlorine: salts and ionic bonding

| # | Reaction | Data | Notes |
|---|---|---|---|
| 1 | 2 Na + Cl₂ → 2 NaCl | ✓ | Table salt ⚠ (chlorine gas, reactive sodium) |
| 2 | 2 K + Cl₂ → 2 KCl | check | ⚠ |
| 3 | Mg + Cl₂ → MgCl₂ | check | ⚠ |
| 4 | Ca + Cl₂ → CaCl₂ | check | ⚠ |
| 5 | 2 Li + Cl₂ → 2 LiCl | check | ⚠ |
| 6 | 2 Na + Br₂ → 2 NaBr | check | ⚠ |

### B. Metals + oxygen: oxides

| # | Reaction | Data | Notes |
|---|---|---|---|
| 7 | 2 Mg + O₂ → 2 MgO | ✓ | Burns with a bright white light ⚠ |
| 8 | 4 Na + O₂ → 2 Na₂O | check | ⚠ |
| 9 | 2 Ca + O₂ → 2 CaO | ✓ (CaO) | |
| 10 | 4 Al + 3 O₂ → 2 Al₂O₃ | check | |
| 11 | 2 Cu + O₂ → 2 CuO | ✓ (one review only) | Copper turning black |
| 12 | 4 Fe + 3 O₂ → 2 Fe₂O₃ | ✓ (formula search) | Rust |
| 13 | 2 Zn + O₂ → 2 ZnO | check | |

### C. Non-metals + oxygen: combustion and covalent bonding

| # | Reaction | Data | Notes |
|---|---|---|---|
| 14 | 2 H₂ + O₂ → 2 H₂O | ✓ | ⚠ explosive mixture |
| 15 | C + O₂ → CO₂ | ✓ (CO₂) | |
| 16 | 2 C + O₂ → 2 CO | check | ⚠ toxic gas |
| 17 | 2 CO + O₂ → 2 CO₂ | check | |
| 18 | S + O₂ → SO₂ | check | ⚠ toxic gas |
| 19 | N₂ + O₂ → 2 NO | check | **Endothermic**: lightning makes it |
| 20 | CH₄ + 2 O₂ → CO₂ + 2 H₂O | ✓ | Natural gas; measured cross-check |
| 21 | C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O | check | Propane |
| 22 | 2 C₂H₆ + 7 O₂ → 4 CO₂ + 6 H₂O | check | Ethane |

### D. Hydrogen + non-metals

| # | Reaction | Data | Notes |
|---|---|---|---|
| 23 | H₂ + Cl₂ → 2 HCl | ✓ (HCl) | ⚠ |
| 24 | N₂ + 3 H₂ → 2 NH₃ | ✓ (NH₃) | Ammonia; needs a catalyst |
| 25 | H₂ + Br₂ → 2 HBr | check | ⚠ |
| 26 | 2 H₂ + C → CH₄ | ✓ | Methane from its elements |

### E. Metals + water

| # | Reaction | Data | Notes |
|---|---|---|---|
| 27 | 2 Na + 2 H₂O → 2 NaOH + H₂ | ✓ (NaOH by ID) | ⚠ classic dangerous reaction |
| 28 | 2 K + 2 H₂O → 2 KOH + H₂ | check | ⚠ |
| 29 | 2 Li + 2 H₂O → 2 LiOH + H₂ | check | ⚠ |
| 30 | Ca + 2 H₂O → Ca(OH)₂ + H₂ | check | ⚠ |

### F. Metals + sulfur, and other combinations

| # | Reaction | Data | Notes |
|---|---|---|---|
| 31 | Fe + S → FeS | check | |
| 32 | Zn + S → ZnS | check | |
| 33 | NH₃ + HCl → NH₄Cl | check | Two gases make a white solid |
| 34 | CaO + H₂O → Ca(OH)₂ | check | Quicklime and water |
| 35 | CaO + CO₂ → CaCO₃ | ✗ (no CaCO₃) | Blocked for now |

### G. Breaking down: decomposition, mostly endothermic

| # | Reaction | Data | Notes |
|---|---|---|---|
| 36 | 2 H₂O → 2 H₂ + O₂ | ✓ | Splitting water; the reverse of 14 |
| 37 | 2 HgO → 2 Hg + O₂ | check | How oxygen was discovered ⚠ mercury |
| 38 | CaCO₃ → CaO + CO₂ | ✗ | Limestone; blocked for now |
| 39 | 2 NH₃ → N₂ + 3 H₂ | ✓ (NH₃) | The reverse of 24 |

### H. Displacement

| # | Reaction | Data | Notes |
|---|---|---|---|
| 40 | Cl₂ + 2 NaBr → 2 NaCl + Br₂ | check | ⚠ halogens |
| 41 | Cl₂ + 2 KBr → 2 KCl + Br₂ | check | ⚠ halogens. Replaces thermite, which is left out (decided 2026-11-15) |

### I. Life: photosynthesis and respiration

| # | Reaction | Data | Notes |
|---|---|---|---|
| 42 | 6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂ | check (glucose) | Photosynthesis, endothermic |
| 43 | C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O | check (glucose) | Respiration |

### J. Doesn't react, and why (spec 3.3)

| # | Pair | Why it doesn't react (to be sourced from LibreTexts) |
|---|---|---|
| 44 | He + O₂ | Noble gas: a full outer shell |
| 45 | Ne + Cl₂ | Noble gas |
| 46 | Ar + Na | Noble gas |
| 47 | Au + O₂ | Gold doesn't tarnish |
| 48 | Pt + O₂ | Platinum doesn't tarnish |
| 49 | Cu + H₂O | Copper doesn't react with water |
| 50 | N₂ + O₂ at room temperature | Only with a big energy input (see 19) |

## 4. Decisions (settled 2026-11-15)

1. **The list:** the draft list above, with thermite replaced. Data coverage
   is checked for every entry before building, and any that turn out to be
   blocked are reported first.
2. **Hazardous classics:** included, each with a hazard badge and a "why this
   is dangerous" note at textbook level: the alkali metals with water,
   hydrogen with oxygen, and the chlorine reactions. **Thermite is left
   out.**
3. **Reactions with no energy data** (limestone, #35 and #38): they ship
   without energy numbers. The energy layer says plainly that the sources
   have no verified value.
4. **Qualified and approximate values:** shown with their qualifier, exactly
   as the source gives it ("Sublimes at ...", "Decomposes", "(diamond)",
   "about 7 g/cm³"). A qualified value is never shown without its label, and
   it's only cross-checked against values with the same qualifier. This
   settles the rule deferred from phase 2, so it also applies to the element
   values left out then (carbon, phosphorus, astatine).
5. **Hazard statements:** a GHS statement is shown only when more than half
   of PubChem's notifiers report it, using PubChem's own percentages.
6. **Reactions in water** (acids, bases, solutions): left for a later batch.

**Arsenic still needs its own fix.** Its melting point ships as 817 °C from
Jefferson Lab, which gives no qualifier. Los Alamos gives "~817 °C". Neither
source says "under pressure", so the qualifier rule alone doesn't correct
it. Under the new rule Los Alamos's approximate value no longer counts as a
second plain value, and arsenic's sources also give a lower boiling
(sublimation) point of about 603 to 614 °C. The existing check that a
melting point must be below the boiling point should then drop the 817 °C
value. That's to be confirmed when the rule is built.

## 5. Data coverage check (2026-11-15)

Every compound in the list was looked up in PubChem by name (to get its CID)
and in the NIST WebBook by formula or exact ID, and the formulas were
compared. This checks only that the data exists. The values themselves are
extracted and verified when the pipeline is built.

**Result: 33 of 35 compounds have a reviewed formation enthalpy in the
WebBook for the phase the reaction needs.**

| Coverage | Compounds |
|---|---|
| Two reviewed compilations (CODATA and JANAF), which agree | H₂O, CO₂, CO, SO₂, HCl, HBr, NH₃, MgO, CaO, Al₂O₃, HgO |
| Two reviews that differ slightly | CH₄ (−74.87 and −74.6 kJ/mol) |
| One review | NaCl, KCl, LiCl, MgCl₂, CaCl₂, NaBr, KBr, Na₂O, CuO, Fe₂O₃, ZnO, NO, NaOH, KOH, LiOH, Ca(OH)₂, FeS, NH₄Cl, C₂H₆ |
| Measured values only, no review | C₃H₈ (two measurements, 0.9 kJ/mol apart), glucose (see below) |
| **No formation enthalpy** | **CaCO₃, ZnS** |

What this means for the list:

- **Blocked, so they ship without energy numbers** (decision 3): limestone
  (#35 and #38), and now also **zinc with sulfur (#32)**, because the
  WebBook has no entry for zinc sulfide.
- **Glucose (#42 and #43, photosynthesis and respiration)** needs care. The
  WebBook has no value under "α-D-Glucose". It has one measurement each for
  α-D-glucopyranose (−1274.5 kJ/mol) and β-D-glucopyranose (−1268.3), both
  from 1938. These two reactions should cite the α form by its exact ID and
  say the value is a single measurement, or ship without energy numbers.
  **Decided 2026-11-15: ship with a "single measurement" label.**
- **Several formulas return more than one entry** (H₂O, HCl and NH₃ also
  list their deuterium versions; C₆H₁₂O₆ lists eight sugars). This confirms
  that every substance must be pinned to an exact WebBook ID.
- **Single-review values** have no second source to cross-check
  against. Where a measured reaction or combustion enthalpy exists, it
  serves as the cross-check (as for methane).

The elements' own formation enthalpies are zero in their standard states by
definition. That definition, and each element's standard state, will be
cited from LibreTexts and PubChem like any other fact.

## 6. Changes after the first full run (2026-11-16)

- **Sodium + oxygen is replaced by lithium + oxygen.** The LibreTexts page
  says sodium burning in oxygen gives "a white solid mixture of sodium oxide
  and sodium peroxide", so a summary naming sodium oxide alone would be
  incomplete. The same page says lithium gives "white lithium oxide".
- **No-reaction pairs "don't react under everyday conditions",** because
  the sources hedge (oxygen is "mostly unreactive" with gold).
- **Glucose's melting point** leaves out CAMEO's entry, which describes a
  glucose solution.
- **The list has 49 entries;** all 49 are verified.


# How AtomiTron verifies facts

> **Status: approved 2026-11-11 (phase 2), with additions pending approval.**
> Where a rule is based on measured evidence, the evidence is given. Changes
> to these rules need the project owner's approval.
>
> **Pending approval:** the first full run over all 118 elements found cases
> the approved rules didn't cover. The additions are marked *(pending)*:
> - agreement within stated uncertainties (section 4)
> - IUPAC CIAAW as the authority for atomic weights and isotope abundances,
>   and the IAEA mass table as the tiebreak for isotope masses (section 5)
> - LibreTexts table A1 as a second contributor for electron configurations
>   (section 2)
> - approximate and qualified values left out (section 5)
> - predicted status for elements never made in bulk (section 9)

AtomiTron is a chemistry reference for a young learner, so a wrong fact is the
worst possible bug. This document explains where every fact comes from, how it
is checked, what counts as a match, and what happens when a fact can't be
verified. It covers elements. Compounds and reactions are added in phase 3.

## 1. The rules

1. **Every displayed fact cites one of three sites:** PubChem
   (`pubchem.ncbi.nlm.nih.gov`), the NIST Chemistry WebBook
   (`webbook.nist.gov`), or LibreTexts Chemistry (`chem.libretexts.org`).
2. **Every fact has a verification record** in [records/](records/), with the
   claimed value, the source URL, the value retrieved, and a pass or fail
   result with a timestamp.
3. **Nothing unverified ships.** A fact that fails is retried once with fresh
   retrieval. If it still fails, it's left out and listed in the release report.
   We never fill a gap with a guess.
4. **The build enforces this.** The test suite checks every fact in
   `data/verified/` against its record before the app can deploy.

## 2. Where element facts come from

Each element fact comes from the data on that element's PubChem page, through
PubChem's PUG View API
(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/element/{Z}/JSON`). The
citation in the app links to the matching section of the page, for example
`https://pubchem.ncbi.nlm.nih.gov/element/11#section=Melting-Point`, so a tap
lands on the value itself.

PubChem collects element data from several original contributors and names
the contributor for each value. We record that name with each fact and show it
as "PubChem, from Jefferson Lab":

| Contributor | Used for |
|---|---|
| IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW) | Standard atomic weights, isotope abundances |
| NIST Physical Measurement Laboratory | Atomic weights, isotope masses and abundances |
| Atomic Mass Data Center, IAEA (NUBASE) | Half-lives of every known isotope; isotope masses as a tiebreak *(pending)* |
| Jefferson Lab, U.S. Department of Energy | Melting and boiling points, density, state, period and group, history, uses |
| Los Alamos National Laboratory | Electron configuration, melting and boiling points, history, uses |
| PubChem Elements | Electronegativity (Pauling scale) |

*(pending)* **LibreTexts Chemistry reference table A1**
([Atomic Electron Configurations](https://chem.libretexts.org/Ancillary_Materials/Reference/Reference_Tables/Atomic_and_Molecular_Properties/A1%3A_Atomic_Electron_Configurations))
is a second, independent contributor for electron configurations:
- It agrees with Los Alamos on all 102 elements both cover, except
  lawrencium, a real scientific dispute (section 5).
- It is the only source for nitrogen, because PubChem's nitrogen page has no
  electron configuration.

**Not used: PubChem's periodic-table summary**
(`/rest/pug/periodictable/JSON`). It disagrees with PubChem's own element
pages. It gives technetium's atomic weight as 96.90636, where every
contributor on the technetium page gives [98]. It gives oganesson 295.216,
where the page gives 294. It also has no units.

### Field by field

| Field | PubChem section | Primary contributor | Method |
|---|---|---|---|
| Atomic number, symbol, name | Identifiers | PubChem | extract |
| Period, group | Element Period Number, Element Group Number | Jefferson Lab | extract |
| Atomic weight | Atomic Weight | IUPAC CIAAW | extract |
| Electron configuration | Electron Configuration | Los Alamos, cross-checked with LibreTexts A1 *(pending)* | extract |
| Electronegativity | Electronegativity | PubChem Elements (Pauling) | extract |
| State at room temperature | Physical Description | Jefferson Lab | extract |
| Melting point, boiling point | Melting Point, Boiling Point | Jefferson Lab | extract, cross-checked (section 5) |
| Density | Density | Jefferson Lab | extract |
| Isotopes: mass number, mass, abundance | Isotope Mass and Abundance | IUPAC CIAAW, NIST | extract |
| Longest-lived isotope (radioactive elements) | Atomic Mass, Half Life, and Decay | AMDC (NUBASE) | extract (section 8) |
| Protons, electrons, neutrons, electrons per shell, valence electrons | derived from the facts above | — | derive (section 7) |
| Discovery year and story, uses | History, Uses | Jefferson Lab, Los Alamos | agent |

## 3. Three ways a fact is checked

The method used for each fact is recorded in its verification record.

- **extract (code):** a numeric or short structured value is read by code from
  PubChem's structured data and compared with the claimed value. No AI model
  is involved. Code is exact and repeatable, and anyone can re-run it without
  an API key.
- **agent (verifier agents):** a written statement, such as a sentence about
  how an element was discovered, is judged by verifier agents. They check
  whether the cited section supports it. The record stores a short excerpt
  of the supporting passage, kept under 25 words: a citation, not a copy.
- **derive (code):** a value calculated from other verified facts, such as a
  neutron count, is computed by a named rule and recomputed by the build on
  every run (section 7).

## 4. What counts as a match

| Kind of value | Match rule |
|---|---|
| Integers (atomic number, period, group, mass number) | Exactly equal |
| Atomic weight, isotope mass | Equal to the source's stated digits. The source's uncertainty notation (the `(2)` in `22.989 769 28(2)`) is recorded but not displayed |
| Two contributors' numbers *(pending)* | If either states an uncertainty, they agree when they differ by no more than the stated uncertainties combined (a bare number counts as ± half its last digit). For example, 18.998 403 162(5) agrees with 18.998403163(6). Without stated uncertainties, the shorter value must be the longer one correctly rounded: 22.99 agrees with 22.98976928, but 63.6 doesn't agree with 63.546 |
| A number against an interval *(pending)* | The number lies within the interval rounded to the number's own precision. Los Alamos's 14.01 agrees with nitrogen's [14.006 43, 14.007 28] |
| Atomic weight given as an interval | Both ends equal. Stored as a range, which is *not* marked uncertain, because it varies in nature |
| Melting point, boiling point (°C) | Equal to the primary contributor's value, which must be corroborated (section 5) |
| Density, electronegativity | Equal to the source's stated digits |
| Electron configuration | Same subshell occupancy after parsing, rather than string equality, so `[Ar]4s13d10` and `[Ar] 3d10 4s1` match |
| Text (state, history, uses) | All three verifier runs agree the cited section supports every part of the statement |

**Temperatures** are stored in °C, using the value the contributor itself
states in °C (Jefferson Lab gives K, °C and °F).

The app can show them in °C, °F, K or °R (Rankine); the reader picks in a
setting. Converting is exact arithmetic, because the four scales are defined
in terms of each other:
- K = °C + 273.15
- °F = °C × 9/5 + 32
- °R = K × 9/5

A converted value keeps the same number of decimal places as the stored value,
so it never claims more precision than the source. When the unit shown isn't
the one the source states, the fact says so (for example "converted from
97.8 °C"), so the number can still be checked against the cited page.

## 5. When contributors disagree

**Evidence.** We compared contributors across all 118 elements (retrieved
2026-11-10):

| | Melting point | Boiling point |
|---|---|---|
| Elements with two or more contributors | 102 | 91 |
| Disagree by more than 0.5 °C | 20 | 30 |
| Disagree by more than 1 °C | 18 | 28 |
| Disagree by more than 10 °C | 4 | 25 |

Some disagreements are plainly errors in one contributor's data:
- Krypton's boiling point appears as +153.415 °C, which has lost its minus sign.
- Neon's melting point appears as both −248.59 °C and −258.59 °C, apparently a
  typo in one of them.
- Radium's boiling point differs by 597 °C between contributors.

No contributor is right in every case, so a fixed "trust this one first" rule
isn't safe.

**Rule.**

1. **Two or more contributors agree within the tolerance:** ship the primary
   contributor's value. The record keeps the corroborating value.
   - **Tolerance:** 1 °C for melting and boiling points. That absorbs rounding
     and small measurement differences (hydrogen's two melting points are
     0.18 °C apart) but catches real conflicts.
   - Numbers other than temperatures are compared by the rules in section 4.
2. **They disagree beyond the tolerance:**
   - If the NIST Chemistry WebBook (also on the whitelist) has the value and
     it matches exactly one contributor within tolerance, ship that
     contributor's value.
   - NIST's value is kept in the fact's verification record as the
     corroboration *(pending: previously "a second citation")*.
   - For a melting point, NIST's triple point counts as well, since for
     these substances it is within a hair of the melting point *(pending)*.
   - Otherwise the value is left out and listed in the release report.
3. **Only one contributor gives the value:** ship it only if it passes the
   consistency checks in section 6.

**IUPAC CIAAW values *(pending)*.** CIAAW defines the standard atomic weights,
and it is the IUPAC body for isotopic composition, so its values are
authoritative.
- **An atomic weight** still needs at least one agreeing contributor. Older
  values elsewhere are noted in the record but don't block it. For example,
  Los Alamos still lists titanium as 47.88, where CIAAW gives 47.867(1).
- **Isotope abundances** from CIAAW stand even when NIST carries an older
  evaluation, but the set must pass the abundance-sum check (section 6).
  IUPAC revised ytterbium's composition with new measurements, while NIST
  has the earlier figures.
- **Isotope masses** that disagree are settled by the IAEA mass table on the
  same PubChem page. If it doesn't settle them, the mass is left out.

**Approximate values *(pending)*.** A value written as approximate ("~817 °C",
"about 7 g/cm³") can't be checked to any precision. It isn't used to
corroborate anything, and on its own it's left out.

**Qualified values *(pending)*.** Some values apply only to one form or
condition, such as white phosphorus, diamond, or a sublimation point. For
now, if any contributor qualifies a value, it's left out and listed. Showing
qualified values with their qualifier is a later improvement.

**Configurations that disagree.** If the two configuration contributors
disagree, the configuration is left out, and the element can't ship, because
the atom needs it. This applies only to lawrencium. PubChem gives
[Rn] 5f14 6d1 7s2, while LibreTexts gives "probably" [Rn] 5f14 7s2 7p1. This
is a real open question, and a candidate for the app's "Nobody knows yet"
markers.

## 6. Consistency checks

These checks run in code and catch errors no single comparison can. Any
failure stops the fact from shipping.

- The electron configuration holds exactly as many electrons as the atomic
  number. The build checks this on every run.
- The melting point is below the boiling point, unless the value is marked
  as a sublimation.
- The state at room temperature (25 °C) fits the temperatures:
  - Solid means the melting point is above 25 °C.
  - Liquid means the melting point is below 25 °C and the boiling point is
    above it.
  - Gas means the boiling point is below 25 °C.

  Krypton's sign-flipped boiling point fails this check.
- Where a contributor states a temperature in more than one unit (Jefferson
  Lab gives K, °C and °F), the figures agree with each other after exact
  conversion, to within that contributor's rounding.
- Natural isotope abundances add up to 1, within their stated uncertainty.
- A standard atomic weight lies between the masses of the lightest and
  heaviest natural isotopes.

## 7. Derived values

Some numbers on an element page aren't stated by any source directly. They
follow from other facts by a simple, standard rule. Each rule is written in
code ([app/src/data/derive.ts](../app/src/data/derive.ts)), the pipeline uses
it to compute the value, and the build recomputes it from the verified inputs
on every run. A derived fact's citation links to a LibreTexts page explaining
the rule, and its inputs link to their own sources.

| Value | Rule |
|---|---|
| Protons | Equal to the atomic number |
| Electrons (neutral atom) | Equal to the atomic number |
| Neutrons | Mass number of the isotope drawn minus atomic number. **Never** from rounding the atomic weight: copper's 63.546 rounds to 64, but its most abundant isotope is copper-63, which has 34 neutrons, not 35 |
| Electrons per shell | Electrons in the configuration summed by shell number. Copper `[Ar] 3d10 4s1` gives 2, 8, 18, 1 |
| Valence electrons | The s and p electrons in the outermost shell, **for groups 1, 2 and 13 to 18 only**. Transition metals, lanthanides and actinides get no single number, because textbooks define it differently for them |

A derived value is uncertain exactly when one of its inputs is. Because an
uncertain value is never shown as a single number, a count calculated from a
*predicted* configuration (such as oganesson's valence electrons) isn't shown.

## 8. Which isotope the atom shows

The animated atom draws one specific isotope, and the page says which.

- **An element with natural isotopes:** the most abundant one, from the IUPAC
  or NIST abundance table.
- **An element with no natural isotopes** (such as technetium, promethium,
  and most elements heavier than bismuth): the longest-lived ground-state
  isotope in the AMDC (NUBASE) half-life table, ignoring excited isomers. The
  page shows its half-life. Only measured half-lives count, not estimates or
  bounds. When the runner-up's uncertainty overlaps the winner's (technetium-97
  and technetium-98 are 4.21 and 4.2 million years), the record says so.

The contributors' bracketed mass numbers aren't used for this. They disagree
for 11 elements (rutherfordium: 263 or 267, hassium: 270 or 277), because new
isotopes keep being discovered. The half-life table is one authoritative,
current list, and it applies the same rule to every element.

## 9. Uncertain and predicted values

A value the source marks as predicted, expected, estimated, extrapolated,
calculated or "probably" (as with superheavy elements) is stored with
`uncertain: true`.

*(pending)* Sources don't always mark predictions. Jefferson Lab lists
fermium through meitnerium as plain "Solid". Los Alamos gives tennessine a
plain boiling point of 610 °C, though nobody has ever made enough tennessine
to boil. So two rules apply whatever the source says:
- **Fermium (Z = 100) and heavier** have never been made in visible amounts.
  Their state, melting point, boiling point and density are always treated as
  predictions.
- **Rutherfordium (Z = 104) and heavier** have electron configurations that
  are calculated, not measured, so they are always treated as predictions.

- An uncertain value is **never shown as a single number** (spec 3.6).
  - When the source states a ± or a range, it's stored as a range. Oganesson's
    extrapolated boiling point of 80 ± 30 °C becomes 50 to 110 °C.
  - A predicted *number* with no stated uncertainty is left out. We won't
    invent a range.
- Predicted non-numbers, such as a predicted configuration or "Expected to be
  a Gas", are shown with an "uncertain" badge.
- Where PubChem has no value at all, the field is left out. The app says
  "PubChem lists no value" rather than implying the value doesn't exist.

## 10. Display

- The app may round a number for display (for example 22.98976928 to
  22.990), but it never shows more digits than the source states. The full
  value is one tap away.
- Each fact shows its citation link and its original contributor.

## 11. Records, retries and reports

- **Per-fact records:** `verification/records/elements/<Z>-<symbol>.json`.
  Each record holds:
  - the method, the claimed value and unit, and the source URL
  - the original contributor
  - the value retrieved, and for text facts the evidence excerpt
  - any tolerance applied, the result, and the time it was checked
  - consistency: how many runs were made and how many agreed
- **Consistency runs:** agent checks run three times, and all three must
  agree. Code checks are deterministic, so they run once.
- **Retry and drop:** a failed fact is retried once with fresh retrieval.
  If it still fails, it's dropped and listed in the release report with the
  reason. It doesn't go into a review queue (spec 10.4a).
- **Release report:** pass rates, coverage per field, and every dropped fact
  with its reason, published with each release.

## 12. Human spot reviews

At each checkpoint, a person checks about 25 randomly sampled facts by hand
against their sources. The sample is weighted toward derived values and
values that needed a tiebreak. Results and the human-agent agreement rate are
published in [spot-reviews/](spot-reviews/). Any disagreement triggers a
re-check of that fact's whole category.

## 13. Reproducing this

The extraction and derivation code, the agent prompts, and these rules are
all in this repository. The extract and derive checks need no API key. During
early development, the agent checks run as Claude Code subagents. Before
public release they move to a script using the Claude API, so anyone can
re-run the full verification.

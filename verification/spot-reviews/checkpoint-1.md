# Checkpoint 1 spot review

*Reviewed 2026-11-15. This is the human check on the pipeline after phase 2
(spec 10.4a): a person checks a random sample of published facts against
their sources by hand.*

## Result

- **Sample:** 25 facts, drawn with a fixed seed from the 3,150 published at
  the time ([checkpoint-1-sample.json](checkpoint-1-sample.json);
  re-draw it with `python -m pipeline.spot_review checkpoint-1 25`).
- **Checked:** 24. One fact (item 6) was removed from the app before the
  review, so it couldn't be checked.
- **Reviewer agreed with the pipeline on 21 of 24 (88%).**
- **Marked "Doesn't match": 3,** all derived counts (items 5, 12 and 19).
- **Wrong values found: none.** The follow-up below confirmed the three
  values. The reviewer's findings stand as problems with how checkable those
  facts are, and they need fixing.

The answers as entered are in
[checkpoint-1-answers.json](checkpoint-1-answers.json).

| Kind of fact | Sampled | Matches | Doesn't match | Not checked |
|---|---|---|---|---|
| Written statements (agent-checked) | 6 | 5 | 0 | 1 |
| Derived counts | 5 | 2 | 3 | 0 |
| Values settled by a tiebreak | 3 | 3 | 0 | 0 |
| Predictions | 3 | 3 | 0 | 0 |
| Single-source values | 4 | 4 | 0 | 0 |
| Other measured values | 4 | 4 | 0 | 0 |
| **Total** | **25** | **21** | **3** | **1** |

## How it was done

The reviewer worked from a printed worksheet
([checkpoint-1-worksheet.pdf](checkpoint-1-worksheet.pdf)). For each fact
they opened its element page in the app, tapped its source link, and compared
the source with what the app shows. The verifiers' own evidence excerpts were
left off the worksheet, so the check was independent. The answers were then
typed into a private review sheet.

The sample was weighted toward the facts most likely to hide a mistake:
derived counts, tiebreak values, predictions, single-source values and
written statements. Definitional facts (symbol, name, atomic number) were
left out.

## The three "Doesn't match" findings

| Item | Fact | App shows | Reviewer's note |
|---|---|---|---|
| 5 | Sulfur, valence electrons | 6 | The configuration and group match their sources, but the LibreTexts explanation doesn't make clear how to get 6 from [Ne] 3s2 3p4. |
| 12 | Zirconium, electrons in each shell | 2, 8, 18, 10, 2 | PubChem writes the configuration as [Kr] 5s2 4d2, where the app shows [Kr] 4d2 5s2. The LibreTexts explanation doesn't make clear how to work out the shells. |
| 19 | Neptunium, electrons in each shell | 2, 8, 18, 32, 22, 9, 2 | PubChem writes [Rn] 7s2 5f4 6d1, where the app shows [Rn] 5f4 6d1 7s2. Same problem with the explanation. |

All three say the same thing: **a reader can't confirm a derived count from
what the app cites.** That's a real failure of the "every fact can be
checked" promise, even though the numbers are right. Two separate problems
are behind it:

1. **The working isn't shown.** Neutrons show their arithmetic
   (23 − 11 = 12). Shell counts and valence counts show only the answer and
   a link to a general explanation.
2. **The app rewrites the configuration in shell order.** The pipeline
   compares configurations by content, not by spelling, so the reordering is
   deliberate. But the reader sees a different string at the source, and
   nothing says why.

## Follow-up: re-check of the whole category

The spec requires that a disagreement triggers a re-check of that fact's
category. Every derived shell count and valence count was re-checked against
independent data on 2026-11-15:

- **Shell counts:** LibreTexts reference table A1 prints the electrons per
  shell for each element, as well as its configuration. **All 103 shell
  counts that the table covers match it exactly**, including zirconium and
  neptunium.
  - 14 elements (Z = 105 to 118) aren't in that table. Their shells are
    marked as predictions in the app.
  - Lawrencium shows no shells, because its configuration is disputed.
- **Valence counts:** all 44 match an independent rule based only on the
  group number (group 1 or 2: the group number; groups 13 to 18: the group
  number minus 10; helium: 2). They also match the outermost shell count in
  each case. Sulfur is in group 16, so 6.
- **Neutron counts,** the other derived kind, drew no findings: both sampled
  (titanium and nobelium) matched.

## Actions

Proposed fixes, for the project owner's approval:

1. **Cite the shell counts directly.** For the 103 elements LibreTexts table
   A1 covers, cite the table's own shell row, so the number can be read
   straight off the source. Keep the derivation as a cross-check that the
   build runs.
2. **Show the working** for shell and valence counts, as neutron counts
   already do. For sulfur: outer shell 3s2 3p4, so 2 + 4 = 6.
3. **Explain the configuration's order.** Say on the page that the app lists
   subshells in shell order, and show the source's own spelling beside it.
4. **Add a verified explanation of how to read a configuration** (the number
   is the shell, the superscript is the electron count), checked through the
   same pipeline as the other explanations.

## Other notes

- **Item 6** ("Sodium chloride, a chlorine compound commonly known as table
  salt, is used to season food") was removed from the app on 2026-11-13,
  after the sample was drawn. The Claude API re-verification dropped it when
  one of three verifiers rejected it. It's recorded as not checked.
- **Written statements:** the 5 that could be checked all matched. The
  sample was drawn while these carried the prototype (subagent) records. The
  API re-verification kept all 5 with the same wording.
- **Does verifier agreement predict correctness (spec 10.4b)?** Too early
  to say. Every checked written statement had 3 of 3 verifier agreement and
  matched, so this sample has no low-agreement cases to compare.

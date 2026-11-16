# Drafting prompt: reaction and substance text

You draft short statements for AtomiTron, a chemistry reference app for a
young learner. Correctness is the top requirement: every statement you write
is then checked by three independent verifiers against the one passage you
cite, and by code. A statement that isn't plainly supported by its passage
will fail, so write only what the passage says.

## Input

- `{task}`: what to draft (one reaction, or a list of substances), with
  each substance's name and formula. For a reaction it gives the balanced
  equation and whether energy is released or taken in. Those are already
  checked by code: don't restate numbers from them.
- `{sources}`: a JSON array of passages, each with an `id`, its
  `contributor` and `text`. Use these passages only: not your own knowledge,
  and not the web.

## Every statement

- **One plain sentence,** at most 25 words, that a curious ten-year-old can
  follow. Prefer everyday words and explain a technical word the first time.
- **Supported by one passage** that you name by its `id`. Everything the
  sentence says must be in that passage. Rewording is fine; adding detail,
  causes, comparisons or certainty is not.
- **An excerpt:** copy the part of the passage that supports the sentence,
  word for word, at most 25 words, with no ellipses. Code checks that it
  appears in the passage exactly.
- **No numbers, digits or amounts** of any kind. The app shows numbers from
  verified data elsewhere.
- **Leave it out rather than stretch it.** If no passage supports a
  statement, return an empty list for it. A missing statement is fine; a
  wrong one is not.

## For a reaction

- `summary`: one or two statements on what happens and what forms. For
  example, that the two substances combine to make a new one.
- `bondingType`: at most one statement naming the kind of bond in the main
  product, as `value` "ionic" or "covalent". The sentence and the excerpt
  must both contain that word.
- `bondingWhy`: one or two statements on why that kind of bond forms, such
  as electrons being given up and taken, or shared.
- `trigger`: at most one statement on what starts the reaction: the kind of
  thing only, such as a spark, a flame or heating. Never a temperature, an
  amount, a condition to set up or a step to follow.
- `hazard`: up to two statements on why the reaction or its substances are
  dangerous, at textbook level: what can happen (it can catch fire, explode,
  burn skin, or give off a poisonous gas). **Never** how to make it happen,
  amounts, concentrations, equipment, conditions or steps. Leave it empty
  if nothing in the passages describes a danger.
- `whyNot`: for a "no reaction" pair only, one or two statements on why
  nothing happens, such as a substance being unreactive. Leave the other
  lists empty for a no-reaction pair.

## For each substance

- `standardState`: at most one statement giving whether the substance is a
  solid, liquid or gas at room temperature, as `value` "solid", "liquid" or
  "gas". The sentence and the excerpt must both contain that word. Only when
  the passage plainly says so; leave it empty otherwise.
- `appearance`: at most one statement on what it looks like.
- `uses`: up to three statements on what it is used for. Prefer uses a
  young learner would recognize. Not medical doses, and not uses as a
  weapon or drug.

## Output

Return JSON in the response format given, and nothing else.

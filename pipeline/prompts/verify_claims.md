# Verification prompt: is each claim supported by its passage?

You are one of three independent verifiers for AtomiTron, a chemistry
reference app for a young learner. Correctness is the top requirement. A
claim ships only if all three verifiers confirm it, so judge strictly and on
your own.

## Input

- `{claims}`: a JSON array of claims. Each has an `id`, the claim `text`, and
  the `passage` id it must be supported by.
- `{sources}`: a JSON array of passages, each with an `id` and `text`.

## How to judge each claim

Read the claim and its passage, and only that passage. Don't use your own
knowledge, other passages or the web. A claim is **supported** only if:

1. **Everything it states is in the passage.** This includes names, years,
   what something is used for, and who did what.
2. **It adds nothing the passage doesn't say:** no extra detail, cause,
   comparison or certainty.
3. **The meaning is the same.** Plain-language rewording is fine;
   generalizing or exaggerating is not. "Used in some streetlights" can be
   supported by "used in streetlights", but "the main use is streetlights"
   cannot.
4. **For a year (claim ids ending in `discoveryYear`),** the passage states
   that year for that event, and gives no conflicting year.

Otherwise it's **not_supported**. If you're unsure, it's **not_supported**.

For a supported claim, also copy the part of the passage that supports it,
word for word, at most 25 words, with no ellipses. It must appear in the
passage exactly as written. For a not_supported claim, give a one-sentence
reason.

## Output

Write a single JSON file to `{output}`, and nothing else, shaped like this:

```json
{
  "claims": {
    "Na.uses.0": { "verdict": "supported", "excerpt": "..." },
    "Na.story.1": { "verdict": "not_supported", "reason": "..." }
  }
}
```

Judge every claim in the input. When you're done, reply with one line giving
the counts of supported and not_supported claims.

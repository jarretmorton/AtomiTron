# Drafting prompt: element history and uses

You are drafting short statements for AtomiTron, a chemistry reference app for
an advanced young learner. Every statement will be checked by three
independent verifiers against the source passage you cite. Anything they can't
confirm word for word in that passage is thrown away. Accuracy matters far
more than coverage: a missing statement is fine, but a wrong one is not.

## Input

`{sources}` is a JSON array of source passages. Each has an `id`, an
`element` symbol, an `elementName`, a `heading` ("History" or "Uses"), a
`contributor` and the passage `text`. Use only passages whose `element` is in
`{elements}`. Ignore passages whose id starts with `concept/`.

**Use only what the passages say.** Don't use your own knowledge, don't search
the web, and don't combine facts from two passages into one statement.

## What to write, per element

- **discoveryYear:** the year the element was discovered or first isolated,
  only if a History passage states it explicitly. Give a number, such as
  1807, or the string "Ancient" if the passage says it was known in ancient
  times. If the passages give different years, or no year, use null.
- **story:** 1 to 3 statements about the element's discovery or the origin
  of its name, from History passages.
- **uses:** 2 to 4 statements about what the element is used for, from Uses
  passages.

## Rules for every statement

1. **One claim per statement,** fully supported by one passage. Name that
   passage's `id`.
2. **Plain, serious language** for a curious 10-year-old. At most 25 words. No
   exclamation marks, jokes or "fun fact" framing.
3. **Don't add anything the passage doesn't say:** no extra detail,
   superlatives, comparisons or reasons.
4. **No numbers in uses statements.** In story statements, the only number
   allowed is a year that the passage states.
5. **Nothing operational:**
   - no quantities, concentrations or conditions
   - no steps or procedures, nor "how to" wording
   - nothing about weapons, explosives, poisons or drugs, even if the
     passage mentions them

   Prefer everyday and well-known uses (lights, coins, wires, water
   treatment, medicine) over industrial chemistry.
6. **Quote your evidence:** copy the part of the passage that supports the
   statement, word for word, at most 25 words, with no ellipses. It must
   appear in the passage exactly as written.

## Output

Write a single JSON file to `{output}`, and nothing else, shaped like this:

```json
{
  "elements": {
    "Na": {
      "discoveryYear": { "value": 1807, "passage": "Na/History/Jefferson Lab", "excerpt": "..." },
      "story": [ { "text": "...", "passage": "Na/History/...", "excerpt": "..." } ],
      "uses": [ { "text": "...", "passage": "Na/Uses/...", "excerpt": "..." } ]
    }
  }
}
```

`discoveryYear` may be `null`. Include every element in `{elements}`, even if
a list ends up empty. When you're done, reply with one line saying how many
statements you wrote.

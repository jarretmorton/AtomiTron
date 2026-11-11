# data/verified

Verified element, compound, reaction and open-question JSON. This is the **only**
data normal mode loads. Every file uses the dataset envelope in
[../schema/dataset.schema.json](../schema/dataset.schema.json), and every fact
in it must have a passing record in [../../verification/records/](../../verification/records/).
`npm test` enforces this, and CI won't deploy if it fails.

Empty until phase 2.

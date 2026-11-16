# Reaction text: 2026-11-16-api-reactions-pilot-43785112064

Checked 2026-11-16T01:19:03Z. Drafted and verified through the Claude API (prompts in `pipeline/prompts/`). 3 independent verifiers; a statement passes only with 3 of 3, each with a word-for-word excerpt.

- Statements verified: **53**, passed: **50**, failed: **3**
- Rejected by code before verification: **1**

Legend: ✅ passed, ❌ failed verification, ⛔ rejected by code before verification.

## Sodium and chlorine

`2 Na(s) + Cl2(g) -> 2 NaCl(s)` · energy: exothermic

- 🔧 **summary (written by code):** Sodium and chlorine combine to make sodium chloride.
- ✅ **summary:** As the reaction happens, a great deal of light and heat is given off. *(LibreTexts Chemistry)*
- ✅ **bondingType (ionic):** Sodium chloride, also called table salt, is an ionic compound. *(DrugBank)*
- ✅ **bondingWhy:** The sodium gives up an electron, and the chlorine takes that electron. *(LibreTexts Chemistry)*
- ✅ **bondingWhy:** An ionic bond is the attraction, or pull, between ions that have opposite electric charges. *(LibreTexts Chemistry)*
- ✅ **hazard:** Chlorine is a yellow-green gas that is very poisonous to animals and plants. *(LibreTexts Chemistry)*
- ✅ **hazard:** Sodium metal burns strongly in air and reacts explosively with water. *(LibreTexts Chemistry)*

## Hydrogen and oxygen

`2 H2(g) + O2(g) -> 2 H2O(l)` · energy: exothermic

- 🔧 **summary (written by code):** Hydrogen and oxygen combine to make water.
- ✅ **summary:** Hydrogen burns with a pale blue flame that is almost impossible to see. *(CAMEO Chemicals)*
- ✅ **bondingType (covalent):** In water, the oxygen atom and the hydrogen atoms are held together by covalent bonds. *(DrugBank)*
- ❌ **bondingWhy:** Atoms make a covalent bond by sharing electrons, the tiny particles around an atom, with each other. *(LibreTexts Chemistry)* — verifier 1: The passage never describes electrons as 'tiny particles around an atom', so the claim adds a definition the passage doesn't give.; verifier 2: The passage never describes electrons as 'the tiny particles around an atom', so the claim adds a definition the passage does not give.; verifier 3: The passage never describes electrons as 'tiny particles around an atom', so the claim adds a definition the passage does not give.
- ✅ **bondingWhy:** Sharing electrons is a way for atoms to fill up their outer layer of electrons. *(LibreTexts Chemistry)*
- ✅ **trigger:** Hydrogen is easily set alight by heat, sparks or flames. *(Emergency Response Guidebook (ERG))*
- ✅ **hazard:** A mixture of hydrogen and oxygen can explode if it is set alight. *(LibreTexts Chemistry)*
- ✅ **hazard:** Hydrogen fires are hard to notice because they burn with a flame you cannot see. *(Emergency Response Guidebook (ERG))*

## Methane and oxygen

`CH4(g) + 2 O2(g) -> CO2(g) + 2 H2O(l)` · energy: exothermic

- 🔧 **summary (written by code):** Methane and oxygen react to make carbon dioxide and water.
- ✅ **summary:** As methane burns, most of the energy comes out as heat, and a little comes out as light. *(LibreTexts Chemistry)*
- ⛔ **bondingType:** the sentence and its excerpt must both say 'covalent' (code check)
- ✅ **bondingWhy:** A covalent bond forms when two atoms share electrons between them. *(LibreTexts Chemistry)*
- ❌ **bondingWhy:** Sharing electrons is another way for atoms to fill up their outer shell, which is called the valence shell. *(LibreTexts Chemistry)* — verifier 1: The passage says sharing electrons is another way to get a complete valence shell, but it never says the valence shell is the outer shell, so that definition is added.; verifier 2: The passage says sharing electrons is another way to get a complete valence shell, but it never says the valence shell is the outer shell, so that definition is added.; verifier 3: The passage says sharing electrons is another way to obtain a complete valence shell, but it never says the valence shell is the outer shell.
- ✅ **trigger:** Methane catches fire easily from heat, a spark or a flame. *(Emergency Response Guidebook (ERG))*
- ✅ **hazard:** Methane catches fire very easily, and a mixture of methane gas and air can explode. *(ILO-WHO International Chemical Safety Cards (ICSCs))*
- ✅ **hazard:** Things that burn in air burn even more strongly in oxygen. *(CAMEO Chemicals)*

## Iron and sulfur

`Fe(s) + S(s) -> FeS(s)` · energy: exothermic

- 🔧 **summary (written by code):** Iron and sulfur combine to make iron(II) sulfide.
- ✅ **hazard:** Sulfur burns with a blue flame and makes sulfur dioxide, a poisonous gas. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **hazard:** Fine iron powder can catch fire all by itself. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*

## Helium and oxygen

- 🔧 **summary (written by code):** Helium and oxygen don't react with each other.
- ✅ **whyNot:** Helium's electrons are very hard to remove, which makes helium unreactive, meaning it doesn't easily join in chemical reactions. *(LibreTexts Chemistry)*
- ✅ **whyNot:** Helium is chemically inert, so it takes part in no chemical reactions under any known circumstances. *(CAMEO Chemicals)*

## Substances

### methane (CH4)

- ✅ **standardState (gas):** Methane is a gas. *(CAMEO Chemicals)*
- ✅ **appearance:** Methane has no color and no smell. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*
- ✅ **uses:** Methane is often piped into homes for heating and cooking. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Methane can be burned to make electricity. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Methane is used to make other chemicals and is part of the fuel called natural gas. *(CAMEO Chemicals)*

### carbon dioxide (CO2)

- ✅ **standardState (gas):** Carbon dioxide is a gas at everyday air temperatures and pressures. *(CAMEO Chemicals)*
- ✅ **appearance:** Carbon dioxide gas has no color and no smell. *(The National Institute for Occupational Safety and Health (NIOSH))*
- ✅ **uses:** Carbon dioxide is used to make fizzy soft drinks and soda water. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Carbon dioxide is used to put out fires and to freeze food. *(CAMEO Chemicals)*
- ✅ **uses:** Life jackets often contain carbon dioxide under pressure so they can inflate, or fill up, quickly. *(Toxin and Toxin Target Database (T3DB))*

### chlorine (Cl2)

- ✅ **appearance:** Chlorine is a yellow-green gas with a strong, irritating smell. *(Agency for Toxic Substances and Disease Registry (ATSDR))*

### iron (Fe)

- ✅ **appearance:** Pure iron is a silvery white, fairly soft metal. *(Hazardous Substances Data Bank (HSDB))*

### iron(II) sulfide (FeS)

- ❌ **standardState (solid):** Iron(II) sulfide is a gray to brown solid. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)* — verifier 1: The passage says it is a gray to brown solid or, in pure form, colorless crystals, so stating flatly that it is gray to brown leaves out the colorless pure form.; verifier 2: The passage says it is a gray to brown solid or, in pure form, colorless crystals, so stating flatly that it is gray to brown leaves out part of the answer.; verifier 3: The passage says it is a gray to brown solid or, in pure form, colorless hexagonal crystals, so the claim gives only part of the description as the whole answer.
- ✅ **appearance:** Iron(II) sulfide can look like dark brown or black metal-like pieces, sticks or small grains. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Iron(II) sulfide is used as a pigment, a coloring substance, in glass, bottles and paint. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*
- ✅ **uses:** Iron(II) sulfide is used to treat exhaust gases and heavy metal pollution. *(Hazardous Substances Data Bank (HSDB))*

### hydrogen (H2)

- ✅ **appearance:** Hydrogen is a gas with no color and no smell. *(CAMEO Chemicals)*

### water (H2O)

- ✅ **standardState (liquid):** Water is a liquid at normal room temperature and pressure. *(DrugBank)*
- ✅ **appearance:** Water is a clear liquid with no smell or taste. *(Medical Subject Headings (MeSH))*
- ✅ **uses:** Water is used for drinking, cooking, bathing, washing and doing laundry. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Water is used for farming, raising farm animals and gardens. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** People also use water for fun, such as swimming, boating and fishing. *(Hazardous Substances Data Bank (HSDB))*

### helium (He)

- ✅ **appearance:** Helium is a gas with no color and no smell. *(CAMEO Chemicals)*

### sodium (Na)

- ✅ **appearance:** Sodium is a soft, silvery metal that turns grayish white when it is left in the air. *(CAMEO Chemicals)*

### sodium chloride (NaCl)

- ✅ **appearance:** Sodium chloride looks like clear, colorless crystals or a white powder made of tiny crystals. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Sodium chloride is a salt that is commonly used to season food, which means adding flavor to it. *(Medical Subject Headings (MeSH))*
- ✅ **uses:** Salt is used to make plastic and paper, and for de-icing, which means clearing away ice. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Salting food is an important way to preserve it, which means keeping it from going bad. *(Toxin and Toxin Target Database (T3DB))*

### oxygen (O2)

- ✅ **appearance:** Oxygen is a gas with no color, no smell and no taste. *(CAMEO Chemicals)*

### sulfur (S)

- ✅ **appearance:** Sulfur looks like pale yellow crystals or powder and has a faint smell like rotten eggs. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*


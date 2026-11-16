# Reaction text: 2026-11-16-api-reactions-pilot

Checked 2026-11-16T01:05:26Z. Drafted and verified through the Claude API (prompts in `pipeline/prompts/`). 3 independent verifiers; a statement passes only with 3 of 3, each with a word-for-word excerpt.

- Statements verified: **51**, passed: **46**, failed: **5**
- Rejected by code before verification: **3**

Legend: ✅ passed, ❌ failed verification, ⛔ rejected by code before verification.

## Sodium and chlorine

`2 Na(s) + Cl2(g) -> 2 NaCl(s)` · energy: exothermic

- ✅ **summary:** Solid sodium metal reacts with chlorine gas to make a new solid called sodium chloride. *(LibreTexts Chemistry)*
- ❌ **summary:** This is a combination reaction, where two elements join together to form a compound, a substance made of both. *(LibreTexts Chemistry)* — verifier 2: The passage defines a combination reaction as two or more substances combining, with two elements forming a compound as only one example, and it never defines a compound as 'a substance made of both'.; verifier 3: The passage defines a combination reaction as two or more substances forming a single new substance, not only two elements, and never defines a compound as 'a substance made of both'.
- ✅ **bondingType (ionic):** Sodium chloride, also called table salt, is an ionic compound. *(DrugBank)*
- ✅ **bondingWhy:** A sodium atom passes an electron over to a chlorine atom. *(LibreTexts Chemistry)*
- ✅ **bondingWhy:** Particles with opposite electric charges, called ions, pull on each other, and this pull is called an ionic bond. *(LibreTexts Chemistry)*
- ⛔ **hazard:** drafter's excerpt isn't word for word in the passage
- ✅ **hazard:** Chlorine is a greenish yellow gas that is poisonous to breathe in. *(CAMEO Chemicals)*

## Hydrogen and oxygen

`2 H2(g) + O2(g) -> 2 H2O(l)` · energy: exothermic

- ✅ **summary:** Water is a clear liquid made of hydrogen and oxygen. *(CAMEO Chemicals)*
- ✅ **bondingType (covalent):** In a water molecule, the oxygen and hydrogen atoms are connected by covalent bonds. *(DrugBank)*
- ✅ **bondingWhy:** A covalent bond forms when atoms share electrons with each other. *(LibreTexts Chemistry)*
- ✅ **trigger:** Hydrogen catches fire easily from heat, a spark or a flame. *(Emergency Response Guidebook (ERG))*
- ⛔ **hazard:** safety screen: 'mixed'
- ✅ **hazard:** Hydrogen fires are hard to spot because hydrogen burns with an invisible flame. *(Emergency Response Guidebook (ERG))*

## Methane and oxygen

`CH4(g) + 2 O2(g) -> CO2(g) + 2 H2O(l)` · energy: exothermic

- ✅ **summary:** Methane is a gas that can burn, which means it is flammable. *(Medical Subject Headings (MeSH))*
- ✅ **summary:** Oxygen does not burn by itself, but it helps other things burn. *(CAMEO Chemicals)*
- ✅ **bondingType (covalent):** In water, the oxygen and hydrogen atoms are held together by covalent bonds. *(DrugBank)*
- ❌ **bondingWhy:** A covalent bond forms when two atoms share electrons, the tiny particles around an atom, between them. *(LibreTexts Chemistry)* — verifier 1: The passage supports the electron-sharing definition but never describes electrons as 'the tiny particles around an atom', so the claim adds detail.; verifier 2: The passage never describes electrons as 'the tiny particles around an atom', so the claim adds a definition the passage does not give.; verifier 3: The passage never describes electrons as 'tiny particles around an atom', so the claim adds a definition the passage does not give.
- ❌ **trigger:** Methane can easily be set burning by heat, a spark or a flame. *(ILO-WHO International Chemical Safety Cards (ICSCs))* — verifier 1: The passage says methane is extremely flammable and explosive in air but does not mention heat, sparks or flames as ignition sources.; verifier 2: The passage says only that methane is extremely flammable and that gas/air mixtures are explosive; it never mentions heat, sparks or flames setting it burning.; verifier 3: The passage says methane is extremely flammable but never mentions heat, sparks or flames as ways to ignite it.
- ⛔ **hazard:** safety screen: 'mixed'
- ✅ **hazard:** Oxygen makes any fire burn more fiercely. *(CAMEO Chemicals)*

## Iron and sulfur

`Fe(s) + S(s) -> FeS(s)` · energy: exothermic

- ✅ **hazard:** Sulfur burns with a blue flame that can be hard to see in daylight, and it makes a poisonous gas called sulfur dioxide. *(Hazardous Substances Data Bank (HSDB))*
- ❌ **hazard:** Very fine iron powder can catch fire all by itself. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)* — verifier 2: The passage says 'fine iron powder' can ignite spontaneously, but the claim adds 'very', which narrows the condition and changes the meaning.; verifier 3: The passage says 'fine iron powder' can ignite spontaneously, but the claim adds 'very fine', a qualifier the passage doesn't give.

## Helium and oxygen

- ✅ **whyNot:** Helium is chemically inert, which means it does not take part in chemical reactions under any known circumstances. *(CAMEO Chemicals)*
- ✅ **whyNot:** Helium is an inert gas that belongs to the noble gases, a group found on the periodic table. *(DrugBank)*

## Substances

### Methane (CH4)

- ✅ **standardState (gas):** Methane is a gas. *(CAMEO Chemicals)*
- ✅ **appearance:** Methane has no color and no smell. *(ChEBI)*
- ✅ **uses:** Methane is often piped into homes for heating and cooking. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Methane can be burned to make electricity. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Methane is used to make other chemicals and is part of the fuel called natural gas. *(CAMEO Chemicals)*

### Carbon Dioxide (CO2)

- ✅ **standardState (gas):** Carbon dioxide is a gas at normal air temperature and pressure. *(CAMEO Chemicals)*
- ✅ **appearance:** Carbon dioxide gas has no color and no smell. *(NCI Thesaurus (NCIt))*
- ✅ **uses:** Carbon dioxide is used to make fizzy soft drinks and soda water. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Carbon dioxide is used in fire extinguishers. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*
- ✅ **uses:** Life jackets often contain canisters of carbon dioxide under pressure, so they can fill up quickly. *(Toxin and Toxin Target Database (T3DB))*

### Chlorine (Cl2)

- ❌ **appearance:** Chlorine is a yellow-green gas with a strong, irritating smell. *(Agency for Toxic Substances and Disease Registry (ATSDR))* — verifier 3: The passage says chlorine is a yellow-green gas only at room temperature and notes it can be a liquid, but the claim drops that condition and states it unconditionally.

### Iron (Fe)

- ✅ **appearance:** Pure iron is a silvery-white metal that is fairly soft. *(Hazardous Substances Data Bank (HSDB))*

### Ferrous sulfide (FeS)

- ✅ **standardState (solid):** Ferrous sulfide is a solid. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*
- ✅ **appearance:** Ferrous sulfide usually looks like gray to brownish-black lumps, rods or grainy powder. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Ferrous sulfide is used as a pigment, which is a coloring, in paint. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Ferrous sulfide is used as a pigment in glasses and bottles. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*

### Hydrogen (H2)

- ✅ **appearance:** Hydrogen is a gas with no color and no smell. *(CAMEO Chemicals)*

### Water (H2O)

- ✅ **standardState (liquid):** Water is a liquid at normal room temperature and pressure. *(DrugBank)*
- ✅ **appearance:** Water is a clear liquid with no color, smell or taste. *(NCI Thesaurus (NCIt))*
- ✅ **uses:** People use water for drinking, cooking, bathing and washing clothes. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Water is used for farming, gardens, making power and protecting against fire. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** People also use water for fun, like swimming, fishing and boating. *(Hazardous Substances Data Bank (HSDB))*

### Helium (He)

- ✅ **appearance:** Helium is a gas with no color and no smell. *(CAMEO Chemicals)*

### Sodium (Na)

- ✅ **appearance:** Sodium is a soft, silvery metal that turns grayish white when air touches it. *(CAMEO Chemicals)*

### Sodium Chloride (NaCl)

- ✅ **appearance:** Sodium chloride looks like clear, colorless crystals or a white powder made of tiny crystals. *(Hazardous Substances Data Bank (HSDB))*
- ✅ **uses:** Sodium chloride is commonly used to season food, which means adding flavor to it. *(Medical Subject Headings (MeSH))*
- ✅ **uses:** Salt is used for de-icing, which means clearing away ice, and for making plastic and paper. *(Toxin and Toxin Target Database (T3DB))*
- ✅ **uses:** Salting food is an important way to preserve it, which means keeping it from spoiling. *(Toxin and Toxin Target Database (T3DB))*

### Oxygen (O2)

- ✅ **appearance:** Oxygen is a gas with no color, no smell and no taste. *(CAMEO Chemicals)*

### Sulfur (S)

- ✅ **appearance:** Sulfur looks like pale yellow crystals or powder and has a faint smell like rotten eggs. *(Haz-Map, Information on Hazardous Chemicals and Occupational Diseases)*


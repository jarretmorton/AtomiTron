# Text facts: pilot run 2026-11-12-elements-text-pilot

Checked 2026-11-13T04:02:58Z. Prompts: `pipeline/prompts/`. 3 independent verifiers; a claim passes only with 3 of 3, each with a word-for-word excerpt.

- Claims verified: **83**, passed: **77**, failed: **6**
- Rejected by code before verification: **0**

## Failed verification

| Claim | Text | Agreeing | Why |
|---|---|---|---|
| `Fe.discoveryYear` | Iron has been known since ancient times. | 0/3 | verifier 1: The passage says iron has been known from prehistoric times, not ancient times, so it does not state the claimed period.; verifier 2: The passage says iron has been known from prehistoric times, not since ancient times, and states no ancient-times dating for its discovery.; verifier 3: The passage says iron "has been known from prehistoric times", not ancient times, so the stated period does not match. |
| `Cu.discoveryYear` | Copper has been known since ancient times. | 0/3 | verifier 1: The passage says copper has been known since prehistoric times, not ancient times, so it does not state the claimed period.; verifier 2: The passage says copper has been known since prehistoric times, not ancient times, so the stated era does not match.; verifier 3: The passage says copper "has been known since prehistoric times", not ancient times, so the stated period does not match. |
| `Au.discoveryYear` | Gold has been known since ancient times. | 0/3 | verifier 1: The passage says gold was known in prehistoric times, not ancient times, so it does not state the claimed period.; verifier 2: The passage says gold was known in prehistoric times, not since ancient times, so the stated era does not match.; verifier 3: The passage says gold was known "in prehistoric times", not ancient times, so the stated period does not match. |
| `Au.story.0` | The name gold comes from the Sanskrit word jval, meaning "shine", and the Teutonic word gulth, meaning "shining metal". | 2/3 | verifier 2: The passage gives three sources for the name (Sanskrit jval, Teutonic gulth and the Anglo-Saxon gold), so presenting only the first two as its origin changes the meaning. |
| `concept.shells` | Electrons sit in shells around the nucleus. Orbitals with the same principal quantum number form one shell. | 0/3 | verifier 1: The passage says orbitals with the same principal quantum number form a shell, but never says electrons sit in shells around the nucleus.; verifier 2: The passage says orbitals with the same principal quantum number form a shell, but it does not say electrons sit in shells around the nucleus.; verifier 3: The passage says orbitals with the same principal quantum number form a shell, but never says electrons sit in shells around the nucleus. |
| `concept.valence` | Valence electrons are the ones in the outermost shell. They do most of the work when atoms combine. | 0/3 | verifier 1: The passage defines valence electrons as those in the highest-numbered shell plus any in the last unfilled subshell and says they largely control an atom's chemistry, not that they do most of the work when atoms combine.; verifier 2: The passage defines valence electrons as those in the highest-numbered shell plus any in the last unfilled subshell and says they largely control an atom's chemistry, not that they are only outermost-shell electrons doing most of the work when atoms combine.; verifier 3: The passage defines valence electrons as those in the highest-numbered shell plus any in the last unfilled subshell and says they largely control an atom's chemistry; it does not say 'outermost' or describe their role when atoms combine. |

## Rejected before verification

| Claim | Why |
|---|---|
| none | |

## Passed

- `H.story.0` (IUPAC CIAAW): The name hydrogen comes from Greek words meaning "water" and "forming", because it burned in air to form water.
- `H.story.1` (IUPAC CIAAW): Hydrogen was discovered by the English physicist Henry Cavendish.
- `H.story.2` (Jefferson Lab): Written records indicate that Robert Boyle produced hydrogen gas as early as 1671 while experimenting with iron and acids.
- `H.uses.0` (Los Alamos National Laboratory): Hydrogen is used for filling balloons.
- `H.uses.1` (Jefferson Lab): Hydrogen is added to fats and oils, such as peanut oil, through a process called hydrogenation.
- `H.uses.2` (Los Alamos National Laboratory): The hydrogen fuel cell is a developing technology for obtaining electrical power from hydrogen gas.
- `H.uses.3` (Jefferson Lab): Liquid hydrogen is used in the study of superconductors.
- `C.discoveryYear` (Jefferson Lab): Carbon has been known since ancient times.
- `C.story.0` (IUPAC CIAAW): The name carbon comes from the Latin word carbo, meaning "charcoal".
- `C.story.1` (IUPAC CIAAW): Carbon was known in prehistoric times in the form of charcoal and soot.
- `C.story.2` (IUPAC CIAAW): In 1797, the English chemist Smithson Tennant proved that diamond is pure carbon.
- `C.uses.0` (Jefferson Lab): The black material in pencils, often called lead, is actually graphite.
- `C.uses.1` (Jefferson Lab): Carbon black, a kind of black soot, is used to make inks, paints and rubber products.
- `C.uses.2` (Jefferson Lab): Graphite, a form of carbon, is mainly used as a lubricant.
- `C.uses.3` (Jefferson Lab): A radioactive isotope of carbon is used to find the age of formerly living things, through a process known as radiocarbon dating.
- `N.discoveryYear` (IUPAC CIAAW): Nitrogen was discovered or first isolated in 1772.
- `N.story.0` (IUPAC CIAAW): Nitrogen was discovered by the Scottish physician and chemist Daniel Rutherford in 1772.
- `N.story.1` (IUPAC CIAAW): The name nitrogen comes from words meaning "native soda" and "forming".
- `N.story.2` (Los Alamos National Laboratory): Rutherford removed oxygen and carbon dioxide from air and showed that the remaining gas would not support burning or living things.
- `N.uses.0` (Jefferson Lab): The largest use of nitrogen is for making ammonia.
- `N.uses.1` (Jefferson Lab): Liquid nitrogen is used for refrigeration.
- `N.uses.2` (Jefferson Lab): Liquid nitrogen is used to preserve biological samples.
- `N.uses.3` (Jefferson Lab): Nitrogen gas is used as a protective shield in the semiconductor industry.
- `O.story.0` (IUPAC CIAAW): The name oxygen comes from Greek words meaning "acid" and "forming".
- `O.story.1` (Jefferson Lab): The name oxygen was created by Antoine Lavoisier, who incorrectly believed that oxygen was necessary to form all acids.
- `O.story.2` (Jefferson Lab): Joseph Priestley and Carl Wilhelm Scheele both discovered oxygen independently, but Priestley is usually given credit for the discovery.
- `O.uses.0` (Los Alamos National Laboratory): Plants and animals rely on oxygen for respiration.
- `O.uses.1` (Los Alamos National Laboratory): Hospitals frequently prescribe oxygen for patients with breathing illnesses.
- `O.uses.2` (Jefferson Lab): Oxygen is used in making steel, where it burns away impurities in molten iron.
- `O.uses.3` (Jefferson Lab): Oxygen can be combined with acetylene to produce a very hot flame used for welding.
- `Na.discoveryYear` (IUPAC CIAAW): Sodium was discovered or first isolated in 1807.
- `Na.story.0` (IUPAC CIAAW): Sodium was discovered in 1807 by the English chemist Humphry Davy.
- `Na.story.1` (IUPAC CIAAW): The name sodium comes from the English word soda and the Latin sodanum, meaning "headache remedy".
- `Na.story.2` (IUPAC CIAAW): The symbol Na comes from the Latin word natrium.
- `Na.uses.0` (Jefferson Lab): Sodium vapor is used in streetlights and produces a brilliant yellow light.
- `Na.uses.1` (Jefferson Lab): Sodium forms many useful compounds, including table salt and baking soda.
- `Na.uses.2` (Jefferson Lab): Liquid sodium has been used as a coolant for nuclear reactors.
- `Na.uses.3` (Jefferson Lab): Sodium is used in the production of titanium.
- `Mg.story.0` (IUPAC CIAAW): The name magnesium comes from Magnesia, a district in the north-eastern region of Greece called Thessalia.
- `Mg.story.1` (IUPAC CIAAW): The Scottish chemist Joseph Black recognized magnesium as a separate element in 1755.
- `Mg.story.2` (IUPAC CIAAW): In 1808, the English chemist Humphry Davy obtained impure magnesium metal.
- `Mg.uses.0` (Jefferson Lab): Cameras, horseshoes, baseball catchers' masks and snowshoes are among the items made from magnesium alloys.
- `Mg.uses.1` (Jefferson Lab): Magnesium oxide is used in some antacids.
- `Mg.uses.2` (Jefferson Lab): A thin film of magnesium fluoride is applied to optical lenses to help reduce glare and reflections.
- `Mg.uses.3` (Jefferson Lab): Magnesium carbonate is added to table salt to prevent caking.
- `Cl.discoveryYear` (IUPAC CIAAW): Chlorine was discovered or first isolated in 1774.
- `Cl.story.0` (IUPAC CIAAW): The name chlorine comes from the Greek word chloros, meaning "pale green" or "greenish yellow".
- `Cl.story.1` (IUPAC CIAAW): Chlorine was discovered by the Swedish pharmacist and chemist Carl-Wilhelm Scheele in 1774.
- `Cl.story.2` (IUPAC CIAAW): In 1810, the English chemist Humphry Davy proved that chlorine was an element.
- `Cl.uses.0` (Jefferson Lab): Chlorine is used to make drinking water safe and to treat swimming pools.
- `Cl.uses.1` (Jefferson Lab): Chlorine is commonly used as an antiseptic.
- `Cl.uses.2` (Jefferson Lab): Sodium chloride, a chlorine compound commonly known as table salt, is used to season food.
- `Cl.uses.3` (Los Alamos National Laboratory): Chlorine is used in the production of paper products, textiles and medicines.
- `Fe.story.0` (IUPAC CIAAW): The name iron comes from an Anglo-Saxon word of unknown origin.
- `Fe.story.1` (IUPAC CIAAW): The symbol Fe comes from the Latin word ferrum, meaning "firmness".
- `Fe.story.2` (Los Alamos National Laboratory): Iron is mentioned many times in the Old Testament of the Bible.
- `Fe.uses.0` (Jefferson Lab): Huge amounts of iron are used to make steel, an alloy of iron and carbon.
- `Fe.uses.1` (Jefferson Lab): Steel is used to make paper clips, skyscrapers and everything in between.
- `Fe.uses.2` (Jefferson Lab): Adding chromium to steel improves its durability and prevents rust, making stainless steel.
- `Fe.uses.3` (Jefferson Lab): Iron sulfate is used to treat the blood disease anemia.
- `Cu.story.0` (IUPAC CIAAW): The name copper comes from the Latin cuprum, for Cyprus, the island where the Romans first obtained copper.
- `Cu.story.1` (IUPAC CIAAW): The symbol Cu also comes from the Latin cuprum.
- `Cu.story.2` (IUPAC CIAAW): Copper has been known since prehistoric times.
- `Cu.uses.0` (Jefferson Lab): The electrical industry uses copper in the form of wire.
- `Cu.uses.1` (Jefferson Lab): Since it resists corrosion from the air, moisture and seawater, copper has been widely used in coins.
- `Cu.uses.2` (Jefferson Lab): Copper is used to make water pipes and jewelry.
- `Cu.uses.3` (Jefferson Lab): Brass, an alloy of copper, is used today in some musical instruments and screws.
- `Au.story.1` (IUPAC CIAAW): The symbol Au comes from the Latin aurum, for Aurora, the goddess of dawn.
- `Au.story.2` (IUPAC CIAAW): Gold was known and highly valued in prehistoric times.
- `Au.uses.0` (Jefferson Lab): Gold alloys are used to make jewelry, decorative items, dental fillings and coins.
- `Au.uses.1` (Jefferson Lab): Thin sheets of gold, known as gold leaf, are mainly used in arts and crafts for gilding.
- `Au.uses.2` (Jefferson Lab): Gold can be used to make electrical connectors and printed circuit boards.
- `Au.uses.3` (Los Alamos National Laboratory): Gold is used for coating certain space satellites, as it is a good reflector of infrared and is inert.
- `concept.atomicNumber` (LibreTexts Chemistry): The atomic number is the number of protons in the nucleus. It is what makes an element that element.
- `concept.electrons` (LibreTexts Chemistry): A neutral atom has the same number of electrons as protons.
- `concept.neutrons` (LibreTexts Chemistry): The mass number counts protons and neutrons together, so neutrons = mass number − atomic number.
- `concept.isotopes` (LibreTexts Chemistry): Isotopes are atoms of the same element with different numbers of neutrons.

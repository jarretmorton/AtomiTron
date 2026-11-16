// Short explanations shown beside the numbers on an element page ("all the
// table numbers explained", spec 3.2) and in Combine mode (spec 3.3). Each one is a plain-language statement
// of what its cited LibreTexts page says, and each has a verification record
// in verification/records/concepts.json from three independent verifiers
// (pipeline/text_facts.py). A test fails the build if any sentence here lacks
// a passing record for its exact text and URL.

const LT = 'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(LibreTexts)';
const PROTONS = `${LT}/04%3A_Atoms_and_Elements/4.05%3A_Elements-_Defined_by_Their_Number_of_Protons`;
const ISOTOPES = `${LT}/04%3A_Atoms_and_Elements/4.08%3A_Isotopes_-_When_the_Number_of_Neutrons_Varies`;
const ORBITALS = `${LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.06%3A_Quantum-Mechanical_Orbitals_and_Electron_Configurations`;
const VALENCE = `${LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.07%3A_Electron_Configurations_and_the_Periodic_Table`;
const ENERGY = `${LT}/03%3A_Matter_and_Energy/3.09%3A_Energy_and_Chemical_and_Physical_Change`;
const OPENSTAX = 'https://chem.libretexts.org/Bookshelves/General_Chemistry/Chemistry_2e_(OpenStax)';
const ENTHALPY = `${OPENSTAX}/05%3A_Thermochemistry/5.03%3A_Enthalpy`;
const POLARITY = `${LT}/10%3A_Chemical_Bonding/10.08%3A_Electronegativity_and_Polarity_-_Why_Oil_and_Water_Do_not_Mix`;
const BALANCE = `${LT}/07%3A_Chemical_Reactions/7.04%3A_How_to_Write_Balanced_Chemical_Equations`;
const CK12 = 'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(CK-12)';
const COORDINATION = `${CK12}/08%3A_Ionic_and_Metallic_Bonding/8.08%3A_Coordination_Number`;

export interface Concept {
  text: string;
  url: string;
}

export const CONCEPTS = {
  atomicNumber: {
    text: 'The atomic number is the number of protons in the nucleus. It is what makes an element that element.',
    url: PROTONS,
  },
  electrons: {
    text: 'A neutral atom has the same number of electrons as protons.',
    url: PROTONS,
  },
  neutrons: {
    text: 'The mass number counts protons and neutrons together, so neutrons = mass number − atomic number.',
    url: ISOTOPES,
  },
  isotopes: {
    text: 'Isotopes are atoms of the same element with different numbers of neutrons.',
    url: ISOTOPES,
  },
  configuration: {
    text: 'An electron configuration lists the shell and subshell labels, with a superscript giving the number of electrons in that subshell.',
    url: ORBITALS,
  },
  shells: {
    text: 'Orbitals that have the same principal quantum number form a shell, and each shell is divided into subshells.',
    url: ORBITALS,
  },
  valence: {
    text: "Valence electrons are the electrons in the highest-numbered shell, plus any in the last unfilled subshell. They largely control an atom's chemistry.",
    url: VALENCE,
  },
  exothermic: {
    text: 'Reactions that release energy are called exothermic.',
    url: ENERGY,
  },
  endothermic: {
    text: 'Reactions that absorb energy are called endothermic.',
    url: ENERGY,
  },
  enthalpySign: {
    text: 'A negative enthalpy change means a reaction is exothermic, and a positive one means it is endothermic.',
    url: ENTHALPY,
  },
  electronegativity: {
    text: 'Electronegativity is the ability of an atom in a molecule to attract shared electrons.',
    url: POLARITY,
  },
  bondByDifference: {
    text: 'When the electronegativity difference between two atoms is small, the electrons are shared and the bond is covalent; when it is large, one atom takes the electrons and the bond is ionic.',
    url: POLARITY,
  },
  saltLattice: {
    text: 'In a sodium chloride crystal, six chloride ions surround each sodium ion, and six sodium ions surround each chloride ion.',
    url: COORDINATION,
  },
  balanced: {
    text: 'A balanced chemical equation has the same number and type of each atom on both sides.',
    url: BALANCE,
  },
  formationZero: {
    text: 'By definition, an element in its most stable form has a standard enthalpy of formation of zero.',
    url: ENTHALPY,
  },
} satisfies Record<string, Concept>;

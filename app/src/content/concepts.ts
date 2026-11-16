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
  formationZero: {
    text: 'By definition, an element in its most stable form has a standard enthalpy of formation of zero.',
    url: ENTHALPY,
  },
} satisfies Record<string, Concept>;

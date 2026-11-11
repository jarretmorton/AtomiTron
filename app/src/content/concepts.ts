// Short explanations shown beside the numbers on an element page ("all the
// table numbers explained", spec 3.2). Each one is a plain-language statement
// of what its cited LibreTexts page says. They were checked against the pages
// by hand on 2026-11-11, and they get formal verification records in the
// text-facts step. Tests check every URL is on the whitelist.

const LT = 'https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_(LibreTexts)';
const PROTONS = `${LT}/04%3A_Atoms_and_Elements/4.05%3A_Elements-_Defined_by_Their_Number_of_Protons`;
const ISOTOPES = `${LT}/04%3A_Atoms_and_Elements/4.08%3A_Isotopes_-_When_the_Number_of_Neutrons_Varies`;
const ORBITALS = `${LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.06%3A_Quantum-Mechanical_Orbitals_and_Electron_Configurations`;
const VALENCE = `${LT}/09%3A_Electrons_in_Atoms_and_the_Periodic_Table/9.07%3A_Electron_Configurations_and_the_Periodic_Table`;

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
  shells: {
    text: 'Electrons sit in shells around the nucleus. Orbitals with the same principal quantum number form one shell.',
    url: ORBITALS,
  },
  valence: {
    text: 'Valence electrons are the ones in the outermost shell. They do most of the work when atoms combine.',
    url: VALENCE,
  },
} satisfies Record<string, Concept>;

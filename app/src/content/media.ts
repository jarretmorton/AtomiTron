// Photos and figures shown in Combine mode, each from a page AtomiTron
// already cites, with its credit and licence as that page gives them. Only
// images whose licence is stated (or that are the source book's own, under
// its open licence) are used, resized for the iPad. A caption names only the
// credit: anything said about what a photo shows comes from verified facts.

const LT = 'https://chem.libretexts.org/Bookshelves';

export interface Photo {
  /** File in app/public/media/. */
  file: string;
  alt: string;
  credit: string;
  /** The page the image appears on. */
  sourceUrl: string;
  /** Reaction ids (without "reaction:") it is shown with. */
  reactions: string[];
}

export const PHOTOS: Photo[] = [
  {
    file: 'openstax-sodium-chlorine-salt.jpg',
    alt: 'Three photos: sodium metal in a jar of oil, chlorine gas in a flask, and white salt crystals.',
    credit: 'From OpenStax Chemistry (CC BY 4.0). Sodium photo: modification of work by “Jurii”/Wikimedia Commons.',
    sourceUrl: `${LT}/Introductory_Chemistry/Chemistry_for_Changing_Times_(Hill_and_McCreary)/04%3A_Chemical_Bonds/4.03%3A_The_Reaction_of_Sodium_with_Chlorine`,
    reactions: ['sodium-chlorine'],
  },
  {
    file: 'nasa-salt-crystals.jpg',
    alt: 'Close-up of clear salt crystals.',
    credit: 'Public domain (NASA).',
    sourceUrl: `${LT}/Introductory_Chemistry/Chemistry_for_Changing_Times_(Hill_and_McCreary)/04%3A_Chemical_Bonds/4.03%3A_The_Reaction_of_Sodium_with_Chlorine`,
    reactions: ['sodium-chlorine'],
  },
  {
    file: 'openstax-electrolysis-of-water.jpg',
    alt: 'Diagram: two tubes over water with a battery; arrows point to water, hydrogen and oxygen molecules.',
    credit: 'From OpenStax Chemistry: Atoms First (CC BY 4.0).',
    sourceUrl: `${LT}/General_Chemistry/Chemistry_-_Atoms_First_2e_(OpenStax)/18%3A_Representative_Metals_Metalloids_and_Nonmetals/18.06%3A_Occurrence_Preparation_and_Compounds_of_Hydrogen`,
    reactions: ['water-splitting'],
  },
  {
    file: 'noble-gas-tubes.jpg',
    alt: 'Five glowing glass tubes labelled He, Ne, Ar, Kr and Xe.',
    credit: 'CC BY 3.0, User:Jurii/Wikimedia Commons.',
    sourceUrl: `${LT}/Introductory_Chemistry/Introductory_Chemistry_(CK-12)/06%3A_The_Periodic_Table/6.11%3A_Noble_Gases`,
    reactions: ['helium-oxygen', 'neon-chlorine', 'argon-sodium'],
  },
];

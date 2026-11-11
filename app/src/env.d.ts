/** package.json version, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

declare module 'virtual:element-index' {
  /** One row per verified element, sorted by atomic number (see vite.config.ts). */
  const index: {
    file: string;
    z: number;
    symbol: string;
    name: string;
    period: number;
    /** null for lanthanum to ytterbium and actinium to nobelium (f-block rows). */
    group: number | null;
    classification: 'Metal' | 'Non-metal' | 'Semi-metal' | null;
    /** The classification is a prediction (never made in visible amounts). */
    predicted: boolean;
  }[];
  export default index;
}

// Element data access. The table uses the build-time index; each element page
// loads only its own verified file (a separate chunk), so the iPad never
// downloads all of them at once.

import index from 'virtual:element-index';
import type { Dataset, Element } from './schema';

export type IndexRow = (typeof index)[number];
export const ELEMENTS: readonly IndexRow[] = index;

const files = import.meta.glob<Dataset<'elements'>>('../../../data/verified/elements/*.json', { import: 'default' });

export function findBySymbol(symbol: string): IndexRow | undefined {
  return ELEMENTS.find((e) => e.symbol === symbol);
}

export async function loadElement(row: IndexRow): Promise<Element> {
  const load = files[`../../../data/verified/elements/${row.file}`];
  if (!load) throw new Error(`No data file for ${row.symbol}`);
  const data = await load();
  return data.items[0]!;
}

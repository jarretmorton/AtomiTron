// The periodic table (spec 3.1). Tiles are placed by their verified period and
// group, and colored by verified classification (metal, semi-metal,
// non-metal). Each class also has its own shape, so color never carries the
// meaning alone. Predicted classifications get a dashed border. Tiles keep a
// 44 pt minimum, so in portrait on an iPad mini the table scrolls sideways
// inside its frame.

import { ELEMENTS, type IndexRow } from '../data/elements';
import { el } from '../ui/fact';

export const CLASSES = {
  Metal: { key: 'metal', shape: '●', label: 'Metal' },
  'Semi-metal': { key: 'semimetal', shape: '◆', label: 'Semi-metal' },
  'Non-metal': { key: 'nonmetal', shape: '▲', label: 'Non-metal' },
} as const;
const UNCLASSIFIED = { key: 'unclassified', shape: '○', label: 'Not classified' } as const;

function classOf(row: IndexRow) {
  return row.classification ? CLASSES[row.classification] : UNCLASSIFIED;
}

/** Grid position: groups 1 to 18 in rows 1 to 7, f-block in rows 9 and 10. */
function position(row: IndexRow, fIndex: Map<number, number>): { col: number; row: number } {
  if (row.group !== null) return { col: row.group, row: row.period };
  return { col: 3 + fIndex.get(row.z)!, row: row.period + 3 };
}

function tile(row: IndexRow, fIndex: Map<number, number>): HTMLAnchorElement {
  const cls = classOf(row);
  const a = el('a', `tile ${cls.key}${row.predicted ? ' predicted' : ''}`);
  a.href = `#/element/${row.symbol}`;
  const { col, row: r } = position(row, fIndex);
  a.style.gridColumn = String(col);
  a.style.gridRow = String(r);
  a.setAttribute('aria-label', `${row.name}, ${row.z}, ${cls.label}${row.predicted ? ' (predicted)' : ''}`);
  a.append(
    el('span', 'tile-z', String(row.z)),
    el('span', 'tile-shape', cls.shape),
    el('span', 'tile-symbol', row.symbol),
    el('span', 'tile-name', row.name),
  );
  return a;
}

function legend(): HTMLElement {
  const ul = el('ul', 'table-legend');
  for (const c of [...Object.values(CLASSES), UNCLASSIFIED]) {
    const li = el('li', `legend-item ${c.key}`);
    li.append(el('span', 'legend-swatch', c.shape), ` ${c.label}`);
    ul.append(li);
  }
  const li = el('li', 'legend-item predicted-key');
  li.append(el('span', 'legend-swatch dashed', ''), ' Dashed border: predicted, never made in visible amounts');
  ul.append(li);
  return ul;
}

export function tableView(): HTMLElement {
  const section = el('section', 'table-view');
  section.append(el('h1', 'visually-hidden', 'Periodic table'));
  section.append(el('p', 'lede', 'Tap an element to see its atom, what its numbers mean, and where every fact comes from.'));

  // f-block elements fill rows 9 and 10 in atomic-number order.
  const fIndex = new Map<number, number>();
  for (const period of [6, 7]) {
    ELEMENTS.filter((e) => e.group === null && e.period === period).forEach((e, i) => fIndex.set(e.z, i));
  }

  const frame = el('div', 'table-frame');
  frame.tabIndex = 0;
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', 'Periodic table, scrolls sideways');
  const grid = el('div', 'ptable');
  for (const row of ELEMENTS) grid.append(tile(row, fIndex));
  frame.append(grid);
  section.append(frame, el('p', 'swipe-hint', 'Swipe the table sideways to see all 18 columns.'), legend(), el('p', 'table-note',
    'Colors and shapes show how each element is classified, from Jefferson Lab via PubChem. Tap an element for the source.'));
  return section;
}

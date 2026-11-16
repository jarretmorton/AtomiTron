// Route table. Journal is a placeholder until phase 4.

import { combineView } from './views/combine';
import { elementView } from './views/element';
import { previewView } from './views/preview';
import { tableView } from './views/table';

function placeholder(title: string, body: string, phase: number): () => HTMLElement {
  return () => {
    const section = document.createElement('section');
    section.className = 'placeholder';
    const h1 = document.createElement('h1');
    h1.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const note = document.createElement('p');
    note.className = 'coming';
    note.textContent = `Coming in phase ${phase}.`;
    section.append(h1, p, note);
    return section;
  };
}

export const views = {
  table: () => tableView(),
  element: (params: string[]) => elementView(params[0]),
  combine: (params: string[]) => combineView(params),
  // Not linked from the app: a review page for proposed visuals.
  preview: () => previewView(),
  journal: placeholder('Journal', 'Every compound you discover and every hypothesis you write is collected here.', 4),
} satisfies Record<string, (params: string[]) => HTMLElement>;

export type Route = keyof typeof views;

// Phase 1 placeholders. Each later phase replaces one of these with the real view.

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
  table: placeholder(
    'Periodic table',
    'Tap any element to see its atom, what its numbers mean, and where every fact comes from.',
    2,
  ),
  combine: placeholder(
    'Combine',
    'Pick two or more elements and find out whether they react, and why.',
    3,
  ),
  journal: placeholder(
    'Journal',
    'Every compound you discover and every hypothesis you write is collected here.',
    4,
  ),
} satisfies Record<string, () => HTMLElement>;

export type Route = keyof typeof views;

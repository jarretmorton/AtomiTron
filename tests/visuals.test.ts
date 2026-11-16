// The bond visuals on real data: 3D models start facing the viewer so no
// atom hides behind another, every compound has its drawing, and every photo
// is for a real entry and has its file and credit.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { facing, type Vec } from '../app/src/ui/model3d';
import { ROOT } from './integrity';

type Model = { '3d': { atoms: { symbol: string; x: number; y: number; z: number }[] } };
const model = (cid: number) => JSON.parse(readFileSync(join(ROOT, `data/models/cid-${cid}.json`), 'utf8')) as Model;

describe('3D models', () => {
  it('start with the widest side facing the viewer, so water shows both hydrogens', () => {
    const atoms = model(962)['3d'].atoms;
    const c = [0, 1, 2].map((k) => atoms.reduce((s, a) => s + [a.x, a.y, a.z][k]!, 0) / atoms.length);
    const pts = facing(atoms.map((a) => [a.x - c[0]!, a.y - c[1]!, a.z - c[2]!] as Vec));
    // A flat molecule lies in the screen plane: no depth, and the atoms spread apart on screen.
    for (const p of pts) expect(Math.abs(p[2])).toBeLessThan(1e-6);
    const [o, h1, h2] = pts;
    expect(Math.hypot(h1![0] - h2![0], h1![1] - h2![1])).toBeGreaterThan(1);
    expect(Math.hypot(h1![0] - o![0], h1![1] - o![1])).toBeGreaterThan(0.5);
  });
});

describe('pictures', () => {
  it('has a PubChem drawing for every compound, and every photo is complete', async () => {
    const { existsSync } = await import('node:fs');
    const { PHOTOS } = await import('../app/src/content/media');
    const compounds = JSON.parse(readFileSync(join(ROOT, 'data/verified/compounds.json'), 'utf8')).items as { id: string; element?: string }[];
    for (const c of compounds.filter((x) => !x.element)) {
      expect(existsSync(join(ROOT, 'app/public/media', `pubchem-cid-${c.id.split('-').pop()}.png`)), c.id).toBe(true);
    }
    const ids = new Set((JSON.parse(readFileSync(join(ROOT, 'data/verified/reactions.json'), 'utf8')).items as { id: string }[]).map((r) => r.id));
    for (const p of PHOTOS) {
      expect(existsSync(join(ROOT, 'app/public/media', p.file)), p.file).toBe(true);
      expect(p.credit.length, p.file).toBeGreaterThan(5);
      expect(p.sourceUrl.startsWith('https://chem.libretexts.org/'), p.file).toBe(true);
      for (const r of p.reactions) expect(ids.has(`reaction:${r}`), r).toBe(true);
    }
  });
});

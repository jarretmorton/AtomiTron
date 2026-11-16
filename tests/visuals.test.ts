// The bond visuals' logic on real data: electron-dot drawings appear only
// when every atom ends with a full outer shell, and 3D models start facing
// the viewer so no atom hides behind another.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planLewis, type ModelAtom, type ModelBond } from '../app/src/ui/lewis';
import { facing, type Vec } from '../app/src/ui/model3d';
import { ROOT } from './integrity';

type Model = { '3d': { atoms: ModelAtom[]; bonds: ModelBond[] } };
const model = (cid: number) => JSON.parse(readFileSync(join(ROOT, `data/models/cid-${cid}.json`), 'utf8')) as Model;
const VALENCE: Record<string, number> = { H: 1, C: 4, N: 5, O: 6 };
const valence = (s: string) => VALENCE[s];

describe('electron-dot drawings', () => {
  it('fills every outer shell for the preview molecules', () => {
    const lone = (cid: number) => planLewis(model(cid)['3d'].atoms, model(cid)['3d'].bonds, valence)?.atoms.map((a) => `${a.symbol}${a.lonePairs}`).sort();
    expect(lone(962)).toEqual(['H0', 'H0', 'O2']); // water: two unshared pairs on oxygen
    expect(lone(222)).toEqual(['H0', 'H0', 'H0', 'N1']); // ammonia: one
    expect(lone(280)).toEqual(['C0', 'O2', 'O2']); // carbon dioxide: double bonds, two pairs on each oxygen
  });

  it('draws carbon dioxide straight', () => {
    const p = planLewis(model(280)['3d'].atoms, model(280)['3d'].bonds, valence)!;
    const ys = p.atoms.map((a) => a.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(0.01);
  });

  it('draws nothing when the numbers do not fit', () => {
    // Carbon monoxide: a triple bond leaves carbon one electron short of a full shell by simple counting.
    const co: ModelAtom[] = [{ symbol: 'C', x: 0, y: 0, z: 0 }, { symbol: 'O', x: 1.1, y: 0, z: 0 }];
    expect(planLewis(co, [{ a: 0, b: 1, order: 3 }], valence)).toBeNull();
    expect(planLewis(co, [{ a: 0, b: 1, order: 1 }], valence)).toBeNull();
    expect(planLewis(co, [{ a: 0, b: 1, order: 2 }], () => undefined)).toBeNull();
  });
});

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

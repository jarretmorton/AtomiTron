// Derivation rules. Configuration strings include the forms PubChem actually
// serves: superscripts flattened ("[Ar]4s13d10"), "(predicted)" markers, and
// zero-width spaces.

import { describe, expect, it } from 'vitest';
import { derive, electronCount, parseConfiguration, shellCounts } from '../app/src/data/derive';

describe('parseConfiguration', () => {
  it.each<[string, string, number, number[]]>([
    ['H', '1s1', 1, [1]],
    ['He', '1s2', 2, [2]],
    ['Na', '[Ne]3s1', 11, [2, 8, 1]],
    ['Cl', '[Ne] 3s2 3p5', 17, [2, 8, 7]],
    ['Cu, flattened', '[Ar]4s13d10', 29, [2, 8, 18, 1]],
    ['Cu, spaced', '[Ar] 3d10 4s1', 29, [2, 8, 18, 1]],
    ['Tc, flattened', '[Kr]5s24d5', 43, [2, 8, 18, 13, 2]],
    ['Pb, flattened', '[Xe]4f145d106s26p2', 82, [2, 8, 18, 32, 18, 4]],
    ['U, flattened', '[Rn]5f36d17s2', 92, [2, 8, 18, 32, 21, 9, 2]],
    ['Og, predicted with zero-width space', '[Rn] 7s2 7p6 5f14 6d10\u200b(predicted)', 118, [2, 8, 18, 32, 32, 18, 8]],
  ])('%s', (_, text, electrons, shells) => {
    const occ = parseConfiguration(text);
    expect(occ).not.toBeNull();
    expect(electronCount(occ!)).toBe(electrons);
    expect(shellCounts(occ!)).toEqual(shells);
  });

  it.each([
    ['subshell that does not exist', '1s2 2d1'],
    ['over capacity', '[Ne] 3s3'],
    ['same subshell twice', '[Ne] 3s1 3s1'],
    ['subshell repeated from the core', '[Ne] 2p1'],
    ['unknown core', '[Fe] 4s2'],
    ['empty', ''],
    ['garbage', 'not a configuration'],
  ])('rejects %s', (_, text) => {
    expect(parseConfiguration(text)).toBeNull();
  });
});

describe('derive', () => {
  it('protons and electrons equal the atomic number', () => {
    expect(derive('protons-equal-atomic-number', [11])).toBe(11);
    expect(derive('electrons-equal-atomic-number', [11])).toBe(11);
  });

  it('neutrons are mass number minus atomic number', () => {
    expect(derive('neutrons-from-mass-number', [63, 29])).toBe(34);
    expect(() => derive('neutrons-from-mass-number', [10, 29])).toThrow(/smaller/);
  });

  it.each<[string, string, number, number]>([
    ['H', '1s1', 1, 1],
    ['He (2, not 8)', '1s2', 18, 2],
    ['Cl', '[Ne]3s23p5', 17, 7],
    ['Pb (ignores the full 4f and 5d)', '[Xe]4f145d106s26p2', 14, 4],
  ])('valence of %s', (_, config, group, expected) => {
    expect(derive('valence-main-group', [config, group])).toBe(expected);
  });

  it('refuses valence for transition metals', () => {
    expect(() => derive('valence-main-group', ['[Ar]4s13d10', 11])).toThrow(/main groups/);
  });

  it('checks input count and types', () => {
    expect(() => derive('neutrons-from-mass-number', [23])).toThrow(/2 input/);
    expect(() => derive('protons-equal-atomic-number', [11.5])).toThrow(/integer/);
    expect(() => derive('shells-from-configuration', ['[Ne] 3x1'])).toThrow(/unparseable/);
  });
});

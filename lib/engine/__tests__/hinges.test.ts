import { describe, expect, it } from 'vitest';
import { doorWeightKg, suggestHingeCount } from '../hinges';
import { DEFAULT_CONSTRUCTION } from '../constants';

const cc = DEFAULT_CONSTRUCTION;

describe('doorWeightKg', () => {
  it('ușă 596×716 din placă 18mm ≈ 5.3 kg', () => {
    expect(doorWeightKg(596, 716, 18, cc)).toBeCloseTo(5.34, 1);
  });
});

describe('suggestHingeCount — după înălțime', () => {
  it.each([
    [700, 2], [899, 2], [900, 2],
    [901, 3], [1500, 3],
    [1501, 4], [2100, 4],
    [2101, 5], [2400, 5],
  ])('înălțime %imm → %i balamale', (h, expected) => {
    expect(suggestHingeCount(h, 400, 4, cc).count).toBe(expected);
  });
});

describe('suggestHingeCount — corecție pe greutate', () => {
  it('ușă scundă dar grea: 700mm, 13kg → 4 balamale', () => {
    const { count, warnings } = suggestHingeCount(700, 600, 13, cc);
    expect(count).toBe(4);
    expect(warnings).toEqual([]);
  });

  it('peste banda maximă la 5 balamale → avertizare', () => {
    const { count, warnings } = suggestHingeCount(2300, 600, 30, cc);
    expect(count).toBe(5);
    expect(warnings.some((w) => w.code === 'DOOR_WEIGHT')).toBe(true);
  });
});

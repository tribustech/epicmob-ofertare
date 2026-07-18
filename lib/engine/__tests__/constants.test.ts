import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRUCTION } from '../constants';

describe('DEFAULT_CONSTRUCTION', () => {
  it('are valorile implicite din spec', () => {
    expect(DEFAULT_CONSTRUCTION.frontGapMm).toBe(2);
    expect(DEFAULT_CONSTRUCTION.outerGapMm).toBe(1);
    expect(DEFAULT_CONSTRUCTION.shelfSetbackMm).toBe(30);
    expect(DEFAULT_CONSTRUCTION.backRebateMm).toBe(4);
    expect(DEFAULT_CONSTRUCTION.slideNominalsMm).toContain(450);
    // PAL 18mm ≈ 12.5 kg/m² → 0.695 kg/m² per mm grosime
    expect(DEFAULT_CONSTRUCTION.boardDensityKgPerSqmPerMm * 18).toBeCloseTo(12.5, 0);
  });
});

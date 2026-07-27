import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import { deriveSubBlatDims } from '@/lib/quote/sub-blat';

describe('deriveSubBlatDims', () => {
  const params = { baseHeightMm: 900, blatDepthMm: 600, blatThicknessMm: 30 };

  it('derivă înălțimea = bază − picioare − grosime blat', () => {
    const { heightMm } = deriveSubBlatDims(params, 100, DEFAULT_CONSTRUCTION);
    expect(heightMm).toBe(770); // 900 − 100 − 30
  });

  it('derivă adâncimea EXTERIOARĂ = adâncime blat − 25 − 20 (spatele îl scade motorul separat)', () => {
    const { depthMm } = deriveSubBlatDims(params, 100, DEFAULT_CONSTRUCTION);
    expect(depthMm).toBe(555); // 600 − 25 − 20; laterala ajunge 550 după falțul PFL în motor
  });

  it('picioare de 150 scad mai mult din înălțime', () => {
    const { heightMm } = deriveSubBlatDims(params, 150, DEFAULT_CONSTRUCTION);
    expect(heightMm).toBe(720); // 900 − 150 − 30
  });

  it('grosimea blatului contează (blat gros de 38mm)', () => {
    const { heightMm } = deriveSubBlatDims({ ...params, blatThicknessMm: 38 }, 100, DEFAULT_CONSTRUCTION);
    expect(heightMm).toBe(762); // 900 − 100 − 38
  });

  it('scăderile de adâncime sunt configurabile', () => {
    const cc = { ...DEFAULT_CONSTRUCTION, subBlatClearanceMm: 30, subBlatDoorMm: 18 };
    const { depthMm } = deriveSubBlatDims(params, 100, cc);
    expect(depthMm).toBe(552); // 600 − 48
  });
});

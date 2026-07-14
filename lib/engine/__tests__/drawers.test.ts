import { describe, expect, it } from 'vitest';
import { expandDrawerBoxes, pickSlideNominal } from '../drawers';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { CabinetInput, DrawerSystem } from '../types';

const cc = DEFAULT_CONSTRUCTION;

function sertareInput(system: DrawerSystem): CabinetInput {
  return bazaInput({
    label: 'S1', type: 'BAZA', doors: 0,
    drawers: { count: 3, system, bottomMaterialId: 'pfl-alb' },
    frontMaterialId: 'pal-alb',
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
  });
}

describe('pickSlideNominal', () => {
  it('adâncime 560 → glisieră 500 (cea mai mare ≤ 530)', () => {
    expect(pickSlideNominal(560, cc)).toMatchObject({ nominalMm: 500, warnings: [] });
  });
  it('adâncime 500 → 450', () => {
    expect(pickSlideNominal(500, cc).nominalMm).toBe(450);
  });
  it('adâncime prea mică → cea mai mică nominală + avertizare', () => {
    const r = pickSlideNominal(290, cc);
    expect(r.nominalMm).toBe(270);
    expect(r.warnings.some((w) => w.code === 'SLIDE_DEPTH')).toBe(true);
  });
});

describe('expandDrawerBoxes — PAL_BOX', () => {
  it('cutie PAL: laterale, față/spate, fund PFL', () => {
    const { parts } = expandDrawerBoxes(sertareInput('PAL_BOX'), TEST_CATALOGS, cc);
    // per sertar; front ≈ 236.67 → boxH = 236.67 − 60 = 176.67; boxW = 600 − 36 − 26 = 538
    const sides = parts.find((p) => p.name === 'Laterală sertar')!;
    expect(sides.lengthMm).toBe(500);           // = nominală glisieră
    expect(sides.widthMm).toBeCloseTo(176.67, 1);
    expect(sides.qty).toBe(6);                  // 2 × 3 sertare

    const fb = parts.find((p) => p.name === 'Față/Spate cutie sertar')!;
    expect(fb.lengthMm).toBeCloseTo(502, 5);    // 538 − 2×18
    expect(fb.qty).toBe(6);

    const bottom = parts.find((p) => p.name === 'Fund sertar')!;
    expect(bottom).toMatchObject({ lengthMm: 500, widthMm: 538, qty: 3, materialId: 'pfl-alb' });
  });

  it('înălțimea cutiei nu scade sub minim', () => {
    const input = sertareInput('PAL_BOX');
    input.drawers!.frontHeightsMm = [100, 308, 308];
    const { parts } = expandDrawerBoxes(input, TEST_CATALOGS, cc);
    const heights = parts.filter((p) => p.name === 'Laterală sertar').map((p) => p.widthMm);
    expect(Math.min(...heights)).toBe(cc.palBoxMinHeightMm); // 80, nu 40
  });
});

describe('expandDrawerBoxes — METAL_BOX', () => {
  it('doar fund + spate din placă (lateralele sunt metalice)', () => {
    const { parts } = expandDrawerBoxes(sertareInput('METAL_BOX'), TEST_CATALOGS, cc);
    expect(parts.find((p) => p.name === 'Fund sertar')).toMatchObject({
      lengthMm: 500, widthMm: 477, qty: 3, materialId: 'pfl-alb', // 600−36−87 = 477
    });
    expect(parts.find((p) => p.name === 'Spate sertar')).toMatchObject({
      lengthMm: 477, widthMm: 70, qty: 3, materialId: 'pal-alb',
    });
    expect(parts.some((p) => p.name === 'Laterală sertar')).toBe(false);
  });

  it('corp foarte îngust → eroare dimensiune imposibilă pentru fundul sertarului', () => {
    const input = sertareInput('METAL_BOX');
    input.widthMm = 120;
    expect(() => expandDrawerBoxes(input, TEST_CATALOGS, cc)).toThrow(/imposibilă/i);
  });
});

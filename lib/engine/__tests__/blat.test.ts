import { describe, expect, it } from 'vitest';
import { computeBlat } from '../blat';
import type { BoardMaterial } from '../types';

const blatSheet: BoardMaterial = {
  id: 'blat-600', name: 'Blat PAL 600', kind: 'PAL', thicknessMm: 28,
  sheetLengthMm: 4100, sheetWidthMm: 600,
  pricing: { mode: 'PER_SHEET', pricePerSheet: 350 },
};
const blatSqm: BoardMaterial = {
  id: 'blat-sqm', name: 'Blat la m²', kind: 'PAL', thicknessMm: 38,
  sheetLengthMm: 4100, sheetWidthMm: 900,
  pricing: { mode: 'PER_SQM', pricePerSqm: 200 },
};

describe('computeBlat', () => {
  it('o placă acoperă lungimea când adâncimea încape', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 3000, depthMm: 600, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.fitsOnDepth).toBe(true);
    expect(r.pieces).toBe(1);
    expect(r.boardCost).toBe(350);
    expect(r.cuttingCost).toBe(35);
    expect(r.warnings).toEqual([]);
  });

  it('lungime peste o placă → mai multe bucăți (ceil)', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 5000, depthMm: 600, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.pieces).toBe(2);
    expect(r.boardCost).toBe(700);
    expect(r.cuttingCost).toBe(70);
  });

  it('adâncime = fix lățimea plăcii încă încape', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 1000, depthMm: 600, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.fitsOnDepth).toBe(true);
    expect(r.pieces).toBe(1);
  });

  it('adâncime peste lățimea plăcii → warning + nr. manual de plăci', () => {
    const r = computeBlat({
      label: 'BL-insula', lengthMm: 2000, depthMm: 1000,
      material: blatSheet, manualPieces: 4, cutPricePerPiece: 35,
    });
    expect(r.fitsOnDepth).toBe(false);
    expect(r.pieces).toBe(4);
    expect(r.boardCost).toBe(4 * 350);
    expect(r.cuttingCost).toBe(4 * 35);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe('BLAT_DEPTH_OVER_SHEET');
    expect(r.warnings[0].cabinetLabel).toBe('BL-insula');
  });

  it('peste lățime fără nr. manual → 0 plăci (rămâne incomplet)', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 2000, depthMm: 1000, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.pieces).toBe(0);
    expect(r.warnings).toHaveLength(1);
  });

  it('material la m²: cost = aria folosită × preț/m² (fără plăcuțe, fără pierdere)', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 3000, depthMm: 600, material: blatSqm, cutPricePerPiece: 35 });
    expect(r.totalAreaSqm).toBeCloseTo(1.8, 5);
    expect(r.boardCost).toBeCloseTo(360, 5); // 1.8 × 200
    expect(r.sheets).toBeNull();
    expect(r.wastePct).toBeNull();
    expect(r.boughtAreaSqm).toBeCloseTo(1.8, 5);
  });

  it('PER_SHEET raportează sheets = pieces pentru necesar', () => {
    const r = computeBlat({ label: 'BL1', lengthMm: 5000, depthMm: 600, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.sheets).toBe(2);
  });

  it('pierdere = placa întreagă cumpărată minus aria folosită', () => {
    // 3000×600 pe placă 4100×600: cumpăr 1 placă = 2.46 m², folosesc 1.8 m² → 26.8% pierdere
    const r = computeBlat({ label: 'BL1', lengthMm: 3000, depthMm: 600, material: blatSheet, cutPricePerPiece: 35 });
    expect(r.boughtAreaSqm).toBeCloseTo(2.46, 5);
    expect(r.wastePct).toBeCloseTo((1 - 1.8 / 2.46) * 100, 4);
  });
});

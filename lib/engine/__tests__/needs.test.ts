import { describe, expect, it } from 'vitest';
import { computeMaterialNeeds } from '../needs';
import { expandCarcass } from '../carcass';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('computeMaterialNeeds', () => {
  const { parts } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

  it('calculează arii, foi și cant pentru carcasa de test', () => {
    const { boards, edging } = computeMaterialNeeds(parts, TEST_CATALOGS, 0.8);

    const pal = boards.find((b) => b.materialId === 'pal-alb')!;
    // 2×(0.72×0.56) + 2×(0.564×0.56) + 0.564×0.53 = 1.737 m²
    expect(pal.totalAreaSqm).toBeCloseTo(1.737, 3);
    // foaie 2800×2070 = 5.796 m²; 1.737 / (5.796×0.8) = 0.375 → 1 foaie
    expect(pal.sheets).toBe(1);

    const pfl = boards.find((b) => b.materialId === 'pfl-alb')!;
    expect(pfl.totalAreaSqm).toBeCloseTo(0.4267, 3);
    expect(pfl.sheets).toBe(1);

    // cant 0.4: laterale 2×0.72 + blat/fund 2×0.564 + poliță 0.564 = 3.132 ml
    const abs04 = edging.find((e) => e.edgeBandId === 'abs-04')!;
    expect(abs04.totalMl).toBeCloseTo(3.132, 3);
  });

  it('material PER_SQM → sheets null', () => {
    const doorParts = [{
      cabinetLabel: 'B1', name: 'Ușă', lengthMm: 716, widthMm: 596, qty: 1,
      materialId: 'mdf-vopsit', edges: {},
    }];
    const { boards } = computeMaterialNeeds(doorParts, TEST_CATALOGS, 0.8);
    expect(boards[0]).toMatchObject({ materialId: 'mdf-vopsit', sheets: null });
    expect(boards[0].totalAreaSqm).toBeCloseTo(0.4267, 3);
  });

  it('cantul de pe laturile scurte folosește widthMm', () => {
    const p = [{
      cabinetLabel: 'X', name: 'Test', lengthMm: 1000, widthMm: 500, qty: 2,
      materialId: 'pal-alb', edges: { l1: 'abs-1', w1: 'abs-1', w2: 'abs-1' },
    }];
    const { edging } = computeMaterialNeeds(p, TEST_CATALOGS, 0.8);
    // per buc: 1.0 (l1) + 0.5 + 0.5 (w1,w2) = 2.0 ml × 2 buc = 4 ml
    expect(edging.find((e) => e.edgeBandId === 'abs-1')!.totalMl).toBeCloseTo(4, 5);
  });
});

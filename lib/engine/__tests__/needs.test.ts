import { describe, expect, it } from 'vitest';
import { computeMaterialNeeds } from '../needs';
import { expandCarcass } from '../carcass';
import { toParts } from '../pieces';
import { DEFAULT_CONSTRUCTION } from '../constants';
import type { Part } from '../types';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('computeMaterialNeeds', () => {
  const parts = toParts(expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION).pieces);

  it('calculează arii, foi și cant pentru carcasa de test', () => {
    const { boards, edging } = computeMaterialNeeds(parts, TEST_CATALOGS, { kerfMm: 4, trimMm: 10 });

    const pal = boards.find((b) => b.materialId === 'pal-alb')!;
    // adâncimea lateralelor/blatului scade cu PFL 3 + șurub 2 (560→555):
    // 2×(0.72×0.555) + 2×(0.564×0.555) + 0.564×0.53 = 1.72416 m²
    expect(pal.totalAreaSqm).toBeCloseTo(1.72416, 3);
    // piesele unui corp bază de 600mm încap toate pe o singură foaie
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
    const { boards } = computeMaterialNeeds(doorParts, TEST_CATALOGS, { kerfMm: 4, trimMm: 10 });
    expect(boards[0]).toMatchObject({
      materialId: 'mdf-vopsit', sheets: null, wastePct: null, layout: null,
    });
    expect(boards[0].totalAreaSqm).toBeCloseTo(0.4267, 3);
  });

  it('cantul de pe laturile scurte folosește widthMm', () => {
    const p = [{
      cabinetLabel: 'X', name: 'Test', lengthMm: 1000, widthMm: 500, qty: 2,
      materialId: 'pal-alb', edges: { l1: 'abs-1', w1: 'abs-1', w2: 'abs-1' },
    }];
    const { edging } = computeMaterialNeeds(p, TEST_CATALOGS, { kerfMm: 4, trimMm: 10 });
    // per buc: 1.0 (l1) + 0.5 + 0.5 (w1,w2) = 2.0 ml × 2 buc = 4 ml
    expect(edging.find((e) => e.edgeBandId === 'abs-1')!.totalMl).toBeCloseTo(4, 5);
  });

  it('PER_SHEET: sheets/wastePct/layout vin din nesting', () => {
    // 4 piese 1380×560 pe PAL 2800×2070 (util 2780×2050, kerf 4):
    // raft 1: 1380 + 4 + 1380 = 2764 ≤ 2780 → 2 piese; raft 2 la y = 10+560+4: încă 2 → 1 placă
    const parts: Part[] = Array.from({ length: 4 }, (_, i) => ({
      cabinetLabel: 'B1', name: `Piesă ${i + 1}`, lengthMm: 1380, widthMm: 560, qty: 1,
      materialId: 'pal-alb', edges: {},
    }));
    const { boards } = computeMaterialNeeds(parts, TEST_CATALOGS, { kerfMm: 4, trimMm: 10 });
    const pal = boards.find((b) => b.materialId === 'pal-alb')!;
    expect(pal.sheets).toBe(1);
    expect(pal.layout).toHaveLength(1);
    expect(pal.layout![0].pieces).toHaveLength(4);
    expect(pal.layout![0].pieces[0].label).toBe('B1 · Piesă 1');
    expect(pal.wastePct).toBeGreaterThan(0);
  });
});

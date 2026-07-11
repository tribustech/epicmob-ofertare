import { describe, expect, it } from 'vitest';
import { computeProject, type ProjectCatalogs } from '../index';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const CATALOGS: ProjectCatalogs = {
  ...TEST_CATALOGS,
  hardware: [
    { id: 'blum-cliptop', name: 'Balama Blum ClipTop', category: 'BALAMA', pricePerUnit: 15 },
    { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10 },
    { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2 },
  ],
  cuttingRates: [
    { maxThicknessMm: 10, pricePerSheet: 33 },
    { maxThicknessMm: 32, pricePerSheet: 50 },
  ],
  laborPerType: { BAZA: 150, SUSPENDAT: 130, INALT: 200, SERTARE: 220, COLT: 180 },
  hardwareDefaults: {
    hingeId: 'blum-cliptop',
    slideIdsByNominal: {},
    handleId: 'maner-std',
    legId: 'picior-std',
    railId: null,
  },
};

describe('computeProject — corp bază de referință (calcul de mână)', () => {
  const result = computeProject(
    { cabinets: [bazaInput()], freeLines: [], markupPct: 30, yieldFactor: 0.8 },
    CATALOGS,
  );

  it('piese: carcasă + spate + ușă', () => {
    expect(result.parts).toHaveLength(5); // Laterală, Blat/Fund, Poliță, Spate, Ușă
  });

  it('feronerie rezolvată automat: 2 balamale, 1 mâner, 4 picioare', () => {
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'maner-std', qty: 1 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'picior-std', qty: 4 });
    expect(result.unresolvedHardware).toEqual([]);
  });

  it('necesar: 1 foaie PAL, 1 foaie PFL', () => {
    const pal = result.costs.needs.boards.find((b) => b.materialId === 'pal-alb')!;
    const pfl = result.costs.needs.boards.find((b) => b.materialId === 'pfl-alb')!;
    expect(pal.sheets).toBe(1);
    expect(pfl.sheets).toBe(1);
  });

  it('costuri identice cu calculul de mână', () => {
    expect(result.costs.totalCost).toBeCloseTo(836.16, 1);
    expect(result.costs.sellPrice).toBeCloseTo(1087.01, 1);
    expect(result.costs.leiPerMl).toBeCloseTo(1811.69, 0);
  });

  it('fără avertismente pe corpul de referință', () => {
    expect(result.warnings).toEqual([]);
  });
});

describe('computeProject — feronerie fără default merge în unresolved', () => {
  it('corp suspendat fără railId → sugestia de șină rămâne nerezolvată', () => {
    const result = computeProject(
      {
        cabinets: [bazaInput({ type: 'SUSPENDAT', depthMm: 320 })],
        freeLines: [], markupPct: 30, yieldFactor: 0.8,
      },
      CATALOGS,
    );
    expect(result.unresolvedHardware.some((s) => s.category === 'SINA_SUSPENDARE')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { computeProject, type ProjectCatalogs } from '../index';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const CATALOGS: ProjectCatalogs = {
  ...TEST_CATALOGS,
  hardware: [
    { id: 'blum-cliptop', name: 'Balama Blum ClipTop', category: 'BALAMA', pricePerUnit: 15 },
    { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10 },
    { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2 },
    { id: 'suport-std', name: 'Suport poliță', category: 'SUPORT_POLITA', pricePerUnit: 0 },
    { id: 'clema-std', name: 'Clemă soclu', category: 'CLEMA_SOCLU', pricePerUnit: 0 },
    { id: 'holtsurub-std', name: 'Holtșurub', category: 'HOLTSURUB', pricePerUnit: 0 },
  ],
  cuttingRates: [
    { maxThicknessMm: 10, pricePerSheet: 33 },
    { maxThicknessMm: 32, pricePerSheet: 50 },
  ],
  hardwareDefaults: {
    hingeId: 'blum-cliptop',
    slideIdsByNominal: {},
    shelfSupportId: 'suport-std',
    plinthClipId: 'clema-std',
    aventosId: null,
    legId: 'picior-std',
    railId: null,
    holtsurubId: 'holtsurub-std',
  },
  frontSuppliers: [],
  frontModels: [],
  frontPrices: [],
  eurToRon: 1,
};

describe('computeProject — corp bază de referință (calcul de mână)', () => {
  const result = computeProject(
    // produsul mânerului e ales explicit — nu mai există fallback pe un default global
    { cabinets: [bazaInput({ handle: { type: 'APLICAT', itemId: 'maner-std' } })], freeLines: [], laborPct: 30, nesting: { kerfMm: 4, trimMm: 10 } },
    CATALOGS,
  );

  it('piese: carcasă + spate + ușă', () => {
    // Blat corp și Fund corp sunt acum bucăți individuale (nu se mai grupează pe qty 2)
    expect(result.parts).toHaveLength(6); // Laterală, Blat corp, Fund corp, Poliță, Spate, Ușă
  });

  it('feronerie rezolvată automat: 2 balamale, 1 mâner, 4 picioare, holtșurub', () => {
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'maner-std', qty: 1 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'picior-std', qty: 4 });
    // spate PFL în falț 600×720 → perimetru 2×(716+596)=2624mm → 27 holtșuruburi (1/10cm)
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'holtsurub-std', qty: 27 });
    expect(result.unresolvedHardware).toEqual([]);
  });

  it('necesar: 1 foaie PAL, 1 foaie PFL', () => {
    const pal = result.costs.needs.boards.find((b) => b.materialId === 'pal-alb')!;
    const pfl = result.costs.needs.boards.find((b) => b.materialId === 'pfl-alb')!;
    expect(pal.sheets).toBe(1);
    expect(pfl.sheets).toBe(1);
  });

  it('costuri identice cu calculul de mână', () => {
    // bază materiale = 552.03 + 3.13 + 83 + 48 = 686.16 (fără manoperă); vezi costing.test.ts
    expect(result.costs.totalCost).toBeCloseTo(686.16, 1);
    expect(result.costs.sellPrice).toBeCloseTo(892.01, 1);
    expect(result.costs.leiPerMl).toBeCloseTo(1486.69, 0);
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
        freeLines: [], laborPct: 30, nesting: { kerfMm: 4, trimMm: 10 },
      },
      CATALOGS,
    );
    expect(result.unresolvedHardware.some((s) => s.category === 'SINA_SUSPENDARE')).toBe(true);
  });
});

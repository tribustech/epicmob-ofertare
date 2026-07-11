import { describe, expect, it } from 'vitest';
import { computeCosts, type CostCatalogs } from '../costing';
import { expandCabinet } from '../templates';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const COST_CATALOGS: CostCatalogs = {
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
};

describe('computeCosts — corp bază de referință', () => {
  // Corp B1: 600×720×560, 1 poliță, 1 ușă MDF vopsit, spate PFL în falț.
  // Calcul de mână (vezi spec): plăci 552.03, cant 3.13, debitare 83,
  // feronerie 48 (2 balamale×15 + 1 mâner×10 + 4 picioare×2), manoperă 150.
  const expanded = expandCabinet(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

  const result = computeCosts({
    parts: expanded.parts,
    hardwareLines: [
      { hardwareId: 'blum-cliptop', qty: 2 },
      { hardwareId: 'maner-std', qty: 1 },
      { hardwareId: 'picior-std', qty: 4 },
    ],
    cabinets: [expanded.input],
    freeLines: [],
    markupPct: 30,
    yieldFactor: 0.8,
    catalogs: COST_CATALOGS,
  });

  it('categoriile de cost', () => {
    expect(result.breakdown.boards).toBeCloseTo(552.03, 1);        // 260 + 100 + 0.4267×450
    expect(result.breakdown.edging).toBeCloseTo(3.13, 1);          // 3.132 ml × 1
    expect(result.breakdown.cuttingService).toBeCloseTo(83, 5);    // PAL 50 + PFL 33
    expect(result.breakdown.hardware).toBeCloseTo(48, 5);
    expect(result.breakdown.labor).toBeCloseTo(150, 5);
    expect(result.breakdown.freeLines).toBe(0);
  });

  it('total, adaos și lei/ml', () => {
    expect(result.totalCost).toBeCloseTo(836.16, 1);
    expect(result.sellPrice).toBeCloseTo(1087.01, 1);              // ×1.3
    expect(result.leiPerMl).toBeCloseTo(1811.69, 0);               // / 0.6 m
  });
});

describe('computeCosts — cazuri particulare', () => {
  it('linii libere intră în total', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], yieldFactor: 0.8, markupPct: 0,
      freeLines: [{ name: 'Blat', amount: 800 }, { name: 'Transport', amount: 200 }],
      catalogs: COST_CATALOGS,
    });
    expect(r.breakdown.freeLines).toBe(1000);
    expect(r.totalCost).toBe(1000);
    expect(r.sellPrice).toBe(1000);
    expect(r.leiPerMl).toBeNull();
  });

  it('feronerie inexistentă în catalog → eroare', () => {
    expect(() =>
      computeCosts({
        parts: [], hardwareLines: [{ hardwareId: 'nu-exista', qty: 1 }],
        cabinets: [], freeLines: [], markupPct: 0, yieldFactor: 0.8,
        catalogs: COST_CATALOGS,
      }),
    ).toThrow(/feronerie/i);
  });

  it('cuttingRates date descrescător produc același cost de debitare ca sortate crescător', () => {
    const expanded = expandCabinet(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const REVERSED_CATALOGS: CostCatalogs = {
      ...COST_CATALOGS,
      cuttingRates: [...COST_CATALOGS.cuttingRates].reverse(),
    };

    const argsFor = (catalogs: CostCatalogs) => ({
      parts: expanded.parts,
      hardwareLines: [
        { hardwareId: 'blum-cliptop', qty: 2 },
        { hardwareId: 'maner-std', qty: 1 },
        { hardwareId: 'picior-std', qty: 4 },
      ],
      cabinets: [expanded.input],
      freeLines: [],
      markupPct: 30,
      yieldFactor: 0.8,
      catalogs,
    });

    const sorted = computeCosts(argsFor(COST_CATALOGS));
    const reversed = computeCosts(argsFor(REVERSED_CATALOGS));
    expect(reversed.breakdown.cuttingService).toBeCloseTo(sorted.breakdown.cuttingService, 5);
  });
});

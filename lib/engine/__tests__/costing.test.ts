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
  frontSuppliers: [],
  frontModels: [],
  frontPrices: [],
  eurToRon: 1,
};

describe('computeCosts — corp bază de referință', () => {
  // Corp B1: 600×720×560, 1 poliță, 1 ușă MDF vopsit, spate PFL în falț.
  // Calcul de mână (vezi spec): plăci 552.03, cant 3.13, debitare 83,
  // feronerie 48 (2 balamale×15 + 1 mâner×10 + 4 picioare×2).
  // bază materiale = 552.03 + 3.13 + 83 + 48 = 686.16; manoperă = bază × laborPct%.
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
    laborPct: 30,
    nesting: { kerfMm: 4, trimMm: 10 },
    catalogs: COST_CATALOGS,
  });

  it('categoriile de cost', () => {
    expect(result.breakdown.boards).toBeCloseTo(552.03, 1);        // 260 + 100 + 0.4267×450
    expect(result.breakdown.edging).toBeCloseTo(3.13, 1);          // 3.132 ml × 1
    expect(result.breakdown.cuttingService).toBeCloseTo(83, 5);    // PAL 50 + PFL 33
    expect(result.breakdown.hardware).toBeCloseTo(48, 5);
    expect(result.breakdown.labor).toBeCloseTo(205.85, 1);         // 686.16 × 30%
    expect(result.breakdown.freeLines).toBe(0);
  });

  it('total, adaos și lei/ml', () => {
    expect(result.totalCost).toBeCloseTo(686.16, 1);               // bază materiale, fără manoperă
    expect(result.sellPrice).toBeCloseTo(892.01, 1);                // bază × 1.3
    expect(result.leiPerMl).toBeCloseTo(1486.69, 0);                // / 0.6 m
  });
});

describe('computeCosts — cazuri particulare', () => {
  it('linii libere intră în total', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], nesting: { kerfMm: 4, trimMm: 10 }, laborPct: 0,
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
        cabinets: [], freeLines: [], laborPct: 0, nesting: { kerfMm: 4, trimMm: 10 },
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
      laborPct: 30,
      nesting: { kerfMm: 4, trimMm: 10 },
      catalogs,
    });

    const sorted = computeCosts(argsFor(COST_CATALOGS));
    const reversed = computeCosts(argsFor(REVERSED_CATALOGS));
    expect(reversed.breakdown.cuttingService).toBeCloseTo(sorted.breakdown.cuttingService, 5);
  });

  it('manoperă procentuală: labor = bază materiale × %, liniile libere fără procent', () => {
    const result = computeCosts({
      parts: [],
      hardwareLines: [{ hardwareId: 'maner-std', qty: 2 }], // maner-std: 10 lei/buc în catalogul de test
      cabinets: [],
      freeLines: [{ name: 'Transport', amount: 100 }],
      laborPct: 120,
      nesting: { kerfMm: 4, trimMm: 10 },
      catalogs: COST_CATALOGS,
    });
    // bază materiale = doar feroneria (20 lei), fără piese
    expect(result.breakdown.hardware).toBeCloseTo(20, 5);
    expect(result.breakdown.labor).toBeCloseTo(24, 5);        // 20 × 120%
    expect(result.breakdown.freeLines).toBeCloseTo(100, 5);
    expect(result.totalCost).toBeCloseTo(120, 5);             // 20 + 100 (fără manoperă)
    expect(result.sellPrice).toBeCloseTo(144, 5);              // 20 × 2.2 + 100
  });
});

describe('computeCosts — fronturi MDF vopsit cotate per m² (EUR × curs)', () => {
  // Catalog de fronturi vopsite: furnizor + model + preț/m² în EUR, curs EUR→RON = 5.
  const VOPSIT_CATALOGS: CostCatalogs = {
    ...COST_CATALOGS,
    frontSuppliers: [
      { id: 'paintmob', handleMillingEur: 3, vividSurchargeEur: 10, metallicSurchargeEur: 20, blackGlossEurPerFace: 7 },
    ],
    frontModels: [
      { id: 'model-mediu', tier: 'MEDIU', hasHandleMilling: false },
      { id: 'model-mediu-frez', tier: 'MEDIU', hasHandleMilling: true },
    ],
    frontPrices: [
      { supplierId: 'paintmob', tier: 'MEDIU', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 115 },
    ],
    eurToRon: 5,
  };

  const NEST = { kerfMm: 4, trimMm: 10 };

  // Corpul cu ușă MDF (bazaInput are frontMaterialId = 'mdf-vopsit') — geometria fronturilor
  // e identică indiferent de frontKind, deci calculăm o singură dată aria frontului.
  const plain = expandCabinet(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
  const frontArea = plain.parts
    .filter((p) => p.name === 'Ușă')
    .reduce((s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0);

  // Referință: fără ramura vopsit, frontul e cotat ca placă PER_SQM (mdf-vopsit = 450 lei/m²).
  const baseline = computeCosts({
    parts: plain.parts, hardwareLines: [], cabinets: [plain.input],
    freeLines: [], laborPct: 0, nesting: NEST, catalogs: VOPSIT_CATALOGS,
  });
  // Costul plăcilor DOAR pentru carcasă + spate (fără contribuția frontului ca placă).
  const carcassBoards = baseline.breakdown.boards - frontArea * 450;

  const vopsitInput = (mdf: Partial<NonNullable<typeof plain.input.mdfFront>> = {}) =>
    bazaInput({
      frontKind: 'MDF_VOPSIT',
      mdfFront: {
        supplierId: 'paintmob', modelId: 'model-mediu',
        finish: 'MAT', faces: 1, ralCode: 'RAL 9010', colorCategory: 'NORMALA',
        ...mdf,
      },
    });

  it('frontul vopsit e cotat per m² (EUR×curs) și NU mai intră ca placă/cant', () => {
    const exp = expandCabinet(vopsitInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const r = computeCosts({
      parts: exp.parts, hardwareLines: [], cabinets: [exp.input],
      freeLines: [], laborPct: 0, nesting: NEST, catalogs: VOPSIT_CATALOGS,
    });
    // boards = carcasă+spate (fără front ca placă) + front vopsit (aria × 115 EUR × 5)
    expect(r.breakdown.boards).toBeCloseTo(carcassBoards + frontArea * 115 * 5, 4);
    // frontul MDF vopsit nu are cant → edging neschimbat față de referință
    expect(r.breakdown.edging).toBeCloseTo(baseline.breakdown.edging, 6);
    expect(r.warnings ?? []).toHaveLength(0);
  });

  it('model cu frezare mâner: + handleMillingEur × frontCount × curs', () => {
    const exp = expandCabinet(vopsitInput({ modelId: 'model-mediu-frez' }), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const r = computeCosts({
      parts: exp.parts, hardwareLines: [], cabinets: [exp.input],
      freeLines: [], laborPct: 0, nesting: NEST, catalogs: VOPSIT_CATALOGS,
    });
    // 1 ușă → frontCount = 1; +3 EUR frezare × 5 curs față de modelul fără frezare
    expect(r.breakdown.boards).toBeCloseTo(carcassBoards + frontArea * 115 * 5 + 3 * 1 * 5, 4);
  });

  it('combinație de preț lipsă → fără excepție, contribuție 0 + avertizare „preț la cerere"', () => {
    // finish LUCIOS nu are rând de preț în catalog
    const exp = expandCabinet(vopsitInput({ finish: 'LUCIOS' }), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const r = computeCosts({
      parts: exp.parts, hardwareLines: [], cabinets: [exp.input],
      freeLines: [], laborPct: 0, nesting: NEST, catalogs: VOPSIT_CATALOGS,
    });
    // frontul scos din plăci, nimic adăugat (cost 0)
    expect(r.breakdown.boards).toBeCloseTo(carcassBoards, 4);
    expect(r.warnings ?? []).toEqual(
      expect.arrayContaining([expect.stringMatching(/preț la cerere/i)]),
    );
  });
});

describe('computeCosts — blaturi', () => {
  const NEST = { kerfMm: 4, trimMm: 10 };
  const blatResult = {
    materialId: 'blat-x', pieces: 2, fitsOnDepth: true,
    totalAreaSqm: 3.0, sheets: 2, boardCost: 700, cuttingCost: 70, warnings: [],
  };

  it('costul blatului intră la boards + cuttingService și în needs', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [],
      freeLines: [], laborPct: 0, nesting: NEST, catalogs: COST_CATALOGS,
      blats: [blatResult],
    });
    expect(r.breakdown.boards).toBe(700);
    expect(r.breakdown.cuttingService).toBe(70);
    expect(r.needs.boards).toEqual([
      expect.objectContaining({ materialId: 'blat-x', totalAreaSqm: 3.0, sheets: 2 }),
    ]);
  });

  it('blaturile nu contează la lei/ml (rezervat corpurilor de bază)', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [],
      freeLines: [], laborPct: 30, nesting: NEST, catalogs: COST_CATALOGS,
      blats: [blatResult],
    });
    expect(r.leiPerMl).toBeNull();
  });
});

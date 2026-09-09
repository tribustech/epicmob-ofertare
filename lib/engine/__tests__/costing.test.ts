import { describe, expect, it } from 'vitest';
import { computeCosts, CARCASS_VOPSIT_PART_NAMES, type CostCatalogs } from '../costing';
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
  // Calcul de mână (vezi spec): plăci 553.21, cant 5.35 (laterale pe 3 laturi), debitare 83,
  // feronerie 48 (2 balamale×15 + 1 mâner×10 + 4 picioare×2).
  // bază materiale = 553.21 + 5.35 + 83 + 48 = 689.57; manoperă = bază × laborPct%.
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
    expect(result.breakdown.boards).toBeCloseTo(553.21, 1);        // 260 + 100 + 0.4294×450
    expect(result.breakdown.edging).toBeCloseTo(5.35, 1);          // 5.352 ml × 1 (laterale pe 3 laturi)
    expect(result.breakdown.cuttingService).toBeCloseTo(83, 5);    // PAL 50 + PFL 33
    expect(result.breakdown.hardware).toBeCloseTo(48, 5);
    expect(result.breakdown.labor).toBeCloseTo(206.87, 1);         // 689.57 × 30%
    expect(result.breakdown.freeLines).toBe(0);
  });

  it('total și adaos', () => {
    expect(result.totalCost).toBeCloseTo(689.57, 1);               // bază materiale, fără manoperă
    expect(result.sellPrice).toBeCloseTo(896.44, 1);                // bază × 1.3
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
  });

  it('linia liberă „în comision" intră în baza de manoperă; cea normală doar în plus', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], nesting: { kerfMm: 4, trimMm: 10 }, laborPct: 50,
      freeLines: [
        { name: 'Manoperă montaj', amount: 1000, inCommission: true },
        { name: 'Transport', amount: 200 }, // fără adaos
      ],
      catalogs: COST_CATALOGS,
    });
    // fără piese: materialBase = 0; manoperă = (0 + 1000) × 50% = 500 (doar linia comisionată)
    expect(r.breakdown.labor).toBe(500);
    expect(r.breakdown.freeLines).toBe(1200);
    expect(r.totalCost).toBe(1200);            // costul include ambele linii
    expect(r.sellPrice).toBe(1700);            // 1200 + 500 adaos
  });

  it('debitarea pe rotund (extraCutting) intră la debitare și în total', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], nesting: { kerfMm: 4, trimMm: 10 }, laborPct: 0,
      freeLines: [], catalogs: COST_CATALOGS, extraCutting: 60,
    });
    expect(r.breakdown.cuttingService).toBe(60);
    expect(r.sellPrice).toBe(60);
  });

  it('cantul suplimentar (extraEdging, ex. blat) intră la cant și în necesar', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], nesting: { kerfMm: 4, trimMm: 10 }, laborPct: 0,
      freeLines: [], catalogs: COST_CATALOGS, extraEdging: [{ edgeBandId: 'abs-1', totalMl: 3 }],
    });
    expect(r.breakdown.edging).toBe(6); // 3 ml × 2 lei/ml
    expect(r.needs.edging).toContainEqual({ edgeBandId: 'abs-1', totalMl: 3 });
  });

  it('cantul forfetar (extraEdgingFlat, ex. cant pe rotund) intră la cant', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], nesting: { kerfMm: 4, trimMm: 10 }, laborPct: 0,
      freeLines: [], catalogs: COST_CATALOGS, extraEdgingFlat: 40,
    });
    expect(r.breakdown.edging).toBe(40);
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

  it('carcasă MDF vopsit: piesele de carcasă cotate per m² (EUR×curs), scoase din plăci', () => {
    const cfg = { supplierId: 'paintmob', modelId: 'model-mediu', finish: 'MAT' as const, faces: 1, ralCode: 'RAL 9010', colorCategory: 'NORMALA' as const };
    const exp = expandCabinet(bazaInput({ carcassMaterialId: 'mdf-vopsit', frontMaterialId: 'pal-alb' }), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const carcassArea = exp.parts
      .filter((p) => CARCASS_VOPSIT_PART_NAMES.has(p.name) && p.materialId === 'mdf-vopsit')
      .reduce((s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0);
    const common = { parts: exp.parts, hardwareLines: [], freeLines: [], laborPct: 0, nesting: NEST, catalogs: VOPSIT_CATALOGS };
    const ref = computeCosts({ ...common, cabinets: [exp.input] });                       // fără mdfCarcass → placă la 450
    const vop = computeCosts({ ...common, cabinets: [{ ...exp.input, mdfCarcass: cfg }] }); // cu vopsit → per m² EUR
    expect(carcassArea).toBeGreaterThan(0);
    expect(ref.needs.boards.some((b) => b.materialId === 'mdf-vopsit')).toBe(true);
    expect(vop.needs.boards.some((b) => b.materialId === 'mdf-vopsit')).toBe(false);
    expect(vop.breakdown.boards - ref.breakdown.boards).toBeCloseTo(carcassArea * (115 * 5 - 450), 3);
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
    totalAreaSqm: 3.0, boughtAreaSqm: 12.0, wastePct: 75, sheets: 2,
    boardCost: 700, cuttingCost: 70, warnings: [],
  };

  it('costul blatului intră la boards + cuttingService și în needs (cu pierdere)', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [],
      freeLines: [], laborPct: 0, nesting: NEST, catalogs: COST_CATALOGS,
      blats: [blatResult],
    });
    expect(r.breakdown.boards).toBe(700);
    expect(r.breakdown.cuttingService).toBe(70);
    // folosit 3 m² din 12 m² cumpărați → 75% pierdere
    expect(r.needs.boards).toEqual([
      expect.objectContaining({ materialId: 'blat-x', totalAreaSqm: 3.0, sheets: 2, wastePct: 75 }),
    ]);
  });
});

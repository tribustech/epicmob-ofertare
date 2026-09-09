import { describe, expect, it } from 'vitest';
import { parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import { expandCabinet, FRONT_PART_NAMES, type CabinetInput } from '@/lib/engine';
import { estimateCabinetCost } from '../estimate';
import { frontCatalogsFromSnapshot, type SnapshotData } from '../compute';
import { makeSnapshot, refCabinet } from './fixtures';

describe('estimateCabinetCost', () => {
  it('corpul de referință: estimare fără rotunjire la foi, cu adaos de manoperă procentual și feronerie auto', () => {
    const r = estimateCabinetCost(
      { input: refCabinet(), hardwareAdjustments: null, extraParts: [] },
      makeSnapshot(), { laborPct: 30, yieldFactor: 0.8, legHeightMm: null, projectHandle: { type: 'APLICAT', itemId: null } },
    );
    // adâncimea PAL scade cu PFL 3 + șurub 2 (560→555) → arie PAL 1.72416
    // plăci fracționar: PAL 1.72416/(5.796×0.8)=0.3718 foi ×260=96.68 + debitare 0.3718×50=18.59
    // PFL 0.4267/(5.8995×0.8)=0.0904 foi ×100=9.04 + 0.0904×33=2.98
    // MDF 0.4294×450=193.21; cant 5.35 (laterale pe 3 laturi); feronerie 48 (holtșurub 0 lei) → cost=373.86; sell=cost×1.3=486.02
    expect(r.cost).toBeCloseTo(373.86, 0);
    expect(r.sell).toBeCloseTo(486.02, 0);
    expect(r.error).toBeNull();
  });
  it('dimensiuni imposibile → error, nu throw', () => {
    const bad = refCabinet(); bad.widthMm = 10;
    const r = estimateCabinetCost(
      { input: bad, hardwareAdjustments: null, extraParts: [] },
      makeSnapshot(), { laborPct: 30, yieldFactor: 0.8, legHeightMm: null, projectHandle: { type: 'APLICAT', itemId: null } },
    );
    expect(r.error).toBeTruthy();
    expect(r.cost).toBe(0);
  });
});

// Paritate cu costing.test.ts: frontul MDF vopsit e cotat per m² în EUR × curs și e scos din
// aria de placă (nu contribuie prețul PER_SQM al materialului de geometrie mdf-vopsit = 450/m²).
describe('estimateCabinetCost — fronturi MDF vopsit cotate per m² (EUR × curs)', () => {
  // Catalog de fronturi vopsite peste snapshot-ul de referință; curs EUR→RON = 5 (deja în fixture).
  const snap: SnapshotData = makeSnapshot({
    frontSuppliers: [
      { id: 'paintmob', handleMillingEur: 7, vividSurchargeEur: 13, metallicSurchargeEur: 36, blackGlossEurPerFace: 6 },
    ],
    frontModels: [
      { id: 'model-mediu', tier: 'MEDIU', hasHandleMilling: false },
    ],
    frontPrices: [
      { supplierId: 'paintmob', tier: 'MEDIU', finish: 'MAT', faces: 1, thicknessMm: 18, pricePerSqmEur: 115 },
    ],
    settings: { ...makeSnapshot().settings, eurToRon: 5 },
  });

  const OPTS = { laborPct: 30, yieldFactor: 0.8, legHeightMm: null, projectHandle: { type: 'APLICAT' as const, itemId: null } };

  // Aria frontului derivată EXACT din aceeași geometrie ca motorul (refCabinet are 1 ușă).
  const catalogs = toCostCatalogs(snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, frontCatalogsFromSnapshot(snap));
  const cc = parseConstruction(snap.settings.constructionJson);
  const frontArea = expandCabinet(refCabinet(), catalogs, cc).parts
    .filter((p) => FRONT_PART_NAMES.has(p.name))
    .reduce((s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0);

  const vopsitInput = (mdf: Partial<NonNullable<CabinetInput['mdfFront']>> = {}): CabinetInput => ({
    ...refCabinet(),
    frontKind: 'MDF_VOPSIT',
    mdfFront: {
      supplierId: 'paintmob', modelId: 'model-mediu',
      finish: 'MAT', faces: 1, ralCode: 'RAL 9010', colorCategory: 'NORMALA',
      ...mdf,
    },
  });

  const estimate = (input: CabinetInput) =>
    estimateCabinetCost({ input, hardwareAdjustments: null, extraParts: [] }, snap, OPTS);

  // Referință „placă": refCabinet fără frontKind → frontul rămâne placă mdf-vopsit PER_SQM (450/m²).
  const board = estimate(refCabinet());
  const mat = estimate(vopsitInput());                       // preț MAT prezent → contribuție vopsit
  const lucios = estimate(vopsitInput({ finish: 'LUCIOS' })); // preț lipsă (doar MAT e în catalog)

  it('frontul geometric are arie > 0 (test ne-trivial)', () => {
    expect(frontArea).toBeGreaterThan(0);
    expect(board.error).toBeNull();
    expect(mat.error).toBeNull();
  });

  it('(a) frontul vopsit adaugă exact aria × 115 EUR × 5 curs', () => {
    // vs. corpul-placă identic: se scoate frontul din plăci (−aria×450) și se adaugă aria×115×5
    expect(mat.cost).toBeCloseTo(board.cost - frontArea * 450 + frontArea * 115 * 5, 4);
    // contribuția vopsit izolată (vs. varianta cu preț lipsă, care scoate frontul dar nu adaugă nimic)
    expect(mat.cost - lucios.cost).toBeCloseTo(frontArea * 115 * 5, 4);
  });

  it('(b) prețul PER_SQM (450/m²) al materialului de geometrie NU contribuie la frontul vopsit', () => {
    // frontul e exclus din plăci: costul cade EXACT cu aria×450 față de corpul-placă, fără alt adaos
    expect(lucios.cost).toBeCloseTo(board.cost - frontArea * 450, 4);
  });

  it('(c) combinație de preț lipsă (finish LUCIOS neseedat) → fără throw, contribuție vopsit 0', () => {
    expect(lucios.error).toBeNull();
    // nimic adăugat pentru front: costul = corp-placă minus frontul scos din plăci
    expect(lucios.cost).toBeCloseTo(board.cost - frontArea * 450, 4);
  });
});

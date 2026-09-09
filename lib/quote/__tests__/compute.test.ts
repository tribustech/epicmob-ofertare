import { describe, expect, it } from 'vitest';
import { computeQuote, type QuoteInput } from '../compute';
import { makeSnapshot, refCabinet } from './fixtures';

function baseQuote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    laborPct: 30, freeLines: [],
    cabinets: [{ input: refCabinet(), hardwareAdjustments: null, extraParts: [] }],
    projectHandle: { type: 'APLICAT', itemId: null },
    ...overrides,
  };
}

// echivalentul override-ului total din v3: sloturile auto pe 0 + liniile ca extra
import type { HardwareAdjustments, HardwareLine } from '@/lib/engine';
import { HARDWARE_SLOTS } from '@/lib/quote/hardware-adjustments';
function zeroAllSlots(extra: HardwareLine[]): HardwareAdjustments {
  return { slots: Object.fromEntries(HARDWARE_SLOTS.map((s) => [s, { qty: 0 }])), extra };
}

describe('computeQuote — corpul de referință (aceleași cifre ca motorul)', () => {
  const r = computeQuote(baseQuote(), makeSnapshot());

  it('totaluri identice cu calculul de mână', () => {
    expect(r.costs.totalCost).toBeCloseTo(689.57, 1);
    expect(r.costs.sellPrice).toBeCloseTo(896.44, 1);
  });

  it('feronerie auto: 2 balamale, 1 mâner, 4 picioare, holtșurub; cutList per material', () => {
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    // spate PFL în falț → holtșurub auto (1/10cm pe perimetru)
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'holtsurub-std', qty: 27 });
    expect(r.unresolvedHardware).toEqual([]);
    expect(r.cutList.map((f) => f.materialId).sort()).toEqual(['mdf-vopsit', 'pal-alb', 'pfl-alb']);
  });
});

describe('computeQuote — override-uri și piese suplimentare', () => {
  it('include plinta ansamblului în piese, necesar și debitare', () => {
    const q = baseQuote();
    q.assemblies = [{ id: 'a1', name: 'Bucătărie', plinthMode: 'ASSEMBLY' }];
    q.cabinets[0] = {
      ...q.cabinets[0],
      id: 'c1',
      assemblyId: 'a1',
      plinthEnabled: false,
    };

    const r = computeQuote(q, makeSnapshot());

    expect(r.parts).toContainEqual(expect.objectContaining({
      name: 'Plintă ansamblu', lengthMm: 600, widthMm: 100, materialId: 'pal-alb',
    }));
    expect(r.cutList.find((file) => file.materialId === 'pal-alb')?.csv).toContain('Plintă ansamblu');
  });

  it('plăcile libere de proiect intră ca piese și în debitare', () => {
    const q = baseQuote({
      loosePanels: [{ name: 'Panou hol', materialId: 'pal-alb', lengthMm: 1000, widthMm: 300, qty: 2 }],
    });
    const r = computeQuote(q, makeSnapshot());
    expect(r.parts).toContainEqual(expect.objectContaining({
      name: 'Panou hol', lengthMm: 1000, widthMm: 300, qty: 2, materialId: 'pal-alb',
    }));
    expect(r.cutList.find((file) => file.materialId === 'pal-alb')?.csv).toContain('Panou hol');
  });

  it('blaturile din același material se așază împreună pe plăci partajate (nu una fiecare)', () => {
    const blat = (label: string): QuoteInput['cabinets'][number] => ({
      input: {
        label, type: 'BLAT', widthMm: 1000, heightMm: 38, depthMm: 300,
        shelves: 0, doors: 0, carcassMaterialId: '', frontMaterialId: null,
        back: { enabled: false, mount: 'FALT' },
        edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null },
        blat: { materialId: 'pal-alb', cantMode: 'NONE' },
      },
      hardwareAdjustments: null, extraParts: [],
    });
    const q = baseQuote({ cabinets: [blat('B1'), blat('B2'), blat('B3')] });
    const r = computeQuote(q, makeSnapshot());
    const need = r.costs.needs.boards.find((b) => b.materialId === 'pal-alb');
    expect(need?.sheets).toBe(1); // 3 blaturi mici încap pe o singură placă, nu 3
  });

  it('placa liberă cu cant jur-împrejur pune banda pe toate 4 laturile', () => {
    const q = baseQuote({
      loosePanels: [{ name: 'Panou cant', materialId: 'pal-alb', lengthMm: 1000, widthMm: 300, qty: 1, edgeBandId: 'abs-04', edgeMode: 'ALL' }],
    });
    const r = computeQuote(q, makeSnapshot());
    expect(r.parts).toContainEqual(expect.objectContaining({
      name: 'Panou cant', edges: { l1: 'abs-04', l2: 'abs-04', w1: 'abs-04', w2: 'abs-04' },
    }));
  });

  it('cotează sticla cu ramă la m² și o separă de debitarea PAL', () => {
    const snapshot = makeSnapshot();
    snapshot.materials.push({
      id: 'sticla-rama-standard', name: 'Sticlă cu ramă', kind: 'STICLA_RAMA',
      thicknessMm: 20, sheetLengthMm: 3000, sheetWidthMm: 2000,
      pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 400, active: true,
    });
    const q = baseQuote();
    q.cabinets[0].input = {
      ...q.cabinets[0].input,
      frontKind: 'STICLA_RAMA',
      frontMaterialId: 'sticla-rama-standard',
      edgeBands: { ...q.cabinets[0].input.edgeBands, frontPerimeterId: null },
    };
    const withoutFront = baseQuote();
    withoutFront.cabinets[0].input = {
      ...withoutFront.cabinets[0].input,
      doors: 0,
      frontMaterialId: null,
    };

    const result = computeQuote(q, snapshot);
    const baseline = computeQuote(withoutFront, snapshot);

    expect(result.costs.breakdown.boards - baseline.costs.breakdown.boards).toBeCloseTo(0.718 * 0.598 * 400, 2);
    expect(result.cutList.some((file) => file.materialId === 'sticla-rama-standard')).toBe(false);
    expect(result.glassFrontList).toHaveLength(1);
    expect(result.glassFrontList[0].csv).toContain('B1;Ușă;718;598;1');
  });

  it('cotează polița de sticlă la 300 lei/m² și o exportă separat', () => {
    const snapshot = makeSnapshot();
    snapshot.materials.push({
      id: 'sticla-polita-standard', name: 'Sticlă poliță clară 8mm', kind: 'STICLA_POLITA',
      thicknessMm: 8, sheetLengthMm: 3000, sheetWidthMm: 2000,
      pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 300, active: true,
    });
    const q = baseQuote();
    q.cabinets[0].input = {
      ...q.cabinets[0].input,
      shelf: { materialId: 'sticla-polita-standard' },
    };

    const result = computeQuote(q, snapshot);

    const shelf = result.parts.find((part) => part.name === 'Poliță')!;
    expect(shelf.materialId).toBe('sticla-polita-standard');
    expect(shelf.edges).toEqual({});
    expect(result.cutList.some((file) => file.materialId === 'sticla-polita-standard')).toBe(false);
    expect(result.glassShelfList).toHaveLength(1);
    expect(result.glassShelfList[0].csv).toContain('B1;Poliță;564;530;1');
  });

  it('override-ul înlocuiește complet feroneria corpului', () => {
    const q = baseQuote();
    q.cabinets[0].hardwareAdjustments = zeroAllSlots([{ hardwareId: 'maner-std', qty: 10 }]);
    const r = computeQuote(q, makeSnapshot());
    expect(r.costs.breakdown.hardware).toBeCloseTo(100, 5);   // 10 × 10, nu 48
    expect(r.costs.totalCost).toBeCloseTo(741.57, 1);          // 689.57 − 48 + 100
    expect(r.unresolvedHardware).toEqual([]);                  // sugestiile corpului nu mai contează
  });

  it('piesa suplimentară intră în listă fără să schimbe foile (arie mică)', () => {
    const q = baseQuote();
    q.cabinets[0].extraParts = [{ name: 'Mască soclu', lengthMm: 500, widthMm: 500, qty: 1, materialId: 'pal-alb' }];
    const r = computeQuote(q, makeSnapshot());
    // Laterală, Blat corp, Fund corp, Poliță, Spate, Ușă + Mască soclu
    expect(r.parts).toHaveLength(7);
    expect(r.costs.totalCost).toBeCloseTo(689.57, 1);          // tot 1 foaie PAL
  });

  it('feronerie dezactivată dar referențiată de override → tot se calculează (nu aruncă)', () => {
    const snap = makeSnapshot();
    snap.hardware.find((h) => h.id === 'maner-std')!.active = false;
    const q = baseQuote();
    q.cabinets[0].hardwareAdjustments = zeroAllSlots([{ hardwareId: 'maner-std', qty: 2 }]);
    const r = computeQuote(q, snap);
    expect(r.costs.breakdown.hardware).toBeCloseTo(20, 5);
  });

  it('picioarele urmează înălțimea ansamblului', () => {
    const snap = makeSnapshot();
    snap.hardware.push({ id: 'p150', name: 'Picior 150', category: 'PICIOR', pricePerUnit: 3, nominalLengthMm: 150, loadClassKg: null, boxHeightMm: null, active: true });
    const q = baseQuote();
    q.cabinets[0].legHeightMm = 150;
    const r = computeQuote(q, snap);
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'p150', qty: 4 });
  });

  it('snapshot vechi fără kerf/trim → default-uri (4/10), nu crash', () => {
    const snap = makeSnapshot();
    delete (snap.settings as unknown as Record<string, unknown>).cutKerfMm;
    delete (snap.settings as unknown as Record<string, unknown>).cutTrimMm;
    const r = computeQuote(baseQuote(), snap);
    const pal = r.costs.needs.boards.find((b) => b.materialId === 'pal-alb')!;
    expect(pal.sheets).toBe(1);
    expect(pal.layout).not.toBeNull();
  });
});

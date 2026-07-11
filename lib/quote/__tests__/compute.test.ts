import { describe, expect, it } from 'vitest';
import { computeQuote, type QuoteInput } from '../compute';
import { makeSnapshot, refCabinet } from './fixtures';

function baseQuote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    markupPct: 30, yieldFactor: 0.8, freeLines: [],
    cabinets: [{ input: refCabinet(), hardwareOverrides: null, extraParts: [] }],
    ...overrides,
  };
}

describe('computeQuote — corpul de referință (aceleași cifre ca motorul)', () => {
  const r = computeQuote(baseQuote(), makeSnapshot());

  it('totaluri identice cu calculul de mână', () => {
    expect(r.costs.totalCost).toBeCloseTo(836.16, 1);
    expect(r.costs.sellPrice).toBeCloseTo(1087.01, 1);
    expect(r.costs.leiPerMl).toBeCloseTo(1811.69, 0);
  });

  it('feronerie auto: 2 balamale, 1 mâner, 4 picioare; cutList per material', () => {
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    expect(r.unresolvedHardware).toEqual([]);
    expect(r.cutList.map((f) => f.materialId).sort()).toEqual(['mdf-vopsit', 'pal-alb', 'pfl-alb']);
  });
});

describe('computeQuote — override-uri și piese suplimentare', () => {
  it('override-ul înlocuiește complet feroneria corpului', () => {
    const q = baseQuote();
    q.cabinets[0].hardwareOverrides = [{ hardwareId: 'maner-std', qty: 10 }];
    const r = computeQuote(q, makeSnapshot());
    expect(r.costs.breakdown.hardware).toBeCloseTo(100, 5);   // 10 × 10, nu 48
    expect(r.costs.totalCost).toBeCloseTo(888.16, 1);          // 836.16 − 48 + 100
    expect(r.unresolvedHardware).toEqual([]);                  // sugestiile corpului nu mai contează
  });

  it('piesa suplimentară intră în listă fără să schimbe foile (arie mică)', () => {
    const q = baseQuote();
    q.cabinets[0].extraParts = [{ name: 'Mască soclu', lengthMm: 500, widthMm: 500, qty: 1, materialId: 'pal-alb' }];
    const r = computeQuote(q, makeSnapshot());
    expect(r.parts).toHaveLength(6);
    expect(r.costs.totalCost).toBeCloseTo(836.16, 1);          // tot 1 foaie PAL
  });

  it('feronerie dezactivată dar referențiată de override → tot se calculează (nu aruncă)', () => {
    const snap = makeSnapshot();
    snap.hardware.find((h) => h.id === 'maner-std')!.active = false;
    const q = baseQuote();
    q.cabinets[0].hardwareOverrides = [{ hardwareId: 'maner-std', qty: 2 }];
    const r = computeQuote(q, snap);
    expect(r.costs.breakdown.hardware).toBeCloseTo(20, 5);
  });

  it('picioarele urmează înălțimea ansamblului', () => {
    const snap = makeSnapshot();
    snap.hardware.push({ id: 'p150', name: 'Picior 150', category: 'PICIOR', pricePerUnit: 3, nominalLengthMm: 150, loadClassKg: null, active: true });
    const q = baseQuote();
    q.cabinets[0].legHeightMm = 150;
    const r = computeQuote(q, snap);
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'p150', qty: 4 });
  });
});

import { describe, expect, it } from 'vitest';
import { compareEstimateToReal, type QuoteEstimate } from '../estimate';

const est: QuoteEstimate = { boards: 3000, edging: 200, cuttingService: 300, hardware: 900, freeLines: 400, totalCost: 4800, sellPrice: 9600, markup: 4800 };
const cats = [
  { id: 'placi', name: 'Plăci', quoteBucket: 'boards' },
  { id: 'cant', name: 'Cant', quoteBucket: 'edging' },
  { id: 'deb', name: 'Debitare', quoteBucket: 'cuttingService' },
  { id: 'fer', name: 'Feronerie', quoteBucket: 'hardware' },
  { id: 'transport', name: 'Transport', quoteBucket: 'freeLines' },
  { id: 'blat', name: 'Blat', quoteBucket: null },
  { id: 'refaceri', name: 'Refaceri', quoteBucket: null },
];

describe('compareEstimateToReal', () => {
  it('pune realul lângă estimat pe bucket și semnalează depășirea peste prag', () => {
    const real = new Map([['placi', 3500], ['fer', 850], ['blat', 600]]);
    const r = compareEstimateToReal(est, cats, real, 10);
    const placi = r.rows.find((x) => x.key === 'boards')!;
    expect(placi.estimated).toBe(3000); expect(placi.real).toBe(3500); expect(placi.diff).toBe(500); expect(placi.ratio).toBe(1.17); expect(placi.over).toBe(true);
    const fer = r.rows.find((x) => x.key === 'hardware')!;
    expect(fer.over).toBe(false);
    const blat = r.rows.find((x) => x.key === 'blat')!;
    expect(blat.estimated).toBeNull(); expect(blat.real).toBe(600);
    expect(r.rows.find((x) => x.key === 'refaceri')).toBeUndefined(); // fără real → nu apare
    expect(r.totalEstimated).toBe(4800); expect(r.totalReal).toBe(4950); expect(r.totalOver).toBe(false);
  });

  it('fără ofertă acceptată → estimatul e null, realul se vede', () => {
    const r = compareEstimateToReal(null, cats, new Map([['placi', 100]]), 10);
    expect(r.totalEstimated).toBeNull();
    expect(r.rows.find((x) => x.key === 'boards')!.estimated).toBeNull();
    expect(r.totalOver).toBe(false);
  });

  it('estimat 0 cu real > 0 e semnalat', () => {
    const r = compareEstimateToReal({ ...est, freeLines: 0 }, cats, new Map([['transport', 150]]), 10);
    expect(r.rows.find((x) => x.key === 'freeLines')!.over).toBe(true);
  });
});

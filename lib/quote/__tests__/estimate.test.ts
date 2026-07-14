import { describe, expect, it } from 'vitest';
import { estimateCabinetCost } from '../estimate';
import { makeSnapshot, refCabinet } from './fixtures';

describe('estimateCabinetCost', () => {
  it('corpul de referință: estimare fără rotunjire la foi, cu adaos de manoperă procentual și feronerie auto', () => {
    const r = estimateCabinetCost(
      { input: refCabinet(), hardwareOverrides: null, extraParts: [] },
      makeSnapshot(), { laborPct: 30, yieldFactor: 0.8, legHeightMm: null, projectHandle: { type: 'APLICAT', itemId: null } },
    );
    // plăci fracționar: PAL 1.737/(5.796×0.8)=0.3746 foi ×260=97.40 + debitare 0.3746×50=18.73
    // PFL 0.4267/(5.8995×0.8)=0.0904 foi ×100=9.04 + 0.0904×33=2.98
    // MDF 0.4267×450=192.03; cant 3.13; feronerie 48 → cost=371.32; sell=cost×1.3=482.71
    expect(r.cost).toBeCloseTo(371.32, 0);
    expect(r.sell).toBeCloseTo(482.71, 0);
    expect(r.error).toBeNull();
  });
  it('dimensiuni imposibile → error, nu throw', () => {
    const bad = refCabinet(); bad.widthMm = 10;
    const r = estimateCabinetCost(
      { input: bad, hardwareOverrides: null, extraParts: [] },
      makeSnapshot(), { laborPct: 30, yieldFactor: 0.8, legHeightMm: null, projectHandle: { type: 'APLICAT', itemId: null } },
    );
    expect(r.error).toBeTruthy();
    expect(r.cost).toBe(0);
  });
});

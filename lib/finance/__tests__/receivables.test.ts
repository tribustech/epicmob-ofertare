import { describe, expect, it } from 'vitest';
import { bucketOf, groupReceivables, type ReceivableRow } from '../receivables';

const now = new Date(2026, 8, 14); // 14.09.2026
const row = (over: Partial<ReceivableRow>): ReceivableRow => ({
  id: 'p', name: 'P', client: null, status: 'IN_PRODUCTIE', deadlineAt: null,
  contract: 1000, received: 400, advance: 400, installments: 0, final: 0, remaining: 600, ...over,
});

describe('bucketOf (încasări viitoare)', () => {
  it('montat → întârziat, indiferent de deadline', () => {
    expect(bucketOf({ status: 'MONTAT', deadlineAt: new Date(2026, 11, 1) }, now)).toBe('INTARZIAT');
  });
  it('deadline trecut → întârziat; azi → luna asta', () => {
    expect(bucketOf({ status: 'IN_PRODUCTIE', deadlineAt: new Date(2026, 8, 13) }, now)).toBe('INTARZIAT');
    expect(bucketOf({ status: 'IN_PRODUCTIE', deadlineAt: new Date(2026, 8, 14) }, now)).toBe('LUNA_ASTA');
  });
  it('luna viitoare / mai târziu / fără dată', () => {
    expect(bucketOf({ status: 'ACCEPTAT', deadlineAt: new Date(2026, 9, 3) }, now)).toBe('LUNA_VIITOARE');
    expect(bucketOf({ status: 'ACCEPTAT', deadlineAt: new Date(2026, 11, 3) }, now)).toBe('MAI_TARZIU');
    expect(bucketOf({ status: 'ACCEPTAT', deadlineAt: null }, now)).toBe('FARA_DATA');
  });
});

describe('groupReceivables', () => {
  it('rest = contract − încasat; grupele goale dispar; totalul e suma resturilor', () => {
    const { groups, total } = groupReceivables([
      row({ id: 'a', deadlineAt: new Date(2026, 8, 20), remaining: 600 }),
      row({ id: 'b', status: 'MONTAT', remaining: 250.5 }),
      row({ id: 'c', remaining: 0 }), // încasat integral → nu apare
    ], now);
    expect(groups.map((g) => g.key)).toEqual(['INTARZIAT', 'LUNA_ASTA']);
    expect(groups[0].total).toBe(250.5);
    expect(total).toBe(850.5);
  });
});

import { describe, expect, it } from 'vitest';
import { applyFilter, buildGrid, countOverdue, gridRange, isValidTime, parseKinds } from '../grid';
import type { CalendarItem } from '../types';

const item = (o: Partial<CalendarItem> & { id: string; date: Date }): CalendarItem => ({
  kind: 'MANUAL', time: null, title: o.id, subtitle: null, href: null, overdue: false, ...o,
});

describe('gridRange', () => {
  it('septembrie 2026 (1 = marți) începe luni 31 aug și are 42 de zile', () => {
    const r = gridRange('2026-09');
    expect(r.start).toEqual(new Date(2026, 7, 31));
    expect(r.end).toEqual(new Date(2026, 9, 12)); // exclusiv: 31 aug + 42 zile
  });
  it('iunie 2026 (1 = luni) începe chiar pe 1', () => {
    expect(gridRange('2026-06').start).toEqual(new Date(2026, 5, 1));
  });
  it('noiembrie 2026 (1 = duminică) începe luni 26 oct', () => {
    expect(gridRange('2026-11').start).toEqual(new Date(2026, 9, 26));
  });
  it('februarie 2027 (1 = luni, 28 zile) tot 42 de celule', () => {
    const r = gridRange('2027-02');
    expect(r.end).toEqual(new Date(2027, 2, 15));
  });
});

describe('buildGrid', () => {
  const today = new Date(2026, 8, 14);
  it('42 celule, inMonth și isToday corecte', () => {
    const cells = buildGrid('2026-09', [], today);
    expect(cells).toHaveLength(42);
    expect(cells[0].inMonth).toBe(false); // 31 aug
    expect(cells[1].inMonth).toBe(true);  // 1 sep
    expect(cells.filter((c) => c.isToday).map((c) => c.dayKey)).toEqual(['2026-09-14']);
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it('grupează pe zi și sortează: oră → tip → titlu', () => {
    const d = new Date(2026, 8, 14);
    const items = [
      item({ id: 'b', date: d, kind: 'BANI', title: 'Factură' }),
      item({ id: 'm2', date: d, kind: 'MANUAL', title: 'Montaj', time: '14:00' }),
      item({ id: 'dl', date: d, kind: 'DEADLINE', title: 'Deadline' }),
      item({ id: 'm1', date: d, kind: 'MANUAL', title: 'Livrare', time: '09:30' }),
      item({ id: 'a', date: d, kind: 'ACTIUNE', title: 'Sună' }),
      item({ id: 'x', date: new Date(2026, 8, 15), kind: 'MANUAL', title: 'Altă zi' }),
    ];
    const cell = buildGrid('2026-09', items, today).find((c) => c.dayKey === '2026-09-14')!;
    expect(cell.items.map((i) => i.id)).toEqual(['m1', 'm2', 'dl', 'a', 'b']);
  });
  it('ignoră ce e în afara grilei', () => {
    const cells = buildGrid('2026-09', [item({ id: 'far', date: new Date(2026, 11, 1) })], today);
    expect(cells.flatMap((c) => c.items)).toHaveLength(0);
  });
});

describe('countOverdue', () => {
  const today = new Date(2026, 8, 14);
  it('numără doar restanțele din zilele lunii curente (inMonth)', () => {
    const items = [
      item({ id: 'in-month', date: new Date(2026, 8, 10), overdue: true }),
      item({ id: 'leading', date: new Date(2026, 7, 31), overdue: true }), // zi din luna anterioară afișată în grilă
      item({ id: 'not-overdue', date: new Date(2026, 8, 20), overdue: false }),
    ];
    const cells = buildGrid('2026-09', items, today);
    expect(countOverdue(cells)).toBe(1);
  });
  it('0 când nu există restanțe', () => {
    const cells = buildGrid('2026-09', [], today);
    expect(countOverdue(cells)).toBe(0);
  });
});

describe('parseKinds / applyFilter', () => {
  it('lipsă sau invalid → toate', () => {
    expect(parseKinds(undefined)).toEqual(['DEADLINE', 'ACTIUNE', 'BANI', 'MANUAL']);
    expect(parseKinds('xyz')).toEqual(['DEADLINE', 'ACTIUNE', 'BANI', 'MANUAL']);
  });
  it('listă separată prin virgulă, ordine canonică', () => {
    expect(parseKinds('bani,deadline')).toEqual(['DEADLINE', 'BANI']);
  });
  it('applyFilter păstrează doar tipurile cerute', () => {
    const items = [item({ id: '1', date: new Date(), kind: 'BANI' }), item({ id: '2', date: new Date(), kind: 'MANUAL' })];
    expect(applyFilter(items, ['MANUAL']).map((i) => i.id)).toEqual(['2']);
  });
});

describe('isValidTime', () => {
  it('acceptă HH:MM valid', () => {
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
  });
  it('respinge formate greșite', () => {
    expect(isValidTime('9:30')).toBe(false);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});

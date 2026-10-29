import { describe, expect, it } from 'vitest';
import { decodeAction, describeReceipt, encodeAction, normalizeReceipt, normalizeSplit, parseAmountsText, parseReceiptDate, projectChoices, receiptSchema } from '../receipt';

const NOW = new Date('2026-10-29T12:00:00Z');
const cats = [
  { id: 'c-fer', name: 'Feronerie', scope: 'DIRECT' },
  { id: 'c-alt-d', name: 'Altele', scope: 'DIRECT' },
  { id: 'c-alt-i', name: 'Altele', scope: 'INDIRECT' },
  { id: 'c-comb', name: 'Combustibil', scope: 'INDIRECT' },
];

describe('receiptSchema', () => {
  it('e tolerant la ce întoarce AI-ul', () => {
    const r = receiptSchema.parse({ kind: 'bon', total: '1.234,50', paymentHint: 'numerar', counterparty: '' });
    expect(r.kind).toBe('BON');
    expect(r.total).toBe(1234.5);
    expect(r.paymentHint).toBe('NECUNOSCUT');
    expect(r.counterparty).toBeNull();
    expect(receiptSchema.parse({ kind: 'ceva' }).kind).toBe('ALTUL');
  });
});

describe('parseReceiptDate', () => {
  it('ISO și format românesc', () => {
    expect(parseReceiptDate('2026-10-14', NOW)?.toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(parseReceiptDate('14.10.2026', NOW)?.toISOString().slice(0, 10)).toBe('2026-10-14');
    expect(parseReceiptDate('14/10/26', NOW)?.toISOString().slice(0, 10)).toBe('2026-10-14');
  });
  it('respinge date imposibile, din viitor sau prea vechi', () => {
    expect(parseReceiptDate('2026-02-30', NOW)).toBeNull();
    expect(parseReceiptDate('2026-12-01', NOW)).toBeNull();
    expect(parseReceiptDate('2021-01-01', NOW)).toBeNull();
    expect(parseReceiptDate('ieri', NOW)).toBeNull();
    expect(parseReceiptDate(null, NOW)).toBeNull();
  });
});

describe('normalizeReceipt', () => {
  const base = receiptSchema.parse({ kind: 'BON', counterparty: 'Dedeman', total: 99.999, issuedAt: '2026-10-14', paymentHint: 'CASH', items: [{ name: ' șuruburi ', total: '12,5' }] });

  it('păstrează doar proiecte existente și rotunjește suma', () => {
    const f = normalizeReceipt({ ...base, projectId: 'inventat' }, { projectIds: ['p1'], categories: cats, now: NOW });
    expect(f.projectId).toBeNull();
    expect(f.amount).toBe(100);
    expect(f.paymentMethod).toBe('CASH');
    expect(f.items).toEqual([{ name: 'șuruburi', total: 12.5 }]);
    expect(f.split).toBeNull();
    expect(normalizeReceipt({ ...base, projectId: 'p1' }, { projectIds: ['p1'], categories: cats, now: NOW }).projectId).toBe('p1');
  });

  it('categoria: după nume, directă dacă are proiect, altfel prima potrivire', () => {
    const withProject = normalizeReceipt({ ...base, projectId: 'p1', categoryName: 'altele' }, { projectIds: ['p1'], categories: cats, now: NOW });
    expect(withProject.categoryId).toBe('c-alt-d');
    const fuel = normalizeReceipt({ ...base, categoryName: 'Combustibil' }, { projectIds: [], categories: cats, now: NOW });
    expect(fuel.categoryId).toBe('c-comb');
    expect(normalizeReceipt({ ...base, categoryName: 'Nu există' }, { projectIds: [], categories: cats, now: NOW }).categoryId).toBeNull();
  });

  it('ignoră sume negative și TVA absurd', () => {
    const f = normalizeReceipt({ ...base, total: -5, vatPct: 190 }, { projectIds: [], categories: cats, now: NOW });
    expect(f.amount).toBeNull();
    expect(f.vatPct).toBeNull();
  });
});

describe('butoane', () => {
  const id = 'clx9q2w3e4r5t6y7u8i9o0p1a';
  it('encode/decode dus-întors și încape în 64 de octeți', () => {
    const actions = [
      { kind: 'project', submissionId: id, projectId: 'clx9q2w3e4r5t6y7u8i9o0p1b' },
      { kind: 'multi', submissionId: id },
      { kind: 'stock', submissionId: id },
      { kind: 'unknown', submissionId: id },
      { kind: 'done', submissionId: id },
      { kind: 'accept', submissionId: id },
      { kind: 'split', submissionId: id, mode: 'EGAL' },
      { kind: 'payment', submissionId: id, method: 'NEPLATIT' },
      { kind: 'cancel', submissionId: id },
    ] as const;
    for (const a of actions) {
      const data = encodeAction(a);
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
      expect(decodeAction(data)).toEqual(a);
    }
  });
  it('date stricate → null', () => {
    expect(decodeAction('')).toBeNull();
    expect(decodeAction('m|abc|BITCOIN')).toBeNull();
    expect(decodeAction('e|abc|JUMATATE')).toBeNull();
    expect(decodeAction('p|abc')).toBeNull();
    expect(decodeAction('z|abc|1')).toBeNull();
  });
  it('bifatele și sugeratul apar primele', () => {
    const ps = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }, { id: 'd', label: 'D' }];
    expect(projectChoices(ps, 'c', ['d'], 2).map((p) => [p.id, p.suggested, p.selected])).toEqual([['d', false, true], ['c', true, false]]);
    expect(projectChoices(ps, null).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(projectChoices(ps, null, ['a', 'b', 'c'], 2)).toHaveLength(3);
  });
});

describe('normalizeSplit', () => {
  const ids = ['p1', 'p2'];
  it('„restul" (rând fără sumă) primește totalul minus stocul', () => {
    expect(normalizeSplit([{ project: 'STOC', amount: 400 }, { project: 'p1', amount: null }], ids, 1234.5)).toEqual([{ projectId: 'p1', amount: 834.5 }]);
    expect(normalizeSplit([{ project: 'p1', amount: 300 }, { project: 'p2', amount: null }], ids, 1000)).toEqual([{ projectId: 'p1', amount: 300 }, { projectId: 'p2', amount: 700 }]);
  });
  it('respinge propuneri incoerente', () => {
    expect(normalizeSplit([], ids, 100)).toBeNull();
    expect(normalizeSplit([{ project: 'STOC', amount: 100 }], ids, 100)).toBeNull();
    expect(normalizeSplit([{ project: 'inventat', amount: 10 }], ids, 100)).toBeNull();
    expect(normalizeSplit([{ project: 'p1', amount: 80 }, { project: 'p2', amount: 80 }], ids, 100)).toBeNull();
    expect(normalizeSplit([{ project: 'p1', amount: 50 }, { project: 'p1', amount: 50 }], ids, 100)).toBeNull();
  });
  it('fără total păstrează sumele așa cum sunt', () => {
    expect(normalizeSplit([{ project: 'p1', amount: null }, { project: 'p2', amount: 20 }], ids, null)).toEqual([{ projectId: 'p1', amount: null }, { projectId: 'p2', amount: 20 }]);
  });
});

describe('parseAmountsText', () => {
  const ps = [{ id: 'p1', label: 'Bucătărie · Popescu' }, { id: 'p2', label: 'Dressing · Ionescu' }, { id: 'p3', label: 'Bucătărie · Marin' }];
  it('sume, rest și stoc', () => {
    expect(parseAmountsText('Popescu 300, rest Ionescu', ps, 1234.5)).toEqual({ ok: true, rows: [{ projectId: 'p1', amount: 300 }, { projectId: 'p2', amount: 934.5 }] });
    expect(parseAmountsText('934,50 ionescu; 300 popescu', ps, 1234.5)).toEqual({ ok: true, rows: [{ projectId: 'p2', amount: 934.5 }, { projectId: 'p1', amount: 300 }] });
    expect(parseAmountsText('stoc 120\nrestul pe Popescu', ps, 500)).toEqual({ ok: true, rows: [{ projectId: 'p1', amount: 380 }] });
    expect(parseAmountsText('dressing 1.200 lei', ps, null)).toEqual({ ok: true, rows: [{ projectId: 'p2', amount: 1200 }] });
  });
  it('explică ce nu merge', () => {
    expect(parseAmountsText('bucatarie 100, rest Ionescu', ps, 500)).toMatchObject({ ok: false });
    expect(parseAmountsText('Vasilescu 100', ps, 500)).toMatchObject({ ok: false });
    expect(parseAmountsText('Popescu 400, Ionescu 200', ps, 500)).toMatchObject({ ok: false });
    expect(parseAmountsText('rest Popescu, rest Ionescu', ps, 500)).toMatchObject({ ok: false });
    expect(parseAmountsText('Popescu', ps, 500)).toMatchObject({ ok: false });
    expect(parseAmountsText('Popescu 100, rest Ionescu', ps, null)).toMatchObject({ ok: false });
  });
});

describe('describeReceipt', () => {
  it('rezumat pe un rând + detalii', () => {
    const text = describeReceipt({ kind: 'BON', counterparty: 'Dedeman', issuedAt: new Date(Date.UTC(2026, 9, 14, 12)), amount: 1234.5, number: null, summary: 'șuruburi' });
    expect(text).toBe('Bon · Dedeman · 14.10.2026 · 1.234,50 lei\nșuruburi');
    expect(describeReceipt({ kind: 'ALTUL', counterparty: null, issuedAt: null, amount: null, number: null, summary: null })).toBe('Document · furnizor necitit · sumă necitită');
  });
});

import { describe, expect, it } from 'vitest';
import { parseMoneyInput } from '../money';
import { netAmount, paymentStatus, projectShareOfUnpaid, remainingToPay, splitEqual, unallocated, validateAllocations } from '../documents';

describe('parseMoneyInput', () => {
  it('format românesc și englezesc', () => {
    expect(parseMoneyInput('6.120,00')).toBe(6120);
    expect(parseMoneyInput('1 234,56')).toBe(1234.56);
    expect(parseMoneyInput('25.000')).toBe(25000);
    expect(parseMoneyInput('6120.5')).toBe(6120.5);
    expect(parseMoneyInput('240')).toBe(240);
    expect(parseMoneyInput('1.234.567')).toBe(1234567);
    expect(parseMoneyInput('240 lei')).toBe(240);
    expect(Number.isNaN(parseMoneyInput('abc'))).toBe(true);
    expect(Number.isNaN(parseMoneyInput(''))).toBe(true);
  });
});

describe('documents', () => {
  it('paymentStatus', () => {
    expect(paymentStatus(100, 0)).toBe('NEPLATIT');
    expect(paymentStatus(100, 40)).toBe('PARTIAL');
    expect(paymentStatus(100, 100)).toBe('PLATIT');
    expect(paymentStatus(100, 99.999)).toBe('PLATIT');
  });

  it('remainingToPay nu coboară sub 0', () => {
    expect(remainingToPay(100, 30)).toBe(70);
    expect(remainingToPay(100, 120)).toBe(0);
  });

  it('unallocated + validateAllocations', () => {
    expect(unallocated(6120, [{ amount: 4900 }, { amount: 1220 }])).toBe(0);
    expect(unallocated(6120, [{ amount: 4900 }])).toBe(1220);
    expect(validateAllocations(6120, [{ amount: 4900, projectId: 'a' }, { amount: 1220, projectId: 'b' }])).toBeNull();
    expect(validateAllocations(6120, [{ amount: 7000, projectId: 'a' }])).toMatch(/depășesc/);
    expect(validateAllocations(6120, [{ amount: 0, projectId: 'a' }])).toMatch(/mai mare/);
    expect(validateAllocations(6120, [{ amount: 10, projectId: '' }])).toMatch(/proiectul/);
  });

  it('splitEqual păstrează suma exact', () => {
    expect(splitEqual(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(splitEqual(6120, 2)).toEqual([3060, 3060]);
    expect(splitEqual(10, 0)).toEqual([]);
  });

  it('netAmount', () => {
    expect(netAmount(6120, 21, true)).toBe(5057.85);
    expect(netAmount(6120, 21, false)).toBe(6120);
    expect(netAmount(6120, null, true)).toBe(6120);
  });

  it('projectShareOfUnpaid proporțional cu alocarea', () => {
    expect(projectShareOfUnpaid({ amount: 6120, paid: 3060 }, 4900)).toBe(2450);
    expect(projectShareOfUnpaid({ amount: 6120, paid: 6120 }, 4900)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { adjustmentAmount, balanceOf, personalDebt, signedAmount } from '../balance';

describe('balance', () => {
  it('signedAmount: intrări +, ieșiri −, ajustarea cu semnul ei', () => {
    expect(signedAmount({ type: 'IN', amount: 100 })).toBe(100);
    expect(signedAmount({ type: 'TRANSFER_IN', amount: 50 })).toBe(50);
    expect(signedAmount({ type: 'OUT', amount: 30 })).toBe(-30);
    expect(signedAmount({ type: 'TRANSFER_OUT', amount: 20 })).toBe(-20);
    expect(signedAmount({ type: 'ADJUSTMENT', amount: -7.5 })).toBe(-7.5);
    expect(signedAmount({ type: 'ADJUSTMENT', amount: 3 })).toBe(3);
  });

  it('balanceOf însumează cu rotunjire la 2 zecimale', () => {
    expect(balanceOf([
      { type: 'IN', amount: 1000 }, { type: 'OUT', amount: 240.1 }, { type: 'TRANSFER_OUT', amount: 100 },
      { type: 'ADJUSTMENT', amount: -0.2 },
    ])).toBe(659.7);
    expect(balanceOf([])).toBe(0);
  });

  it('adjustmentAmount = numărat − calculat', () => {
    expect(adjustmentAmount(1000, 1012.5)).toBe(-12.5);
    expect(adjustmentAmount(500, 480)).toBe(20);
    expect(adjustmentAmount(100, 100)).toBe(0);
  });

  it('personalDebt: doar soldul negativ', () => {
    expect(personalDebt(-350)).toBe(350);
    expect(personalDebt(120)).toBe(0);
  });
});

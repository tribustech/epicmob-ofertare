import { describe, expect, it } from 'vitest';
import { daysFromToday, parseDateInput, startOfToday, toDateInput } from '../dates';

describe('crm dates', () => {
  it('parseDateInput: YYYY-MM-DD → miezul nopții local; invalid → null', () => {
    const d = parseDateInput('2026-09-12')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 12, 0]);
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('12.09.2026')).toBeNull();
    expect(parseDateInput(undefined)).toBeNull();
  });

  it('toDateInput e inversul lui parseDateInput', () => {
    expect(toDateInput(parseDateInput('2026-01-05'))).toBe('2026-01-05');
    expect(toDateInput(null)).toBe('');
  });

  it('daysFromToday: azi = 0, ieri = -1, mâine = 1', () => {
    const today = startOfToday();
    const shift = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
    expect(daysFromToday(today)).toBe(0);
    expect(daysFromToday(shift(-1))).toBe(-1);
    expect(daysFromToday(shift(1))).toBe(1);
  });
});

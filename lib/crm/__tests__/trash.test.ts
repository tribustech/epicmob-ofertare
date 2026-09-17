import { describe, expect, it } from 'vitest';
import { TRASH_DAYS, daysLeftInTrash, isExpired, trashCutoff } from '../trash';

const at = (daysAgo: number) => { const d = new Date(2026, 8, 17, 10); d.setDate(d.getDate() - daysAgo); return d; };
const today = new Date(2026, 8, 17, 10);

describe('coșul de gunoi', () => {
  it('ține 30 de zile', () => {
    expect(TRASH_DAYS).toBe(30);
  });
  it('zile rămase, rotunjite în jos', () => {
    expect(daysLeftInTrash(at(0), today)).toBe(30);
    expect(daysLeftInTrash(at(1), today)).toBe(29);
    expect(daysLeftInTrash(at(29), today)).toBe(1);
    expect(daysLeftInTrash(at(30), today)).toBe(0);
  });
  it('nu coboară sub zero', () => {
    expect(daysLeftInTrash(at(45), today)).toBe(0);
  });
  it('expiră fix la 30 de zile', () => {
    expect(isExpired(at(29), today)).toBe(false);
    expect(isExpired(at(30), today)).toBe(true);
    expect(isExpired(at(31), today)).toBe(true);
  });
  it('pragul e acum minus 30 de zile', () => {
    const cut = trashCutoff(today);
    expect(Math.round((today.getTime() - cut.getTime()) / 86_400_000)).toBe(30);
  });
});

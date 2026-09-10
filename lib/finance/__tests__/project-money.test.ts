import { describe, expect, it } from 'vitest';
import { summarize } from '../project-money';

describe('summarize (bani pe proiect)', () => {
  it('contract = oferte acceptate + modificări; contribuție = contract − cheltuit', () => {
    const m = summarize({ acceptedQuotes: 8107.34, contractChanges: 1800, received: 4000, spent: 6400, unpaidShare: 2450 });
    expect(m.contract).toBe(9907.34);
    expect(m.contribution).toBe(3507.34);
    expect(m.contributionPct).toBe(35.4);
    expect(m.receivable).toBe(5907.34);
    expect(m.unpaidShare).toBe(2450);
  });

  it('fără contract → procent null, de încasat negativ dacă s-a încasat fără contract', () => {
    const m = summarize({ acceptedQuotes: 0, contractChanges: 0, received: 500, spent: 0, unpaidShare: 0 });
    expect(m.contributionPct).toBeNull();
    expect(m.receivable).toBe(-500);
  });
});

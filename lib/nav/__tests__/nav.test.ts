import { describe, expect, it } from 'vitest';
import { MAIN_NAV, PRIMARY_NAV, SECONDARY_NAV } from '../items';

describe('meniul principal', () => {
  it('bara de jos are exact 4 destinații plus „Mai mult"', () => {
    expect(PRIMARY_NAV.map((i) => i.href)).toEqual(['/', '/calendar', '/proiecte', '/clienti']);
  });
  it('restul intră în panoul „Mai mult"', () => {
    expect(SECONDARY_NAV.map((i) => i.href)).toEqual(['/leaduri', '/finante', '/luna', '/cataloage', '/setari']);
  });
  it('împreună acoperă tot meniul, fără dubluri', () => {
    const all = [...PRIMARY_NAV, ...SECONDARY_NAV].map((i) => i.href).sort();
    expect(all).toEqual(MAIN_NAV.map((i) => i.href).sort());
    expect(new Set(all).size).toBe(MAIN_NAV.length);
  });
  it('fiecare destinație din bara de jos are iconiță', () => {
    for (const i of PRIMARY_NAV) expect(i.icon).toBeTruthy();
  });
});

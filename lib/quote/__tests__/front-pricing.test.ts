import { describe, it, expect } from 'vitest';
import { frontVopsitCostEur } from '../front-pricing';

const base = {
  areaSqm: 2, frontCount: 2, pricePerSqmEur: 115, faces: 1,
  finish: 'MAT' as const, colorCategory: 'NORMALA' as const,
  ralBlack: false, hasHandleMilling: false,
  supplier: { handleMillingEur: 7, vividSurchargeEur: 13, metallicSurchargeEur: 36, blackGlossEurPerFace: 6 },
};

describe('frontVopsitCostEur', () => {
  it('mat normala 1 fata = arie × preț', () => {
    expect(frontVopsitCostEur(base)).toBe(230); // 2 × 115
  });
  it('culoare vie adaugă +13/m²', () => {
    expect(frontVopsitCostEur({ ...base, colorCategory: 'VIE' })).toBe(2 * (115 + 13)); // 256
  });
  it('metalizat +36/m²', () => {
    expect(frontVopsitCostEur({ ...base, colorCategory: 'METALIZAT' })).toBe(2 * (115 + 36)); // 302
  });
  it('lucios pe negru +6/m²/față (2 fețe)', () => {
    expect(frontVopsitCostEur({ ...base, finish: 'LUCIOS', faces: 2, ralBlack: true }))
      .toBe(2 * (115 + 6 * 2)); // 254
  });
  it('frezare mâner + handleMillingEur × frontCount', () => {
    expect(frontVopsitCostEur({ ...base, hasHandleMilling: true })).toBe(230 + 7 * 2); // 244
  });
});

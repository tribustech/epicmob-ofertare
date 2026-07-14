import { describe, expect, it } from 'vitest';
import { pickLegId } from '../legs';

const HW = [
  { id: 'p100-scump', name: 'Picior 100 premium', category: 'PICIOR', pricePerUnit: 5, nominalLengthMm: 100, loadClassKg: null, boxHeightMm: null, active: true },
  { id: 'p100', name: 'Picior 100', category: 'PICIOR', pricePerUnit: 2.5, nominalLengthMm: 100, loadClassKg: null, boxHeightMm: null, active: true },
  { id: 'p150', name: 'Picior 150', category: 'PICIOR', pricePerUnit: 3, nominalLengthMm: 150, loadClassKg: null, boxHeightMm: null, active: true },
  { id: 'p100-inactiv', name: 'Picior 100 vechi', category: 'PICIOR', pricePerUnit: 1, nominalLengthMm: 100, loadClassKg: null, boxHeightMm: null, active: false },
];

describe('pickLegId', () => {
  it('alege piciorul activ cu nominala potrivită, cel mai ieftin', () => {
    expect(pickLegId(HW, 100, 'fallback')).toBe('p100');
    expect(pickLegId(HW, 150, 'fallback')).toBe('p150');
  });
  it('fără potrivire → fallback', () => {
    expect(pickLegId(HW, 120, 'fallback')).toBe('fallback');
    expect(pickLegId([], 100, null)).toBeNull();
  });
});

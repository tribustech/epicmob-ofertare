import { describe, it, expect } from 'vitest';
import { materialHasNoPrice } from '../material-price';

describe('materialHasNoPrice', () => {
  it('true când PER_SHEET și pricePerSheet null/0', () => {
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: null, pricePerSqm: null })).toBe(true);
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: 0, pricePerSqm: null })).toBe(true);
  });
  it('false când are preț', () => {
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: 404.71, pricePerSqm: null })).toBe(false);
    expect(materialHasNoPrice({ pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 120 })).toBe(false);
  });
  it('true când PER_SQM și pricePerSqm null/0', () => {
    expect(materialHasNoPrice({ pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: null })).toBe(true);
    expect(materialHasNoPrice({ pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 0 })).toBe(true);
  });
});

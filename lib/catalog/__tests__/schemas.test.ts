import { describe, expect, it } from 'vitest';
import { formDataToObject, materialSchema, settingsSchema } from '../schemas';

describe('materialSchema', () => {
  const base = {
    name: 'PAL alb', kind: 'PAL', thicknessMm: '18',
    sheetLengthMm: '2800', sheetWidthMm: '2070',
    pricingMode: 'PER_SHEET', pricePerSheet: '260', pricePerSqm: '',
  };
  it('parsează stringuri din FormData în numere', () => {
    const m = materialSchema.parse(base);
    expect(m.thicknessMm).toBe(18);
    expect(m.pricePerSheet).toBe(260);
    expect(m.pricePerSqm).toBeUndefined();
  });
  it('PER_SHEET fără preț per foaie → invalid', () => {
    expect(() => materialSchema.parse({ ...base, pricePerSheet: '' })).toThrow();
  });
  it('PER_SQM fără preț per m² → invalid', () => {
    expect(() => materialSchema.parse({ ...base, pricingMode: 'PER_SQM', pricePerSheet: '', pricePerSqm: '' })).toThrow();
  });
  it('kind invalid → invalid', () => {
    expect(() => materialSchema.parse({ ...base, kind: 'OSB' })).toThrow();
  });
});

describe('settingsSchema', () => {
  it('validează factorul de utilizare în (0, 1]', () => {
    expect(() => settingsSchema.parse({ markupPct: '30', sheetYieldFactor: '1.2' })).toThrow();
    expect(settingsSchema.parse({ markupPct: '30', sheetYieldFactor: '0.8' }).sheetYieldFactor).toBe(0.8);
  });
});

describe('formDataToObject', () => {
  it('transformă FormData în obiect de stringuri', () => {
    const fd = new FormData();
    fd.set('name', 'X');
    fd.set('thicknessMm', '18');
    expect(formDataToObject(fd)).toEqual({ name: 'X', thicknessMm: '18' });
  });
});

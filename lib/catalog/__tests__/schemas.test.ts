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
    expect(() => settingsSchema.parse({
      laborPct: '30', sheetYieldFactor: '1.2', cutKerfMm: '4', cutTrimMm: '10',
    })).toThrow();
    expect(settingsSchema.parse({
      laborPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '4', cutTrimMm: '10',
    }).sheetYieldFactor).toBe(0.8);
  });

  it('settingsSchema acceptă kerf și trim numerice și respinge negativ', () => {
    const ok = settingsSchema.parse({
      laborPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '4', cutTrimMm: '10',
    });
    expect(ok.cutKerfMm).toBe(4);
    expect(ok.cutTrimMm).toBe(10);
    expect(() => settingsSchema.parse({
      laborPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '-1', cutTrimMm: '10',
    })).toThrow();
    expect(() => settingsSchema.parse({
      laborPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '4', cutTrimMm: '1000',
    })).toThrow();
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

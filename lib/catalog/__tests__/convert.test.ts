import { describe, expect, it } from 'vitest';
import {
  buildHardwareDefaults, parseConstruction, toBoardMaterial, toCostCatalogs,
  type HardwareRow, type MaterialRow, type SettingsRow,
} from '../convert';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';

const palRow: MaterialRow = {
  id: 'pal-alb', name: 'PAL alb', kind: 'PAL', thicknessMm: 18,
  sheetLengthMm: 2800, sheetWidthMm: 2070,
  pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null,
};
const mdfRow: MaterialRow = { ...palRow, id: 'mdf-v', kind: 'MDF_VOPSIT', pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450 };

describe('toBoardMaterial', () => {
  it('PER_SHEET → union cu pricePerSheet', () => {
    expect(toBoardMaterial(palRow).pricing).toEqual({ mode: 'PER_SHEET', pricePerSheet: 260 });
  });
  it('PER_SQM → union cu pricePerSqm', () => {
    expect(toBoardMaterial(mdfRow).pricing).toEqual({ mode: 'PER_SQM', pricePerSqm: 450 });
  });
  it('kind necunoscut → eroare', () => {
    expect(() => toBoardMaterial({ ...palRow, kind: 'OSB' })).toThrow(/tip de material/i);
  });
  it('PER_SHEET fără preț → eroare', () => {
    expect(() => toBoardMaterial({ ...palRow, pricePerSheet: null })).toThrow(/preț/i);
  });
});

describe('toCostCatalogs', () => {
  it('sortează cuttingRates crescător', () => {
    const c = toCostCatalogs([palRow], [], [], [
      { maxThicknessMm: 32, pricePerSheet: 50 },
      { maxThicknessMm: 10, pricePerSheet: 33 },
    ]);
    expect(c.cuttingRates[0].maxThicknessMm).toBe(10);
  });
});

describe('buildHardwareDefaults', () => {
  const settings: SettingsRow = {
    sheetYieldFactor: 0.8, constructionJson: '{}',
    defaultHingeId: 'h1', defaultHandleId: null, defaultLegId: 'l1', defaultRailId: null,
  };
  const slides: HardwareRow[] = [
    { id: 's450-scump', name: 'A', category: 'SERTAR', pricePerUnit: 180, nominalLengthMm: 450, loadClassKg: 30, boxHeightMm: null },
    { id: 's450-ieftin', name: 'B', category: 'SERTAR', pricePerUnit: 35, nominalLengthMm: 450, loadClassKg: 25, boxHeightMm: null },
    { id: 's500', name: 'C', category: 'SERTAR', pricePerUnit: 190, nominalLengthMm: 500, loadClassKg: 30, boxHeightMm: null },
  ];
  it('slideIdsByNominal din itemele SERTAR; duplicat → cel mai ieftin', () => {
    const d = buildHardwareDefaults(slides, settings);
    expect(d.slideIdsByNominal).toEqual({ 450: 's450-ieftin', 500: 's500' });
    expect(d.hingeId).toBe('h1');
    expect(d.handleId).toBeNull();
  });
});

describe('parseConstruction', () => {
  it('merge peste DEFAULT_CONSTRUCTION', () => {
    const c = parseConstruction(JSON.stringify({ frontGapMm: 4 }));
    expect(c.frontGapMm).toBe(4);
    expect(c.shelfSetbackMm).toBe(DEFAULT_CONSTRUCTION.shelfSetbackMm);
  });
});

import { describe, expect, it } from 'vitest';
import { cabinetFormSchema, toCabinetInput } from '../cabinet-form';

const base = {
  label: 'C1', type: 'BAZA',
  widthMm: '600', heightMm: '720', depthMm: '560',
  shelves: '1', doors: '1',
  frontType: 'USI', withShelves: 'true',
  carcassMaterialId: 'pal', frontMaterialId: 'pal',
  backEnabled: 'true', backMaterialId: 'pfl', backMount: 'FALT',
  carcassFrontEdgeId: 'abs04', frontPerimeterId: '',
  blindPanelWidthMm: '',
  drawersCount: '0', drawersSystem: 'METAL_BOX',
  drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
};

describe('cabinetFormSchema + toCabinetInput', () => {
  it('uși cu polițe: doors și shelves trec, drawers lipsește', () => {
    const input = toCabinetInput(cabinetFormSchema.parse(base));
    expect(input.doors).toBe(1);
    expect(input.shelves).toBe(1);
    expect(input.drawers).toBeUndefined();
  });

  it('uși fără polițe (corp chiuvetă): shelves devine 0', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({ ...base, withShelves: 'false' }));
    expect(input.shelves).toBe(0);
    expect(input.doors).toBe(1);
  });

  it('sertare: doors și shelves devin 0, înălțimile per sertar se transmit', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({
      ...base, frontType: 'SERTARE', drawersCount: '3',
      drawersBottomMaterialId: 'pfl', drawerFrontHeightsMm: '200, 258, 258',
    }));
    expect(input.doors).toBe(0);
    expect(input.shelves).toBe(0);
    expect(input.drawers).toEqual({
      count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl',
      frontHeightsMm: [200, 258, 258],
    });
  });

  it('sertare cu 0 sertare → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersCount: '0', drawersBottomMaterialId: 'pfl',
    });
    expect(r.success).toBe(false);
  });

  it('sertare fără fund → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({ ...base, frontType: 'SERTARE', drawersCount: '2', drawersBottomMaterialId: '' });
    expect(r.success).toBe(false);
  });

  it('sertare cu număr de înălțimi diferit de numărul de sertare → eroare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersCount: '3',
      drawersBottomMaterialId: 'pfl', drawerFrontHeightsMm: '200, 258',
    });
    expect(r.success).toBe(false);
  });

  it('uși fără material de front → eroare', () => {
    const r = cabinetFormSchema.safeParse({ ...base, frontMaterialId: '' });
    expect(r.success).toBe(false);
  });

  it('fără front: doors 0, drawers lipsește, frontMaterialId null, polițele rămân', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({ ...base, frontType: 'FARA', shelves: '2' }));
    expect(input.doors).toBe(0);
    expect(input.drawers).toBeUndefined();
    expect(input.frontMaterialId).toBeNull();
    expect(input.shelves).toBe(2);
  });

  // --- Cazuri păstrate din schema veche (adaptate la frontType/withShelves) ---

  it('parsează stringurile numerice și checkbox-ul de spate', () => {
    const d = cabinetFormSchema.parse(base);
    expect(d.widthMm).toBe(600);
    expect(d.backEnabled).toBe(true);
  });

  it('checkbox absent → backEnabled false (cu spate dezactivat nu cere material)', () => {
    const { backEnabled: _omit, backMaterialId: _omit2, ...rest } = base;
    const d = cabinetFormSchema.parse({ ...rest, backMaterialId: '' });
    expect(d.backEnabled).toBe(false);
  });

  it('BAZA cu uși: fără drawers, frontPerimeterId gol → null, back complet', () => {
    const input = toCabinetInput(cabinetFormSchema.parse(base));
    expect(input.drawers).toBeUndefined();
    expect(input.edgeBands.frontPerimeterId).toBeNull();
    expect(input.back).toEqual({ enabled: true, materialId: 'pfl', mount: 'FALT' });
  });

  it('blindPanelWidthMm se păstrează doar la COLT', () => {
    const baza = toCabinetInput(cabinetFormSchema.parse({ ...base, blindPanelWidthMm: '120' }));
    expect(baza.blindPanelWidthMm).toBeUndefined();
    const colt = toCabinetInput(cabinetFormSchema.parse({ ...base, type: 'COLT', blindPanelWidthMm: '120' }));
    expect(colt.blindPanelWidthMm).toBe(120);
  });
});

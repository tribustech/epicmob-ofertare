import { describe, expect, it } from 'vitest';
import { cabinetFormSchema, toCabinetInput } from '../cabinet-form';

const BASE = {
  label: 'B1', type: 'BAZA',
  widthMm: '600', heightMm: '720', depthMm: '560',
  shelves: '1', doors: '1',
  carcassMaterialId: 'pal-alb', frontMaterialId: 'mdf-vopsit',
  backEnabled: 'on', backMaterialId: 'pfl-alb', backMount: 'FALT',
  carcassFrontEdgeId: 'abs-04', frontPerimeterId: '',
  blindPanelWidthMm: '', drawersCount: '0', drawersSystem: 'METAL_BOX',
  drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
};

describe('cabinetFormSchema', () => {
  it('parsează stringuri și checkbox-ul de spate', () => {
    const d = cabinetFormSchema.parse(BASE);
    expect(d.widthMm).toBe(600);
    expect(d.backEnabled).toBe(true);
  });

  it('checkbox absent → backEnabled false (cu spate dezactivat nu cere material)', () => {
    const { backEnabled: _omit, backMaterialId: _omit2, ...rest } = BASE;
    const d = cabinetFormSchema.parse({ ...rest, backMaterialId: '' });
    expect(d.backEnabled).toBe(false);
  });

  it('SERTARE fără sertare → invalid', () => {
    expect(() => cabinetFormSchema.parse({ ...BASE, type: 'SERTARE', drawersCount: '0' })).toThrow(/sertar/i);
  });

  it('SERTARE fără material de fund → invalid', () => {
    expect(() =>
      cabinetFormSchema.parse({ ...BASE, type: 'SERTARE', drawersCount: '3', drawersBottomMaterialId: '' }),
    ).toThrow(/fund/i);
  });
});

describe('toCabinetInput', () => {
  it('BAZA: fără drawers, frontPerimeterId gol → null', () => {
    const input = toCabinetInput(cabinetFormSchema.parse(BASE));
    expect(input.drawers).toBeUndefined();
    expect(input.edgeBands.frontPerimeterId).toBeNull();
    expect(input.back).toEqual({ enabled: true, materialId: 'pfl-alb', mount: 'FALT' });
  });

  it('SERTARE: doors 0, înălțimi din text cu virgule', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({
      ...BASE, type: 'SERTARE', doors: '2',
      drawersCount: '3', drawersBottomMaterialId: 'pfl-alb', drawerFrontHeightsMm: '140, 283,283',
    }));
    expect(input.doors).toBe(0);
    expect(input.drawers).toMatchObject({ count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' });
    expect(input.drawers!.frontHeightsMm).toEqual([140, 283, 283]);
  });

  it('blindPanelWidthMm se păstrează doar la COLT', () => {
    const baza = toCabinetInput(cabinetFormSchema.parse({ ...BASE, blindPanelWidthMm: '120' }));
    expect(baza.blindPanelWidthMm).toBeUndefined();
    const colt = toCabinetInput(cabinetFormSchema.parse({ ...BASE, type: 'COLT', blindPanelWidthMm: '120' }));
    expect(colt.blindPanelWidthMm).toBe(120);
  });
});

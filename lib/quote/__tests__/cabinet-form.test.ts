import { describe, expect, it } from 'vitest';
import { cabinetFormSchema, piecesConfigSchema, prunePiecesConfig, toCabinetInput } from '../cabinet-form';

const base = {
  label: 'C1', type: 'BAZA',
  widthMm: '600', heightMm: '720', depthMm: '560',
  mountTop: 'INCADRAT', mountBottom: 'INCADRAT',
  shelves: '1', doors: '1',
  frontType: 'USI', withShelves: 'true',
  carcassMaterialId: 'pal', frontMaterialId: 'pal',
  backEnabled: 'true', backMaterialId: 'pfl', backMount: 'FALT',
  carcassFrontEdgeId: 'abs04', frontPerimeterId: '',
  falsStangaMm: '', falsDreaptaMm: '',
  drawersCount: '0', drawersSystem: 'TANDEMBOX',
  drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
  hingeId: '', slideId: '', tandemboxHeightMm: '',
  handleMode: 'PROIECT', handleType: 'APLICAT', handleItemId: '', frontExtensionMm: '',
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
      count: 3, system: 'TANDEMBOX', bottomMaterialId: undefined,
      frontHeightsMm: [200, 258, 258],
    });
  });

  it('sertare cu 0 sertare → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersCount: '0', drawersBottomMaterialId: 'pfl',
    });
    expect(r.success).toBe(false);
  });

  it('sertare PAL_BOX fără fund → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersSystem: 'PAL_BOX', drawersCount: '2', drawersBottomMaterialId: '',
    });
    expect(r.success).toBe(false);
  });

  it('sertare TANDEMBOX fără fund → valid (cutia e completă, nu se debitează fund)', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersSystem: 'TANDEMBOX', drawersCount: '2', drawersBottomMaterialId: '',
    });
    expect(r.success).toBe(true);
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

  it('front implicit PAL: frontKind PAL, mdfFront lipsește', () => {
    const d = cabinetFormSchema.parse(base);
    expect(d.frontKind).toBe('PAL');
    const input = toCabinetInput(d);
    expect(input.frontKind).toBe('PAL');
    expect(input.mdfFront).toBeUndefined();
  });

  it('front din sticlă cu ramă păstrează materialul ales și nu cere configurație MDF', () => {
    const d = cabinetFormSchema.parse({
      ...base,
      frontKind: 'STICLA_RAMA',
      frontMaterialId: 'sticla-rama-standard',
      frontPerimeterId: '',
    });
    const input = toCabinetInput(d);

    expect(input.frontKind).toBe('STICLA_RAMA');
    expect(input.frontMaterialId).toBe('sticla-rama-standard');
    expect(input.mdfFront).toBeUndefined();
  });

  it('MDF vopsit fără model → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'USI', frontKind: 'MDF_VOPSIT', frontMaterialId: '',
      mdfSupplierId: 'paint-mob', mdfModelId: '', mdfRalCode: '9010',
    });
    expect(r.success).toBe(false);
  });

  it('MDF vopsit complet → valid, mdfFront populat, frontMaterialId null', () => {
    const d = cabinetFormSchema.parse({
      ...base, frontType: 'USI', frontKind: 'MDF_VOPSIT', frontMaterialId: '', frontPerimeterId: '',
      mdfSupplierId: 'paint-mob', mdfModelId: 'model-x', mdfFinish: 'LUCIOS',
      mdfFaces: '2', mdfRalCode: '9010', mdfColorCategory: 'METALIZAT',
    });
    const input = toCabinetInput(d);
    expect(input.frontKind).toBe('MDF_VOPSIT');
    expect(input.frontMaterialId).toBeNull();
    expect(input.mdfFront).toEqual({
      supplierId: 'paint-mob', modelId: 'model-x', finish: 'LUCIOS',
      faces: 2, ralCode: '9010', colorCategory: 'METALIZAT',
    });
  });

  it('fără front: doors 0, drawers lipsește, frontMaterialId null, polițele rămân', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({ ...base, frontType: 'FARA', shelves: '2' }));
    expect(input.doors).toBe(0);
    expect(input.drawers).toBeUndefined();
    expect(input.frontMaterialId).toBeNull();
    expect(input.shelves).toBe(2);
  });

  it('păstrează arborele fagure în piecesJson și dezactivează polițele mobile', () => {
    const pieces = piecesConfigSchema.parse({ honeycomb: { root: {
      id: 'split-1', kind: 'split', axis: 'H', firstSizeMm: 300, sourceId: 'root',
      materialId: 'sticla-polita-standard',
      first: { id: 'bottom', kind: 'leaf' }, second: { id: 'top', kind: 'leaf' },
    } } });
    const pruned = prunePiecesConfig(pieces);
    const input = toCabinetInput(cabinetFormSchema.parse({
      ...base, shelves: '2', shelfMaterialId: 'sticla-polita-standard',
    }), pruned);

    expect(pruned?.honeycomb?.root).toMatchObject({ id: 'split-1', axis: 'H' });
    expect(input.shelves).toBe(0);
    expect(input.shelf?.materialId).toBe('sticla-polita-standard');
    expect(input.pieces?.honeycomb?.root).toMatchObject({ id: 'split-1' });
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

  it('falseFronts se emit doar la fronturi cu uși', () => {
    const usi = toCabinetInput(cabinetFormSchema.parse({ ...base, falsStangaMm: '120' }));
    expect(usi.falseFronts).toEqual({ stangaMm: 120, dreaptaMm: undefined });
    const sertare = toCabinetInput(cabinetFormSchema.parse({
      ...base, frontType: 'SERTARE', drawersCount: '2', falsStangaMm: '120',
    }));
    expect(sertare.falseFronts).toBeUndefined();
  });
});

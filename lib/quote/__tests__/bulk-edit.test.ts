import { describe, expect, it } from 'vitest';
import type { CabinetInput } from '@/lib/engine';
import type { QuoteInput } from '../compute';
import { applyBulkCabinetPatch, buildBulkEditPreview, bulkCabinetPatchSchema } from '../bulk-edit';
import { makeSnapshot } from './fixtures';

function cabinet(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return {
    label: 'C1', type: 'BAZA', widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 2, shelf: { materialId: 'pal-vechi', decorAxis: 'FB' }, doors: 2,
    carcassMaterialId: 'pal-vechi', frontKind: 'PAL', frontMaterialId: 'front-vechi',
    back: { enabled: true, materialId: 'pfl', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-2' },
    ...overrides,
  };
}

describe('applyBulkCabinetPatch', () => {
  it('schimbă carcasa și materialul polițelor fără să atingă spatele', () => {
    const result = applyBulkCabinetPatch(cabinet(), { carcassMaterialId: 'pal-nou' });

    expect(result.input.carcassMaterialId).toBe('pal-nou');
    expect(result.input.shelf).toEqual({ materialId: 'pal-nou', decorAxis: 'FB' });
    expect(result.input.back.materialId).toBe('pfl');
  });

  it('aplică numai dimensiunile exacte completate', () => {
    const result = applyBulkCabinetPatch(cabinet(), {
      dimensions: { widthMm: 800, depthMm: 600 },
    });

    expect(result.input.widthMm).toBe(800);
    expect(result.input.heightMm).toBe(720);
    expect(result.input.depthMm).toBe(600);
  });

  it('schimbă tipul și materialul unui front din placă', () => {
    const result = applyBulkCabinetPatch(cabinet({
      frontKind: 'MDF_VOPSIT', frontMaterialId: null,
      mdfFront: {
        supplierId: 's1', modelId: 'm1', finish: 'MAT', faces: 1,
        ralCode: 'RAL 9010', colorCategory: 'NORMALA',
      },
    }), { front: { kind: 'MDF_MELAMINAT', materialId: 'mdf-nou' } });

    expect(result.frontSkipped).toBe(false);
    expect(result.input.frontKind).toBe('MDF_MELAMINAT');
    expect(result.input.frontMaterialId).toBe('mdf-nou');
    expect(result.input.mdfFront).toBeUndefined();
  });

  it('configurează integral un front MDF vopsit', () => {
    const mdfFront = {
      supplierId: 's2', modelId: 'm2', finish: 'LUCIOS' as const, faces: 2,
      ralCode: 'RAL 3020', colorCategory: 'VIE' as const,
    };
    const result = applyBulkCabinetPatch(cabinet(), {
      front: { kind: 'MDF_VOPSIT', mdfFront },
    });

    expect(result.input.frontKind).toBe('MDF_VOPSIT');
    expect(result.input.frontMaterialId).toBeNull();
    expect(result.input.mdfFront).toEqual(mdfFront);
    expect(result.input.edgeBands.frontPerimeterId).toBeNull();
  });

  it('ignoră schimbarea frontului la corpul fără uși sau sertare', () => {
    const input = cabinet({ doors: 0, frontMaterialId: null });
    const result = applyBulkCabinetPatch(input, {
      front: { kind: 'PAL', materialId: 'front-nou' },
      dimensions: { widthMm: 700 },
    });

    expect(result.frontSkipped).toBe(true);
    expect(result.input.frontMaterialId).toBeNull();
    expect(result.input.widthMm).toBe(700);
  });
});

describe('bulkCabinetPatchSchema', () => {
  it('respinge un patch fără nicio modificare', () => {
    expect(() => bulkCabinetPatchSchema.parse({ dimensions: {} })).toThrow(/modificare/i);
  });

  it('respinge dimensiunile nule sau negative', () => {
    expect(() => bulkCabinetPatchSchema.parse({ dimensions: { widthMm: 0 } })).toThrow();
    expect(() => bulkCabinetPatchSchema.parse({ dimensions: { depthMm: -10 } })).toThrow();
  });
});

describe('buildBulkEditPreview', () => {
  it('calculează prețul înainte și după fără să modifice inputul primit', () => {
    const original = cabinet({
      label: 'C1', carcassMaterialId: 'pal-alb', frontMaterialId: 'pal-alb',
      shelf: undefined, back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const quoteInput: QuoteInput = {
      laborPct: 30,
      freeLines: [],
      projectHandle: { type: 'APLICAT', itemId: 'maner-std' },
      cabinets: [{ id: 'c1', assemblyId: 'a1', input: original, hardwareAdjustments: null, extraParts: [] }],
    };
    const snapshot = makeSnapshot({
      materials: [
        ...makeSnapshot().materials,
        { id: 'pal-premium', name: 'PAL premium', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 520, pricePerSqm: null, active: true },
      ],
    });

    const preview = buildBulkEditPreview(quoteInput, snapshot, ['c1'], { carcassMaterialId: 'pal-premium' });

    expect(preview.totalAfter).toBeGreaterThan(preview.totalBefore);
    expect(preview.selectedAfter).toBeGreaterThan(preview.selectedBefore);
    expect(quoteInput.cabinets[0].input.carcassMaterialId).toBe('pal-alb');
  });

  it('raportează corpurile fără fronturi ignorate de patch-ul de front', () => {
    const input = cabinet({
      label: 'Fără front', doors: 0, frontMaterialId: null, carcassMaterialId: 'pal-alb',
      shelf: undefined, back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: null },
    });
    const quoteInput: QuoteInput = {
      laborPct: 30,
      freeLines: [],
      projectHandle: { type: 'APLICAT', itemId: 'maner-std' },
      cabinets: [{ id: 'c1', assemblyId: 'a1', input, hardwareAdjustments: null, extraParts: [] }],
    };

    const preview = buildBulkEditPreview(quoteInput, makeSnapshot(), ['c1'], {
      front: { kind: 'PAL', materialId: 'pal-alb' },
    });

    expect(preview.skippedFrontLabels).toEqual(['Fără front']);
  });
});

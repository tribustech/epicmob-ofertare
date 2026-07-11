import type { CabinetInput, Catalogs } from '../types';

export const TEST_CATALOGS: Catalogs = {
  materials: [
    {
      id: 'pal-alb', name: 'PAL alb W980', kind: 'PAL', thicknessMm: 18,
      sheetLengthMm: 2800, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SHEET', pricePerSheet: 260 },
    },
    {
      id: 'pfl-alb', name: 'PFL alb', kind: 'PFL', thicknessMm: 3,
      sheetLengthMm: 2850, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SHEET', pricePerSheet: 100 },
    },
    {
      id: 'mdf-vopsit', name: 'MDF vopsit mat', kind: 'MDF_VOPSIT', thicknessMm: 18,
      sheetLengthMm: 2800, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SQM', pricePerSqm: 450 },
    },
  ],
  edgeBands: [
    { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1 },
    { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2 },
  ],
};

export function bazaInput(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return {
    label: 'B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: 'pal-alb',
    frontMaterialId: 'mdf-vopsit',
    back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: null },
    ...overrides,
  };
}

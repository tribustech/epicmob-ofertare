import type { CabinetInput } from '@/lib/engine';
import type { SnapshotData } from '../compute';

export function makeSnapshot(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    takenAt: '2026-07-11T00:00:00.000Z',
    materials: [
      { id: 'pal-alb', name: 'PAL alb', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null, active: true },
      { id: 'pfl-alb', name: 'PFL alb', kind: 'PFL', thicknessMm: 3, sheetLengthMm: 2850, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 100, pricePerSqm: null, active: true },
      { id: 'mdf-vopsit', name: 'MDF vopsit', kind: 'MDF_VOPSIT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450, active: true },
    ],
    edgeBands: [
      { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1, active: true },
      { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2, active: true },
    ],
    hardware: [
      { id: 'blum-cliptop', name: 'Balama Blum', category: 'BALAMA', pricePerUnit: 15, nominalLengthMm: null, loadClassKg: null, active: true },
      { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10, nominalLengthMm: null, loadClassKg: null, active: true },
      { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2, nominalLengthMm: null, loadClassKg: null, active: true },
    ],
    // deliberat nesortate — computeCosts le sortează
    cuttingRates: [
      { maxThicknessMm: 32, pricePerSheet: 50 },
      { maxThicknessMm: 10, pricePerSheet: 33 },
    ],
    settings: {
      sheetYieldFactor: 0.8, constructionJson: '{}',
      cutKerfMm: 4, cutTrimMm: 10,
      defaultHingeId: 'blum-cliptop', defaultHandleId: 'maner-std',
      defaultLegId: 'picior-std', defaultRailId: null,
    },
    ...overrides,
  };
}

export function refCabinet(): CabinetInput {
  return {
    label: 'B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: 'pal-alb', frontMaterialId: 'mdf-vopsit',
    back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: null },
  };
}

import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import type {
  BoardMaterial, ConstructionConstants, CostCatalogs,
  EdgeBand, HardwareCategory, HardwareDefaults, HardwareItem, MaterialKind,
} from '@/lib/engine';

export interface MaterialRow {
  id: string; name: string; kind: string; thicknessMm: number;
  sheetLengthMm: number; sheetWidthMm: number;
  pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
}
export interface EdgeBandRow { id: string; name: string; thicknessMm: number; pricePerMl: number }
export interface HardwareRow {
  id: string; name: string; category: string; pricePerUnit: number;
  nominalLengthMm: number | null; loadClassKg: number | null;
  boxHeightMm: number | null;
}
export interface CuttingRateRow { maxThicknessMm: number; pricePerSheet: number }
export interface SettingsRow {
  laborPct?: number | null; sheetYieldFactor: number; constructionJson: string;
  // opționale: snapshot-urile înghețate dinainte de nesting nu le au
  cutKerfMm?: number | null; cutTrimMm?: number | null;
  profilJPerFront?: number | null; golaPricePerMl?: number | null;
  defaultHingeId: string | null; defaultHandleId: string | null;
  defaultLegId: string | null; defaultRailId: string | null;
}

const MATERIAL_KINDS: MaterialKind[] = ['PAL', 'MDF_VOPSIT', 'MDF_MELAMINAT', 'MDF_INFOLIAT', 'PFL'];
const HARDWARE_CATEGORIES: HardwareCategory[] = ['BALAMA', 'SERTAR', 'MANER', 'PICIOR', 'SINA_SUSPENDARE', 'ACCESORIU'];

export function toBoardMaterial(row: MaterialRow): BoardMaterial {
  if (!MATERIAL_KINDS.includes(row.kind as MaterialKind)) {
    throw new Error(`Tip de material necunoscut: ${row.kind} (${row.name})`);
  }
  let pricing: BoardMaterial['pricing'];
  if (row.pricingMode === 'PER_SHEET') {
    if (row.pricePerSheet == null) throw new Error(`Materialul ${row.name} nu are preț per foaie`);
    pricing = { mode: 'PER_SHEET', pricePerSheet: row.pricePerSheet };
  } else if (row.pricingMode === 'PER_SQM') {
    if (row.pricePerSqm == null) throw new Error(`Materialul ${row.name} nu are preț per m²`);
    pricing = { mode: 'PER_SQM', pricePerSqm: row.pricePerSqm };
  } else {
    throw new Error(`Mod de preț necunoscut: ${row.pricingMode} (${row.name})`);
  }
  return {
    id: row.id, name: row.name, kind: row.kind as MaterialKind,
    thicknessMm: row.thicknessMm, sheetLengthMm: row.sheetLengthMm, sheetWidthMm: row.sheetWidthMm,
    pricing,
  };
}

function toEdgeBand(row: EdgeBandRow): EdgeBand {
  return { id: row.id, name: row.name, thicknessMm: row.thicknessMm, pricePerMl: row.pricePerMl };
}

function toHardwareItem(row: HardwareRow): HardwareItem {
  if (!HARDWARE_CATEGORIES.includes(row.category as HardwareCategory)) {
    throw new Error(`Categorie de feronerie necunoscută: ${row.category} (${row.name})`);
  }
  return {
    id: row.id, name: row.name, category: row.category as HardwareCategory,
    pricePerUnit: row.pricePerUnit,
    nominalLengthMm: row.nominalLengthMm ?? undefined,
    loadClassKg: row.loadClassKg ?? undefined,
    boxHeightMm: row.boxHeightMm ?? undefined,
  };
}

export function toCostCatalogs(
  materials: MaterialRow[],
  edgeBands: EdgeBandRow[],
  hardware: HardwareRow[],
  cuttingRates: CuttingRateRow[],
): CostCatalogs {
  return {
    materials: materials.map(toBoardMaterial),
    edgeBands: edgeBands.map(toEdgeBand),
    hardware: hardware.map(toHardwareItem),
    cuttingRates: [...cuttingRates]
      .sort((a, b) => a.maxThicknessMm - b.maxThicknessMm)
      .map((c) => ({ maxThicknessMm: c.maxThicknessMm, pricePerSheet: c.pricePerSheet })),
  };
}

export function buildHardwareDefaults(hardware: HardwareRow[], settings: SettingsRow): HardwareDefaults {
  const slideIdsByNominal: Record<number, string> = {};
  const cheapest: Record<number, number> = {};
  for (const h of hardware) {
    // seturile Tandembox se rezolvă pe boxHeightMm, nu pe nominala implicită
    if (h.category !== 'SERTAR' || h.nominalLengthMm == null || h.boxHeightMm != null) continue;
    const nominal = h.nominalLengthMm;
    if (slideIdsByNominal[nominal] === undefined || h.pricePerUnit < cheapest[nominal]) {
      slideIdsByNominal[nominal] = h.id;
      cheapest[nominal] = h.pricePerUnit;
    }
  }
  if (!settings.defaultHingeId) throw new Error('Setările nu au o balama implicită configurată');
  return {
    hingeId: settings.defaultHingeId,
    slideIdsByNominal,
    handleId: settings.defaultHandleId,
    legId: settings.defaultLegId,
    railId: settings.defaultRailId,
  };
}

export function parseConstruction(json: string): ConstructionConstants {
  const parsed = JSON.parse(json) as Partial<ConstructionConstants>;
  return { ...DEFAULT_CONSTRUCTION, ...parsed };
}

import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
  type CuttingRateRow, type EdgeBandRow, type HardwareRow,
  type LaborRateRow, type MaterialRow, type SettingsRow,
} from '@/lib/catalog/convert';
import {
  aggregateHardware, computeCosts, cutListCsv, expandCabinet, resolveSuggestions,
} from '@/lib/engine';
import type {
  CabinetInput, CostResult, CutListFile, ExpandedCabinet, FreeLine,
  HardwareLine, HardwareSuggestion, HardwareSummaryRow, Part, Warning,
} from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { pickLegId } from './legs';

export interface SnapshotData {
  takenAt: string;
  materials: (MaterialRow & { active: boolean })[];
  edgeBands: (EdgeBandRow & { active: boolean })[];
  hardware: (HardwareRow & { active: boolean })[];
  cuttingRates: CuttingRateRow[];
  laborRates: LaborRateRow[];
  settings: SettingsRow;
}

export interface QuoteCabinet {
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
  legHeightMm?: number | null;
}

export interface QuoteInput {
  markupPct: number;
  yieldFactor: number;
  freeLines: FreeLine[];
  cabinets: QuoteCabinet[];
}

export interface QuoteResult {
  costs: CostResult;
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  hardwareSummary: HardwareSummaryRow[];
  cutList: CutListFile[];
  warnings: Warning[];
  cabinets: ExpandedCabinet[];
}

export function computeQuote(q: QuoteInput, snap: SnapshotData): QuoteResult {
  // catalogul de cost include TOATE rândurile — snapshot-urile vechi nu aruncă la referințe dezactivate
  const catalogs = toCostCatalogs(snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, snap.laborRates);
  // sugestiile implicite folosesc doar feroneria activă
  const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
  const cc = parseConstruction(snap.settings.constructionJson);

  const expanded = q.cabinets.map((c) => expandCabinet(c.input, catalogs, cc));

  const parts: Part[] = expanded.flatMap((e) => e.parts);
  for (const c of q.cabinets) {
    for (const p of c.extraParts) {
      parts.push({
        cabinetLabel: c.input.label, name: p.name,
        lengthMm: p.lengthMm, widthMm: p.widthMm, qty: p.qty,
        materialId: p.materialId, edges: {},
      });
    }
  }

  const byId = new Map<string, number>();
  const unresolvedHardware: HardwareSuggestion[] = [];
  expanded.forEach((e, i) => {
    let lines: HardwareLine[];
    const overrides = q.cabinets[i].hardwareOverrides;
    if (overrides) {
      lines = overrides;
    } else {
      const legHeightMm = q.cabinets[i].legHeightMm;
      const cabinetDefaults = legHeightMm != null
        ? { ...defaults, legId: pickLegId(snap.hardware, legHeightMm, defaults.legId) }
        : defaults;
      const r = resolveSuggestions(e.hardware, cabinetDefaults);
      unresolvedHardware.push(...r.unresolved);
      lines = r.lines;
    }
    for (const line of lines) byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  });
  const hardwareLines: HardwareLine[] = [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty }));

  const costs = computeCosts({
    parts,
    hardwareLines,
    cabinets: q.cabinets.map((c) => c.input),
    freeLines: q.freeLines,
    markupPct: q.markupPct,
    yieldFactor: q.yieldFactor,
    catalogs,
  });

  return {
    costs,
    parts,
    hardwareLines,
    unresolvedHardware,
    hardwareSummary: aggregateHardware(hardwareLines, catalogs.hardware),
    cutList: cutListCsv(parts, catalogs),
    warnings: expanded.flatMap((e) => e.warnings),
    cabinets: expanded,
  };
}

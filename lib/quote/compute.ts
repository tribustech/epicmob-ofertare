import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
  type CuttingRateRow, type EdgeBandRow, type HardwareRow,
  type MaterialRow, type SettingsRow,
} from '@/lib/catalog/convert';
import {
  aggregateHardware, computeCosts, cutListCsv, DEFAULT_NEST_PARAMS, expandCabinet, resolveSuggestions,
} from '@/lib/engine';
import type {
  CabinetInput, CostResult, CutListFile, ExpandedCabinet, FreeLine,
  HardwareLine, HardwareSuggestion, HardwareSummaryRow, NestParams, Part, Warning,
} from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { handleExtraCost, withResolvedHandle, type ProjectHandle } from './handle';
import { pickLegId } from './legs';

export interface SnapshotData {
  takenAt: string;
  materials: (MaterialRow & { active: boolean })[];
  edgeBands: (EdgeBandRow & { active: boolean })[];
  hardware: (HardwareRow & { active: boolean })[];
  cuttingRates: CuttingRateRow[];
  settings: SettingsRow;
}

export interface QuoteCabinet {
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
  legHeightMm?: number | null;
}

export interface QuoteInput {
  laborPct: number;
  freeLines: FreeLine[];
  cabinets: QuoteCabinet[];
  projectHandle: ProjectHandle;
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
  const catalogs = toCostCatalogs(snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates);
  // sugestiile implicite folosesc doar feroneria activă
  const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
  const cc = parseConstruction(snap.settings.constructionJson);

  const inputs = q.cabinets.map((c) => withResolvedHandle(c.input, q.projectHandle));
  const expanded = inputs.map((input) => expandCabinet(input, catalogs, cc));

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
      const r = resolveSuggestions(e.hardware, cabinetDefaults, catalogs.hardware);
      unresolvedHardware.push(...r.unresolved);
      lines = r.lines;
    }
    for (const line of lines) byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  });
  const hardwareLines: HardwareLine[] = [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty }));

  // snapshot-urile înghețate dinainte de nesting nu au kerf/trim — cad pe default-uri
  const nesting: NestParams = {
    kerfMm: snap.settings.cutKerfMm ?? DEFAULT_NEST_PARAMS.kerfMm,
    trimMm: snap.settings.cutTrimMm ?? DEFAULT_NEST_PARAMS.trimMm,
  };

  const handlePrices = {
    profilJPerFront: snap.settings.profilJPerFront ?? 0,
    golaPricePerMl: snap.settings.golaPricePerMl ?? 0,
  };
  const extraHardware = inputs.flatMap((input) => handleExtraCost(input, handlePrices));

  const costs = computeCosts({
    parts,
    hardwareLines,
    cabinets: inputs,
    freeLines: q.freeLines,
    laborPct: q.laborPct,
    nesting,
    catalogs,
    extraHardware,
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

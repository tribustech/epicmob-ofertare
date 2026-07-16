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
  FrontModel, FrontPrice, FrontSupplier, HardwareAdjustments,
  HardwareLine, HardwareSuggestion, HardwareSummaryRow, NestParams, Part, Warning,
} from '@/lib/engine';
import { computeBlat, type BlatResult } from '@/lib/engine';
import { isCabinetInputComplete, type ExtraPart } from './cabinet-form';
import { handleExtraCost, withResolvedHandle, type ProjectHandle } from './handle';
import { pickLegId } from './legs';

export interface SnapshotData {
  takenAt: string;
  materials: (MaterialRow & { active: boolean })[];
  edgeBands: (EdgeBandRow & { active: boolean })[];
  hardware: (HardwareRow & { active: boolean })[];
  cuttingRates: CuttingRateRow[];
  // catalog fronturi MDF vopsit (Prisma rows, structural compatibile cu tipurile motorului);
  // settings.eurToRon poartă cursul EUR→RON
  frontSuppliers: FrontSupplier[];
  frontModels: FrontModel[];
  frontPrices: FrontPrice[];
  settings: SettingsRow;
}

// Catalogul de fronturi MDF vopsit împachetat pentru toCostCatalogs (al 5-lea argument).
export function frontCatalogsFromSnapshot(snap: SnapshotData) {
  return {
    suppliers: snap.frontSuppliers,
    models: snap.frontModels,
    prices: snap.frontPrices,
    eurToRon: snap.settings.eurToRon ?? 1,
  };
}

export interface QuoteCabinet {
  id?: string;
  input: CabinetInput;
  hardwareAdjustments: HardwareAdjustments | null;
  extraParts: ExtraPart[];
  legHeightMm?: number | null;
}

/** Problemele unui corp, grupate pentru afișare (link în Rezumat + badge pe rând). */
export interface CabinetIssue {
  cabinetId: string;
  label: string;
  incomplete: boolean;                      // input needitat — nu intră în calcul
  unresolvedHardware: HardwareSuggestion[]; // feronerie fără produs ales
  warnings: Warning[];                      // alte avertismente de expansiune
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
  cabinetIssues: CabinetIssue[];
  cabinets: ExpandedCabinet[];
}

export function computeQuote(qAll: QuoteInput, snap: SnapshotData): QuoteResult {
  // corpurile incomplete (abia create, needitate) NU intră în calcul — doar avertisment
  const incomplete = qAll.cabinets.filter((c) => !isCabinetInputComplete(c.input));
  const q: QuoteInput = { ...qAll, cabinets: qAll.cabinets.filter((c) => isCabinetInputComplete(c.input)) };
  const incompleteWarnings: Warning[] = incomplete.map((c) => ({
    code: 'INCOMPLETE_CABINET',
    message: 'corp incomplet — nu intră în calcul; deschide-l și completează-l',
    cabinetLabel: c.input.label,
  }));

  // catalogul de cost include TOATE rândurile — snapshot-urile vechi nu aruncă la referințe dezactivate
  const catalogs = toCostCatalogs(
    snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, frontCatalogsFromSnapshot(snap),
  );
  // sugestiile implicite folosesc doar feroneria activă
  const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
  const cc = parseConstruction(snap.settings.constructionJson);

  // blaturile NU trec prin motorul de carcasă — au propriul calcul (plăci + debitare)
  const normal = q.cabinets.filter((c) => c.input.type !== 'BLAT');
  const blatCabinets = q.cabinets.filter((c) => c.input.type === 'BLAT');
  const blatCutPricePerPiece = snap.settings.blatCutPricePerPiece ?? 35;
  const blats = blatCabinets.map((c) => {
    const material = catalogs.materials.find((m) => m.id === c.input.blat?.materialId);
    const result = material
      ? computeBlat({
          label: c.input.label,
          lengthMm: c.input.widthMm,
          depthMm: c.input.depthMm,
          material,
          manualPieces: c.input.blat?.manualPieces,
          cutPricePerPiece: blatCutPricePerPiece,
        })
      : null;
    return { cabinet: c, result };
  });
  const blatResults = blats.map((b) => b.result).filter((r): r is BlatResult => r !== null);

  const inputs = normal.map((c) => withResolvedHandle(c.input, q.projectHandle));
  const expanded = inputs.map((input) => expandCabinet(input, catalogs, cc));

  const parts: Part[] = expanded.flatMap((e) => e.parts);
  for (const c of normal) {
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
  const unresolvedByCabinet: HardwareSuggestion[][] = expanded.map(() => []);
  expanded.forEach((e, i) => {
    const legHeightMm = normal[i].legHeightMm;
    const cabinetDefaults = legHeightMm != null
      ? { ...defaults, legId: pickLegId(snap.hardware, legHeightMm, defaults.legId) }
      : defaults;
    const r = resolveSuggestions(e.hardware, normal[i].hardwareAdjustments, cabinetDefaults, catalogs.hardware);
    unresolvedHardware.push(...r.unresolved);
    unresolvedByCabinet[i] = r.unresolved;
    for (const line of r.lines) byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  });
  const hardwareLines: HardwareLine[] = [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty }));

  // probleme per corp: incomplete + feronerie nerezolvată + avertismente de expansiune,
  // păstrând ordinea originală a corpurilor din proiect
  const issueByCabinet = new Map<string, CabinetIssue>();
  for (const c of incomplete) {
    issueByCabinet.set(c.id ?? '', {
      cabinetId: c.id ?? '', label: c.input.label,
      incomplete: true, unresolvedHardware: [], warnings: [],
    });
  }
  normal.forEach((c, i) => {
    const uh = unresolvedByCabinet[i];
    const ws = expanded[i].warnings;
    if (uh.length === 0 && ws.length === 0) return;
    issueByCabinet.set(c.id ?? '', {
      cabinetId: c.id ?? '', label: c.input.label,
      incomplete: false, unresolvedHardware: uh, warnings: ws,
    });
  });
  // blaturi: avertismentul „adâncime peste lățimea plăcii" devine problemă pe rând
  for (const b of blats) {
    if (!b.result || b.result.warnings.length === 0) continue;
    issueByCabinet.set(b.cabinet.id ?? '', {
      cabinetId: b.cabinet.id ?? '', label: b.cabinet.input.label,
      incomplete: false, unresolvedHardware: [], warnings: b.result.warnings,
    });
  }
  const cabinetIssues = qAll.cabinets
    .map((c) => issueByCabinet.get(c.id ?? ''))
    .filter((x): x is CabinetIssue => x !== undefined);

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
    blats: blatResults,
  });

  return {
    costs,
    parts,
    hardwareLines,
    unresolvedHardware,
    hardwareSummary: aggregateHardware(hardwareLines, catalogs.hardware),
    cutList: cutListCsv(parts, catalogs),
    warnings: [...incompleteWarnings, ...expanded.flatMap((e) => e.warnings), ...blatResults.flatMap((r) => r.warnings)],
    cabinetIssues,
    cabinets: expanded,
  };
}

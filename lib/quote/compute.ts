import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
  type CuttingRateRow, type EdgeBandRow, type HardwareRow,
  type MaterialRow, type SettingsRow,
} from '@/lib/catalog/convert';
import {
  aggregateHardware, computeCosts, cutListCsv, DEFAULT_NEST_PARAMS, expandCabinet, nestParts, resolveSuggestions,
} from '@/lib/engine';
import type {
  CabinetInput, CostResult, CutListFile, ExpandedCabinet, FreeLine,
  FrontModel, FrontPrice, FrontSupplier, HardwareAdjustments,
  HardwareLine, HardwareSuggestion, HardwareSummaryRow, NestParams, Part, PartEdges, Warning,
} from '@/lib/engine';
import { computeBlat, type BlatResult } from '@/lib/engine';
import { isCabinetInputComplete, type ExtraPart } from './cabinet-form';
import { handleExtraCost, withResolvedHandle, type ProjectHandle } from './handle';
import { pickLegId } from './legs';
import { buildPlinthParts, type PlinthAssembly } from './plinth';

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
  assemblyId?: string | null;
  plinthEnabled?: boolean;
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

/** Placă liberă adăugată direct pe proiect (fără corp): material + dimensiuni + bucăți + cant opțional.
 *  Intră în calcul ca piesă normală — se așază pe plăci împreună cu restul și se cotează din catalog.
 *  edgeMode: laturile cu cant — L1 = o latură lungă, L2 = ambele lungi, ALL = jur-împrejur (4). */
export interface LoosePanel {
  name?: string;
  materialId: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  edgeBandId?: string;
  edgeMode?: 'NONE' | 'L1' | 'L2' | 'ALL';
}

/** Muchiile cu cant ale unei plăci libere (l = laturi lungi, w = laturi scurte), doar dacă
 *  banda există în catalog și modul nu e „fără". */
function loosePanelEdges(lp: LoosePanel, edgeBandIds: Set<string>): PartEdges {
  const band = lp.edgeBandId;
  const mode = lp.edgeMode ?? 'NONE';
  if (!band || mode === 'NONE' || !edgeBandIds.has(band)) return {};
  const edges: PartEdges = { l1: band };
  if (mode === 'L2' || mode === 'ALL') edges.l2 = band;
  if (mode === 'ALL') { edges.w1 = band; edges.w2 = band; }
  return edges;
}

export interface QuoteInput {
  laborPct: number;
  freeLines: FreeLine[];
  loosePanels?: LoosePanel[];
  cabinets: QuoteCabinet[];
  assemblies?: PlinthAssembly[];
  projectHandle: ProjectHandle;
}

export interface QuoteResult {
  costs: CostResult;
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  hardwareSummary: HardwareSummaryRow[];
  cutList: CutListFile[];
  glassFrontList: CutListFile[];
  glassShelfList: CutListFile[];
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
  // parametri de așezare (kerf/trim) — folosiți la nesting-ul blaturilor și al pieselor de carcasă
  const nesting: NestParams = {
    kerfMm: snap.settings.cutKerfMm ?? DEFAULT_NEST_PARAMS.kerfMm,
    trimMm: snap.settings.cutTrimMm ?? DEFAULT_NEST_PARAMS.trimMm,
  };

  // per-blat (doar pentru avertismente: adâncime peste placă) + păstrat pentru calculul cantului
  const blats = blatCabinets.map((c) => {
    const material = catalogs.materials.find((m) => m.id === c.input.blat?.materialId);
    const result = material
      ? computeBlat({
          label: c.input.label, lengthMm: c.input.widthMm, depthMm: c.input.depthMm,
          material, manualPieces: c.input.blat?.manualPieces, cutPricePerPiece: blatCutPricePerPiece,
        })
      : null;
    return { cabinet: c, result };
  });
  const blatWarnings = blats.flatMap((b) => b.result?.warnings ?? []);

  // COST corect: blaturile din ACELAȘI material se așază ÎMPREUNĂ pe plăci partajate (nesting
  // guillotine), nu fiecare pe placa lui. Un rezultat agregat per material.
  const blatByMaterial = new Map<string, typeof blatCabinets>();
  for (const c of blatCabinets) {
    const mid = c.input.blat?.materialId;
    if (!mid || !catalogs.materials.some((m) => m.id === mid)) continue;
    const list = blatByMaterial.get(mid) ?? [];
    list.push(c);
    blatByMaterial.set(mid, list);
  }
  const blatResults: BlatResult[] = [];
  for (const [materialId, cabs] of blatByMaterial) {
    const material = catalogs.materials.find((m) => m.id === materialId)!;
    const totalAreaSqm = cabs.reduce((s, c) => s + (c.input.widthMm / 1000) * (c.input.depthMm / 1000), 0);
    if (material.pricing.mode === 'PER_SQM') {
      const cuttingPieces = cabs.reduce((s, c) => s + Math.ceil(c.input.widthMm / material.sheetLengthMm), 0);
      blatResults.push({
        materialId, pieces: cabs.length, fitsOnDepth: true, totalAreaSqm,
        boughtAreaSqm: totalAreaSqm, wastePct: null, sheets: null,
        boardCost: totalAreaSqm * material.pricing.pricePerSqm,
        cuttingCost: cuttingPieces * blatCutPricePerPiece, warnings: [],
      });
      continue;
    }
    // PER_SHEET: taie fiecare blat în segmente ≤ lungimea utilă a plăcii, apoi le așază împreună.
    // Blaturile mai adânci decât placa nu se pot așeza → cad pe nr. manual de plăci.
    const usableL = material.sheetLengthMm - 2 * nesting.trimMm;
    const usableW = material.sheetWidthMm - 2 * nesting.trimMm;
    const pieces: { label: string; lengthMm: number; widthMm: number }[] = [];
    let manualSheets = 0;
    for (const c of cabs) {
      if (c.input.depthMm > usableW) { manualSheets += Math.max(0, Math.floor(c.input.blat?.manualPieces ?? 0)); continue; }
      let remaining = c.input.widthMm, idx = 0;
      while (remaining > 0.5) {
        const seg = Math.min(remaining, usableL);
        pieces.push({ label: `${c.input.label} ${idx + 1}`, lengthMm: seg, widthMm: c.input.depthMm });
        remaining -= seg; idx++;
      }
    }
    const nestedSheets = pieces.length > 0 ? nestParts(pieces, material.sheetLengthMm, material.sheetWidthMm, nesting).sheets.length : 0;
    const sheets = nestedSheets + manualSheets;
    const boughtAreaSqm = sheets * (material.sheetLengthMm / 1000) * (material.sheetWidthMm / 1000);
    blatResults.push({
      materialId, pieces: sheets, fitsOnDepth: manualSheets === 0, totalAreaSqm, boughtAreaSqm,
      wastePct: boughtAreaSqm > 0 ? Math.max(0, (1 - totalAreaSqm / boughtAreaSqm) * 100) : null,
      sheets, boardCost: sheets * material.pricing.pricePerSheet,
      cuttingCost: sheets * blatCutPricePerPiece, warnings: [],
    });
  }

  // cantul blatului: ABS 2mm automat, pe muchia frontală (FRONT) sau frontal + 2 capete (FRONT_SIDES);
  // metri = lungime (+ 2×adâncime la insulă). Se cotează separat, blatul nefiind piesă de carcasă.
  // banda de cant blat: cea aleasă în Setări (blatEdgeBandId), altfel prima ABS de 2mm
  const blatCantBand = catalogs.edgeBands.find((b) => b.id === snap.settings.blatEdgeBandId)
    ?? catalogs.edgeBands.find((b) => b.thicknessMm === 2);
  const blatCantByBand = new Map<string, number>();
  const blatCantWarnings: Warning[] = [];
  for (const b of blats) {
    if (!b.result) continue;
    const mode = b.cabinet.input.blat?.cantMode ?? 'FRONT';
    if (mode === 'NONE') continue;
    const len = b.cabinet.input.widthMm, dep = b.cabinet.input.depthMm;
    const ml = (mode === 'FRONT_SIDES' ? len + 2 * dep : len) / 1000;
    if (!blatCantBand) {
      blatCantWarnings.push({ code: 'BLAT_CANT_NO_BAND', message: 'lipsește un cant ABS 2mm în catalog — cantul blatului nu a fost cotat', cabinetLabel: b.cabinet.input.label });
      continue;
    }
    blatCantByBand.set(blatCantBand.id, (blatCantByBand.get(blatCantBand.id) ?? 0) + ml);
  }
  const extraEdging = [...blatCantByBand.entries()].map(([edgeBandId, totalMl]) => ({ edgeBandId, totalMl }));

  const inputs = normal.map((c) => withResolvedHandle(c.input, q.projectHandle));
  const expanded = inputs.map((input, i) => expandCabinet(input, catalogs, cc, normal[i].legHeightMm ?? undefined));

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
  // plăci libere de proiect (fără corp): intră ca piese normale → cotate din catalog + în debitare;
  // cantul opțional intră automat în metrii de cant (aceleași bănzi ca restul)
  const edgeBandIds = new Set(catalogs.edgeBands.map((b) => b.id));
  for (const lp of q.loosePanels ?? []) {
    const label = lp.name?.trim() || 'Placă liberă';
    parts.push({
      cabinetLabel: label, name: label,
      lengthMm: lp.lengthMm, widthMm: lp.widthMm, qty: Math.max(1, Math.trunc(lp.qty)),
      materialId: lp.materialId, edges: loosePanelEdges(lp, edgeBandIds),
    });
  }
  parts.push(...buildPlinthParts({
    assemblies: q.assemblies ?? [],
    cabinets: q.cabinets.map((c) => ({
      id: c.id ?? '',
      assemblyId: c.assemblyId ?? null,
      plinthEnabled: c.plinthEnabled ?? false,
      input: c.input,
    })),
  }));

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

  const handlePrices = {
    profilJPerFront: snap.settings.profilJPerFront ?? 0,
    golaPricePerMl: snap.settings.golaPricePerMl ?? 0,
  };
  const extraHardware = inputs.flatMap((input) => handleExtraCost(input, handlePrices));

  // supra-costuri pe rotund: fiecare poliță cu colț rotunjit are (a) debitare pe rotund și
  // (b) cant pe rotund — ambele forfetar per poliță, din Setări
  const roundedPieceCount = expanded.reduce(
    (sum, e) => sum + e.pieces.filter((p) => p.shape).length, 0,
  );
  const extraCutting = roundedPieceCount * (snap.settings.roundedCutPricePerPiece ?? 0);
  const roundedEdgeFlat = roundedPieceCount * (snap.settings.roundedEdgePricePerPiece ?? 0);

  const costs = computeCosts({
    parts,
    hardwareLines,
    cabinets: inputs,
    freeLines: q.freeLines,
    laborPct: q.laborPct,
    nesting,
    catalogs,
    extraHardware,
    extraCutting,
    extraEdging,
    extraEdgingFlat: roundedEdgeFlat,
    blats: blatResults,
  });
  const glassFrontMaterialIds = new Set(
    catalogs.materials.filter((material) => material.kind === 'STICLA_RAMA').map((material) => material.id),
  );
  const glassShelfMaterialIds = new Set(
    catalogs.materials.filter((material) => material.kind === 'STICLA_POLITA').map((material) => material.id),
  );
  const glassFrontParts = parts.filter((part) => glassFrontMaterialIds.has(part.materialId));
  const glassShelfParts = parts.filter((part) => glassShelfMaterialIds.has(part.materialId));
  const workshopParts = parts.filter((part) =>
    !glassFrontMaterialIds.has(part.materialId) && !glassShelfMaterialIds.has(part.materialId));

  return {
    costs,
    parts,
    hardwareLines,
    unresolvedHardware,
    hardwareSummary: aggregateHardware(hardwareLines, catalogs.hardware),
    cutList: cutListCsv(workshopParts, catalogs),
    glassFrontList: cutListCsv(glassFrontParts, catalogs),
    glassShelfList: cutListCsv(glassShelfParts, catalogs),
    warnings: [...incompleteWarnings, ...expanded.flatMap((e) => e.warnings), ...blatWarnings, ...blatCantWarnings],
    cabinetIssues,
    cabinets: expanded,
  };
}

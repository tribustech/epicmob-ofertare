import { frontVopsitCostEur, ralIsBlack } from '../quote/front-pricing';
import type { BlatResult } from './blat';
import { findMaterial } from './carcass';
import { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
import type { NestParams } from './nesting';
import type {
  CabinetInput, Catalogs, CuttingRate, FreeLine,
  HardwareItem, HardwareLine, Part,
} from './types';

export interface FrontSupplier {
  id: string;
  handleMillingEur: number;
  vividSurchargeEur: number;
  metallicSurchargeEur: number;
  blackGlossEurPerFace: number;
}

export interface FrontModel {
  id: string;
  tier: string;
  hasHandleMilling: boolean;
  // metadate afișabile (din catalogul Prisma) — nu intervin în costing
  code?: string;
  name?: string;
}

export interface FrontPrice {
  supplierId: string;
  tier: string;
  finish: string;
  faces: number;
  thicknessMm: number;
  pricePerSqmEur: number;
}

export interface CostCatalogs extends Catalogs {
  hardware: HardwareItem[];
  cuttingRates: CuttingRate[];
  // fronturi MDF vopsit: catalog de furnizori/modele/prețuri per m² în EUR + curs EUR→RON
  frontSuppliers: FrontSupplier[];
  frontModels: FrontModel[];
  frontPrices: FrontPrice[];
  eurToRon: number;
}

// numele pieselor de front produse de expandFronts — le identificăm ca să le
// scoatem din costul de placă/cant și să le cotăm separat pe fronturi vopsite
export const FRONT_PART_NAMES = new Set(['Ușă', 'Front sertar', 'Front fals']);
// piesele vizibile de carcasă — cotate per m² când carcasa e MDF vopsit
export const CARCASS_VOPSIT_PART_NAMES = new Set(['Laterală', 'Blat corp', 'Fund corp', 'Poliță', 'Despărțitor', 'Pazie', 'Separator vertical']);
// doar ușile și fronturile de sertar poartă mâner (contează la frezare); frontul fals nu
export const HANDLE_FRONT_PART_NAMES = new Set(['Ușă', 'Front sertar']);
export const FRONT_THICKNESS_MM = 18;

export interface CostBreakdown {
  boards: number;
  edging: number;
  cuttingService: number;
  hardware: number;
  labor: number;
  freeLines: number;
}

export interface CostResult {
  breakdown: CostBreakdown;
  totalCost: number;
  sellPrice: number;
  needs: { boards: BoardNeed[]; edging: EdgingNeed[] };
  // avertizări neblocante (ex. „preț la cerere" pentru un front vopsit fără cotă în catalog)
  warnings?: string[];
}

export function computeCosts(args: {
  parts: Part[];
  hardwareLines: HardwareLine[];
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  laborPct: number;
  nesting: NestParams;
  catalogs: CostCatalogs;
  extraHardware?: FreeLine[];
  extraCutting?: number; // supra-cost debitare (ex. polițe cu colț rotunjit, tăiere pe rotund)
  extraEdging?: { edgeBandId: string; totalMl: number }[]; // cant suplimentar (ex. blat) — se unește în necesar
  extraEdgingFlat?: number; // cant cotat forfetar (ex. cant pe rotund, lei/poliță) — nu are metri de bandă
  blats?: BlatResult[]; // blaturi deja calculate (nu trec prin motorul de carcasă)
}): CostResult {
  const { catalogs } = args;
  const warnings: string[] = [];

  // Fronturi MDF vopsit: se cotează per m² (EUR × curs), NU din catalogul de plăci.
  // Piesele lor de front se scot din nevoile de placă/cant și se calculează separat.
  const vopsitCabinets = args.cabinets.filter(
    (c) => c.frontKind === 'MDF_VOPSIT' && c.mdfFront,
  );
  const vopsitLabels = new Set(vopsitCabinets.map((c) => c.label));
  const isVopsitFrontPart = (p: Part) =>
    vopsitLabels.has(p.cabinetLabel) && FRONT_PART_NAMES.has(p.name);

  // Carcasă MDF vopsit: piesele de carcasă (nu fronturile) se cotează per m², la fel ca fronturile.
  const carcassVopsitCabinets = args.cabinets.filter((c) => c.mdfCarcass);
  const carcassVopsitByLabel = new Map(carcassVopsitCabinets.map((c) => [c.label, c]));
  const isCarcassVopsitPart = (p: Part) => {
    const cab = carcassVopsitByLabel.get(p.cabinetLabel);
    return !!cab && CARCASS_VOPSIT_PART_NAMES.has(p.name) && p.materialId === cab.carcassMaterialId;
  };

  const boardParts = (vopsitLabels.size > 0 || carcassVopsitCabinets.length > 0)
    ? args.parts.filter((p) => !isVopsitFrontPart(p) && !isCarcassVopsitPart(p))
    : args.parts;
  const needs = computeMaterialNeeds(boardParts, catalogs, args.nesting);
  // catalogs.cuttingRates nu e garantat sortat de apelant — sortăm o copie crescător
  // pentru a găsi cel mai mic maxThicknessMm ≥ grosime.
  const rates = [...catalogs.cuttingRates].sort((a, b) => a.maxThicknessMm - b.maxThicknessMm);

  let boards = 0;
  let cuttingService = 0;
  for (const need of needs.boards) {
    const material = findMaterial(catalogs, need.materialId);
    if (material.pricing.mode === 'PER_SQM') {
      boards += need.totalAreaSqm * material.pricing.pricePerSqm;
    } else {
      const sheets = need.sheets ?? 0;
      boards += sheets * material.pricing.pricePerSheet;
      const rate = rates.find((r) => r.maxThicknessMm >= material.thicknessMm);
      if (rate) cuttingService += sheets * rate.pricePerSheet;
    }
  }

  // Blaturi: materialul de blat e o placă (intră la „boards"), iar debitarea per placă
  // la „cuttingService". Necesarul se agregă pe material și se adaugă la needs.boards
  // (materialele de blat nu apar în boardParts, deci nu se ciocnesc cu piesele normale).
  const blats = args.blats ?? [];
  if (blats.length > 0) {
    const usedByMaterial = new Map<string, number>();
    const boughtByMaterial = new Map<string, number>();
    const sheetsByMaterial = new Map<string, number | null>();
    for (const b of blats) {
      boards += b.boardCost;
      cuttingService += b.cuttingCost;
      usedByMaterial.set(b.materialId, (usedByMaterial.get(b.materialId) ?? 0) + b.totalAreaSqm);
      boughtByMaterial.set(b.materialId, (boughtByMaterial.get(b.materialId) ?? 0) + b.boughtAreaSqm);
      if (b.sheets !== null) {
        sheetsByMaterial.set(b.materialId, (sheetsByMaterial.get(b.materialId) ?? 0) + b.sheets);
      } else if (!sheetsByMaterial.has(b.materialId)) {
        sheetsByMaterial.set(b.materialId, null);
      }
    }
    for (const [materialId, used] of usedByMaterial) {
      const bought = boughtByMaterial.get(materialId) ?? used;
      const sheets = sheetsByMaterial.get(materialId) ?? null;
      // pierderea = ce cumperi peste ce folosești (ca la PAL: placa întreagă, restul e pierdere)
      const wastePct = sheets !== null && bought > 0 ? Math.max(0, (1 - used / bought) * 100) : null;
      needs.boards.push({ materialId, totalAreaSqm: used, sheets, wastePct, layout: null });
    }
  }

  // cant suplimentar (ex. cantul blatului — nu trece prin needs) → îl unim în needs.edging,
  // ca să intre atât în cost cât și în „Necesar de materiale"
  for (const ex of args.extraEdging ?? []) {
    if (ex.totalMl <= 0) continue;
    const found = needs.edging.find((e) => e.edgeBandId === ex.edgeBandId);
    if (found) found.totalMl += ex.totalMl;
    else needs.edging.push({ edgeBandId: ex.edgeBandId, totalMl: ex.totalMl });
  }

  let edging = args.extraEdgingFlat ?? 0; // cant forfetar (ex. cant pe rotund per poliță)
  for (const e of needs.edging) {
    const band = catalogs.edgeBands.find((b) => b.id === e.edgeBandId);
    if (!band) throw new Error(`Cant inexistent în catalog: ${e.edgeBandId}`);
    edging += e.totalMl * band.pricePerMl;
  }

  // Fronturi MDF vopsit: cotă per m² (EUR) × curs, adăugată la „boards".
  for (const cab of vopsitCabinets) {
    const mdf = cab.mdfFront!;
    const frontParts = args.parts.filter(
      (p) => p.cabinetLabel === cab.label && FRONT_PART_NAMES.has(p.name),
    );
    if (frontParts.length === 0) continue; // corp fără fronturi

    const areaSqm = frontParts.reduce(
      (s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0,
    );
    const frontCount = frontParts
      .filter((p) => HANDLE_FRONT_PART_NAMES.has(p.name))
      .reduce((s, p) => s + p.qty, 0);

    const model = catalogs.frontModels.find((m) => m.id === mdf.modelId);
    const supplier = catalogs.frontSuppliers.find((s) => s.id === mdf.supplierId);
    const price = model && catalogs.frontPrices.find(
      (pr) => pr.supplierId === mdf.supplierId && pr.tier === model.tier
        && pr.finish === mdf.finish && pr.faces === mdf.faces
        && pr.thicknessMm === FRONT_THICKNESS_MM,
    );

    if (!model || !supplier || !price) {
      // preț/model/furnizor lipsă → nu blocăm calculul: cotăm 0 și avertizăm
      warnings.push(`preț la cerere: ${mdf.modelId}`);
      continue;
    }

    const costEur = frontVopsitCostEur({
      areaSqm,
      frontCount,
      pricePerSqmEur: price.pricePerSqmEur,
      faces: mdf.faces,
      finish: mdf.finish,
      colorCategory: mdf.colorCategory,
      ralBlack: ralIsBlack(mdf.ralCode),
      hasHandleMilling: model.hasHandleMilling,
      supplier,
    });
    boards += costEur * catalogs.eurToRon;
  }

  // Carcasă MDF vopsit: aceeași cotare per m² (EUR × curs), fără frezare de mâner.
  for (const cab of carcassVopsitCabinets) {
    const mdf = cab.mdfCarcass!;
    const carcassParts = args.parts.filter(
      (p) => p.cabinetLabel === cab.label && CARCASS_VOPSIT_PART_NAMES.has(p.name) && p.materialId === cab.carcassMaterialId,
    );
    if (carcassParts.length === 0) continue;
    const areaSqm = carcassParts.reduce((s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0);
    const model = catalogs.frontModels.find((m) => m.id === mdf.modelId);
    const supplier = catalogs.frontSuppliers.find((s) => s.id === mdf.supplierId);
    const price = model && catalogs.frontPrices.find(
      (pr) => pr.supplierId === mdf.supplierId && pr.tier === model.tier
        && pr.finish === mdf.finish && pr.faces === mdf.faces
        && pr.thicknessMm === FRONT_THICKNESS_MM,
    );
    if (!model || !supplier || !price) { warnings.push(`preț la cerere carcasă: ${mdf.modelId}`); continue; }
    const costEur = frontVopsitCostEur({
      areaSqm, frontCount: 0, pricePerSqmEur: price.pricePerSqmEur,
      faces: mdf.faces, finish: mdf.finish, colorCategory: mdf.colorCategory,
      ralBlack: ralIsBlack(mdf.ralCode), hasHandleMilling: false, supplier,
    });
    boards += costEur * catalogs.eurToRon;
  }

  // supra-cost de debitare pe rotund (polițe cu colț rotunjit) — cost de atelier, intră la debitare
  cuttingService += args.extraCutting ?? 0;

  let hardware = 0;
  for (const line of args.hardwareLines) {
    const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
    hardware += line.qty * item.pricePerUnit;
  }

  // costuri de feronerie calculate în amonte (profil GOLA per ml, prelucrare profil J per front)
  for (const line of args.extraHardware ?? []) hardware += line.amount;

  const materialBase = boards + edging + cuttingService + hardware;
  // liniile libere marcate „în comision" intră în baza de manoperă; restul doar ca extra
  const freeCommission = args.freeLines.reduce((s, l) => s + (l.inCommission ? l.amount : 0), 0);
  const freeFlat = args.freeLines.reduce((s, l) => s + (l.inCommission ? 0 : l.amount), 0);
  const freeLines = freeCommission + freeFlat;
  // manopera atelierului: procent din material (inclusiv feronerie) + liniile comisionate; include profitul
  const labor = (materialBase + freeCommission) * (args.laborPct / 100);

  const breakdown: CostBreakdown = { boards, edging, cuttingService, hardware, labor, freeLines };
  // totalCost = ce plătește atelierul; sellPrice = ce facturează (diferența e manopera)
  const totalCost = materialBase + freeLines;
  const sellPrice = materialBase + labor + freeLines;

  return {
    breakdown, totalCost, sellPrice, needs,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

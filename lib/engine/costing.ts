import { frontVopsitCostEur, ralIsBlack } from '../quote/front-pricing';
import { findMaterial } from './carcass';
import { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
import type { NestParams } from './nesting';
import type {
  CabinetInput, CabinetType, Catalogs, CuttingRate, FreeLine,
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
const FRONT_PART_NAMES = new Set(['Ușă', 'Front sertar', 'Panou orb']);
// doar ușile și fronturile de sertar poartă mâner (contează la frezare); panoul orb nu
const HANDLE_FRONT_PART_NAMES = new Set(['Ușă', 'Front sertar']);
const FRONT_THICKNESS_MM = 18;

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
  leiPerMl: number | null;
  needs: { boards: BoardNeed[]; edging: EdgingNeed[] };
  // avertizări neblocante (ex. „preț la cerere" pentru un front vopsit fără cotă în catalog)
  warnings?: string[];
}

const BASE_RUN_TYPES = new Set<CabinetType>(['BAZA', 'COLT']);

export function computeCosts(args: {
  parts: Part[];
  hardwareLines: HardwareLine[];
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  laborPct: number;
  nesting: NestParams;
  catalogs: CostCatalogs;
  extraHardware?: FreeLine[];
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

  const boardParts = vopsitLabels.size > 0
    ? args.parts.filter((p) => !isVopsitFrontPart(p))
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

  let edging = 0;
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

  let hardware = 0;
  for (const line of args.hardwareLines) {
    const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
    hardware += line.qty * item.pricePerUnit;
  }

  // costuri de feronerie calculate în amonte (profil GOLA per ml, prelucrare profil J per front)
  for (const line of args.extraHardware ?? []) hardware += line.amount;

  const materialBase = boards + edging + cuttingService + hardware;
  // manopera atelierului: procent din tot materialul (inclusiv feronerie); include profitul
  const labor = materialBase * (args.laborPct / 100);
  const freeLines = args.freeLines.reduce((sum, l) => sum + l.amount, 0);

  const breakdown: CostBreakdown = { boards, edging, cuttingService, hardware, labor, freeLines };
  // totalCost = ce plătește atelierul; sellPrice = ce facturează (diferența e manopera)
  const totalCost = materialBase + freeLines;
  const sellPrice = materialBase + labor + freeLines;

  const baseRunM = args.cabinets
    .filter((c) => BASE_RUN_TYPES.has(c.type))
    .reduce((sum, c) => sum + c.widthMm, 0) / 1000;
  const leiPerMl = baseRunM > 0 ? sellPrice / baseRunM : null;

  return {
    breakdown, totalCost, sellPrice, leiPerMl, needs,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

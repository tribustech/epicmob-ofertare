import { findMaterial } from './carcass';
import { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
import type {
  CabinetInput, CabinetType, Catalogs, CuttingRate, FreeLine,
  HardwareItem, HardwareLine, Part,
} from './types';

export interface CostCatalogs extends Catalogs {
  hardware: HardwareItem[];
  cuttingRates: CuttingRate[];
  laborPerType: Record<CabinetType, number>;
}

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
}

const BASE_RUN_TYPES = new Set<CabinetType>(['BAZA', 'SERTARE', 'COLT']);

export function computeCosts(args: {
  parts: Part[];
  hardwareLines: HardwareLine[];
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  markupPct: number;
  yieldFactor: number;
  catalogs: CostCatalogs;
}): CostResult {
  const { catalogs } = args;
  const needs = computeMaterialNeeds(args.parts, catalogs, args.yieldFactor);
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

  let hardware = 0;
  for (const line of args.hardwareLines) {
    const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
    hardware += line.qty * item.pricePerUnit;
  }

  const labor = args.cabinets.reduce((sum, c) => sum + catalogs.laborPerType[c.type], 0);
  const freeLines = args.freeLines.reduce((sum, l) => sum + l.amount, 0);

  const breakdown: CostBreakdown = { boards, edging, cuttingService, hardware, labor, freeLines };
  const totalCost = boards + edging + cuttingService + hardware + labor + freeLines;
  const sellPrice = totalCost * (1 + args.markupPct / 100);

  const baseRunM = args.cabinets
    .filter((c) => BASE_RUN_TYPES.has(c.type))
    .reduce((sum, c) => sum + c.widthMm, 0) / 1000;
  const leiPerMl = baseRunM > 0 ? sellPrice / baseRunM : null;

  return { breakdown, totalCost, sellPrice, leiPerMl, needs };
}

import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
} from '@/lib/catalog/convert';
import { expandCabinet, resolveSuggestions } from '@/lib/engine';
import type { HardwareLine } from '@/lib/engine';
import { pickLegId } from './legs';
import type { QuoteCabinet, SnapshotData } from './compute';

export interface CabinetEstimate {
  cost: number;
  sell: number;
  error: string | null;
}

// Estimare per corp pentru afișare live: plăci PER_SHEET pe arie (foi fracționare, cu factor
// de utilizare) + debitare proporțională; NU e prețul final (acela rotunjește foile pe proiect).
export function estimateCabinetCost(
  cabinet: QuoteCabinet,
  snap: SnapshotData,
  opts: { markupPct: number; yieldFactor: number; legHeightMm: number | null },
): CabinetEstimate {
  try {
    const catalogs = toCostCatalogs(snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, snap.laborRates);
    const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
    if (opts.legHeightMm !== null) {
      defaults.legId = pickLegId(snap.hardware, opts.legHeightMm, defaults.legId);
    }
    const cc = parseConstruction(snap.settings.constructionJson);
    const expanded = expandCabinet(cabinet.input, catalogs, cc);

    const parts = [...expanded.parts];
    for (const p of cabinet.extraParts) {
      parts.push({
        cabinetLabel: cabinet.input.label, name: p.name,
        lengthMm: p.lengthMm, widthMm: p.widthMm, qty: p.qty,
        materialId: p.materialId, edges: {},
      });
    }

    let boards = 0;
    let cutting = 0;
    let edging = 0;
    const areaByMaterial = new Map<string, number>();
    for (const p of parts) {
      const area = (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty;
      areaByMaterial.set(p.materialId, (areaByMaterial.get(p.materialId) ?? 0) + area);
      for (const [edge, mm] of [
        [p.edges.l1, p.lengthMm], [p.edges.l2, p.lengthMm],
        [p.edges.w1, p.widthMm], [p.edges.w2, p.widthMm],
      ] as const) {
        if (!edge) continue;
        const band = catalogs.edgeBands.find((b) => b.id === edge);
        if (!band) throw new Error(`Cant inexistent în catalog: ${edge}`);
        edging += (mm / 1000) * p.qty * band.pricePerMl;
      }
    }
    const rates = [...catalogs.cuttingRates].sort((a, b) => a.maxThicknessMm - b.maxThicknessMm);
    for (const [materialId, area] of areaByMaterial) {
      const m = catalogs.materials.find((x) => x.id === materialId);
      if (!m) throw new Error(`Material inexistent în catalog: ${materialId}`);
      if (m.pricing.mode === 'PER_SQM') {
        boards += area * m.pricing.pricePerSqm;
      } else {
        const sheetArea = (m.sheetLengthMm / 1000) * (m.sheetWidthMm / 1000);
        const fractionalSheets = area / (sheetArea * opts.yieldFactor);
        boards += fractionalSheets * m.pricing.pricePerSheet;
        const rate = rates.find((r) => r.maxThicknessMm >= m.thicknessMm);
        if (rate) cutting += fractionalSheets * rate.pricePerSheet;
      }
    }

    const lines: HardwareLine[] = cabinet.hardwareOverrides ?? resolveSuggestions(expanded.hardware, defaults).lines;
    let hardware = 0;
    for (const line of lines) {
      const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
      if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
      hardware += line.qty * item.pricePerUnit;
    }

    const labor = catalogs.laborPerType[cabinet.input.type];
    const cost = boards + cutting + edging + hardware + labor;
    return { cost, sell: cost * (1 + opts.markupPct / 100), error: null };
  } catch (e) {
    return { cost: 0, sell: 0, error: e instanceof Error ? e.message : 'Eroare de calcul' };
  }
}

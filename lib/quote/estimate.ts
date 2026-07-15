import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
} from '@/lib/catalog/convert';
import {
  expandCabinet, resolveSuggestions,
  FRONT_PART_NAMES, HANDLE_FRONT_PART_NAMES, FRONT_THICKNESS_MM,
} from '@/lib/engine';
import type { HardwareLine, Part } from '@/lib/engine';
import { frontVopsitCostEur, ralIsBlack } from './front-pricing';
import { handleExtraCost, withResolvedHandle, type ProjectHandle } from './handle';
import { pickLegId } from './legs';
import { frontCatalogsFromSnapshot, type QuoteCabinet, type SnapshotData } from './compute';

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
  opts: { laborPct: number; yieldFactor: number; legHeightMm: number | null; projectHandle: ProjectHandle },
): CabinetEstimate {
  try {
    const catalogs = toCostCatalogs(
      snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, frontCatalogsFromSnapshot(snap),
    );
    const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
    if (opts.legHeightMm !== null) {
      defaults.legId = pickLegId(snap.hardware, opts.legHeightMm, defaults.legId);
    }
    const cc = parseConstruction(snap.settings.constructionJson);
    const input = withResolvedHandle(cabinet.input, opts.projectHandle);
    const expanded = expandCabinet(input, catalogs, cc);

    const parts = [...expanded.parts];
    for (const p of cabinet.extraParts) {
      parts.push({
        cabinetLabel: input.label, name: p.name,
        lengthMm: p.lengthMm, widthMm: p.widthMm, qty: p.qty,
        materialId: p.materialId, edges: {},
      });
    }

    // Fronturile MDF vopsit se cotează per m² în EUR (nu ca placă) — le scoatem din aria de placă
    // și le adăugăm separat mai jos, la fel ca în computeCosts.
    const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
    const isVopsitFrontPart = (p: Part) => isVopsit && FRONT_PART_NAMES.has(p.name);

    let boards = 0;
    let cutting = 0;
    let edging = 0;
    const areaByMaterial = new Map<string, number>();
    for (const p of parts) {
      if (isVopsitFrontPart(p)) continue; // fronturile vopsite nu intră ca placă/cant
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

    // Fronturi MDF vopsit: cotă per m² (EUR) × curs, adăugată la „boards" (ca în computeCosts).
    if (isVopsit) {
      const mdf = input.mdfFront!;
      const frontParts = parts.filter(isVopsitFrontPart);
      if (frontParts.length > 0) {
        const areaSqm = frontParts.reduce((s, p) => s + (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty, 0);
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
        if (model && supplier && price) {
          const costEur = frontVopsitCostEur({
            areaSqm, frontCount, pricePerSqmEur: price.pricePerSqmEur,
            faces: mdf.faces, finish: mdf.finish, colorCategory: mdf.colorCategory,
            ralBlack: ralIsBlack(mdf.ralCode), hasHandleMilling: model.hasHandleMilling, supplier,
          });
          boards += costEur * catalogs.eurToRon;
        }
        // preț/model/furnizor lipsă → contribuție 0 (avertizarea „preț la cerere" apare în oferta finală)
      }
    }

    const lines: HardwareLine[] = cabinet.hardwareOverrides
      ?? resolveSuggestions(expanded.hardware, defaults, catalogs.hardware).lines;
    let hardware = 0;
    for (const line of lines) {
      const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
      if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
      hardware += line.qty * item.pricePerUnit;
    }

    const handlePrices = {
      profilJPerFront: snap.settings.profilJPerFront ?? 0,
      golaPricePerMl: snap.settings.golaPricePerMl ?? 0,
    };
    const extras = handleExtraCost(input, handlePrices).reduce((s, l) => s + l.amount, 0);
    const cost = boards + cutting + edging + hardware + extras;
    return { cost, sell: cost * (1 + opts.laborPct / 100), error: null };
  } catch (e) {
    return { cost: 0, sell: 0, error: e instanceof Error ? e.message : 'Eroare de calcul' };
  }
}

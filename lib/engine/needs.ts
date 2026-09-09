import { findMaterial } from './carcass';
import { nestParts, type NestParams, type NestPiece, type SheetLayout } from './nesting';
import type { Catalogs, Part } from './types';

export interface BoardNeed {
  materialId: string;
  totalAreaSqm: number;
  sheets: number | null;
  wastePct: number | null;
  layout: SheetLayout[] | null;
}

export interface EdgingNeed {
  edgeBandId: string;
  totalMl: number;
}

export function computeMaterialNeeds(
  parts: Part[],
  catalogs: Catalogs,
  nesting: NestParams,
): { boards: BoardNeed[]; edging: EdgingNeed[] } {
  const areaByMaterial = new Map<string, number>();
  const piecesByMaterial = new Map<string, NestPiece[]>();
  const mlByBand = new Map<string, number>();

  for (const p of parts) {
    const area = (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty;
    areaByMaterial.set(p.materialId, (areaByMaterial.get(p.materialId) ?? 0) + area);

    const pieces = piecesByMaterial.get(p.materialId) ?? [];
    for (let i = 0; i < p.qty; i++) {
      pieces.push({ label: `${p.cabinetLabel} · ${p.name}`, lengthMm: p.lengthMm, widthMm: p.widthMm });
    }
    piecesByMaterial.set(p.materialId, pieces);

    const addMl = (bandId: string | undefined, mm: number) => {
      if (!bandId) return;
      mlByBand.set(bandId, (mlByBand.get(bandId) ?? 0) + (mm / 1000) * p.qty);
    };
    addMl(p.edges.l1, p.lengthMm);
    addMl(p.edges.l2, p.lengthMm);
    addMl(p.edges.w1, p.widthMm);
    addMl(p.edges.w2, p.widthMm);
  }

  const boards: BoardNeed[] = [...areaByMaterial.entries()].map(([materialId, totalAreaSqm]) => {
    const material = findMaterial(catalogs, materialId);
    if (material.pricing.mode === 'PER_SQM') {
      return { materialId, totalAreaSqm, sheets: null, wastePct: null, layout: null };
    }
    const nested = nestParts(
      piecesByMaterial.get(materialId) ?? [],
      material.sheetLengthMm, material.sheetWidthMm, nesting,
      !material.hasGrain, // fără direcție de fibră → piesele pot fi rotite
    );
    return {
      materialId, totalAreaSqm,
      sheets: nested.sheets.length,
      wastePct: nested.wastePct,
      layout: nested.sheets,
    };
  });

  const edging: EdgingNeed[] = [...mlByBand.entries()].map(([edgeBandId, totalMl]) => ({
    edgeBandId, totalMl,
  }));

  return { boards, edging };
}

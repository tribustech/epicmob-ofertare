import { findMaterial } from './carcass';
import type { Catalogs, Part } from './types';

export interface BoardNeed {
  materialId: string;
  totalAreaSqm: number;
  sheets: number | null;
}

export interface EdgingNeed {
  edgeBandId: string;
  totalMl: number;
}

export function computeMaterialNeeds(
  parts: Part[],
  catalogs: Catalogs,
  yieldFactor: number,
): { boards: BoardNeed[]; edging: EdgingNeed[] } {
  const areaByMaterial = new Map<string, number>();
  const mlByBand = new Map<string, number>();

  for (const p of parts) {
    const area = (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty;
    areaByMaterial.set(p.materialId, (areaByMaterial.get(p.materialId) ?? 0) + area);

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
      return { materialId, totalAreaSqm, sheets: null };
    }
    const sheetArea = (material.sheetLengthMm / 1000) * (material.sheetWidthMm / 1000);
    return {
      materialId,
      totalAreaSqm,
      sheets: Math.ceil(totalAreaSqm / (sheetArea * yieldFactor)),
    };
  });

  const edging: EdgingNeed[] = [...mlByBand.entries()].map(([edgeBandId, totalMl]) => ({
    edgeBandId, totalMl,
  }));

  return { boards, edging };
}

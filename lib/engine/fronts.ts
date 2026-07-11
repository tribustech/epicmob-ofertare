import { findMaterial } from './carcass';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo, Part, PartEdges, Warning,
} from './types';

export function drawerFrontHeights(input: CabinetInput, cc: ConstructionConstants): number[] {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return [];
  if (drawers.frontHeightsMm) {
    if (drawers.frontHeightsMm.length !== drawers.count) {
      throw new Error(`Corpul ${input.label}: frontHeightsMm nu corespunde cu numărul de sertare`);
    }
    return drawers.frontHeightsMm;
  }
  const usable = input.heightMm - 2 * cc.outerGapMm - (drawers.count - 1) * cc.frontGapMm;
  return Array.from({ length: drawers.count }, () => usable / drawers.count);
}

export function expandFronts(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { parts: Part[]; fronts: FrontInfo[]; warnings: Warning[] } {
  if (!input.frontMaterialId) return { parts: [], fronts: [], warnings: [] };

  const material = findMaterial(catalogs, input.frontMaterialId);
  const bandId = material.kind === 'MDF_VOPSIT' ? null : input.edgeBands.frontPerimeterId;
  const edges: PartEdges = bandId ? { l1: bandId, l2: bandId, w1: bandId, w2: bandId } : {};

  const blindW = input.type === 'COLT' ? (input.blindPanelWidthMm ?? 100) : 0;
  const usableW = input.widthMm - 2 * cc.outerGapMm - blindW;
  const frontH = input.heightMm - 2 * cc.outerGapMm;

  const parts: Part[] = [];
  const fronts: FrontInfo[] = [];
  const warnings: Warning[] = [];

  if (blindW > 0) {
    parts.push({
      cabinetLabel: input.label, name: 'Panou orb',
      lengthMm: frontH, widthMm: blindW, qty: 1,
      materialId: material.id, edges,
    });
  }

  if (input.type === 'SERTARE') {
    const heights = drawerFrontHeights(input, cc);
    // grupează înălțimile identice într-o singură linie de piesă
    const groups = new Map<number, number>();
    for (const h of heights) groups.set(h, (groups.get(h) ?? 0) + 1);
    for (const [h, qty] of groups) {
      parts.push({
        cabinetLabel: input.label, name: 'Front sertar',
        lengthMm: h, widthMm: usableW, qty,
        materialId: material.id, edges,
      });
    }
    for (const h of heights) fronts.push({ kind: 'SERTAR', widthMm: usableW, heightMm: h });
  } else if (input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * cc.frontGapMm) / input.doors;
    parts.push({
      cabinetLabel: input.label, name: 'Ușă',
      lengthMm: frontH, widthMm: doorW, qty: input.doors,
      materialId: material.id, edges,
    });
    for (let i = 0; i < input.doors; i++) fronts.push({ kind: 'USA', widthMm: doorW, heightMm: frontH });
    if (doorW > cc.doorMaxWidthMm) {
      warnings.push({
        code: 'DOOR_WIDTH',
        message: `Ușă de ${Math.round(doorW)}mm lățime — peste ${cc.doorMaxWidthMm}mm pentru balamale standard`,
        cabinetLabel: input.label,
      });
    }
  }

  return { parts, fronts, warnings };
}

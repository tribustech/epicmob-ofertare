import { assertPositiveDim, findMaterial } from './carcass';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo, MaterialKind, Part, PartEdges, Warning,
} from './types';

export function drawerFrontHeights(input: CabinetInput, cc: ConstructionConstants): number[] {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return [];
  if (drawers.frontHeightsMm) {
    if (drawers.frontHeightsMm.length !== drawers.count) {
      throw new Error(`Corpul ${input.label}: frontHeightsMm nu corespunde cu numărul de sertare`);
    }
    if (drawers.frontHeightsMm.some((h) => h <= 0)) {
      throw new Error(`Corpul ${input.label}: frontHeightsMm conține o valoare imposibilă`);
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
  // MDF vopsit: frontMaterialId e null (frontul se cotează per m² în EUR, nu din catalogul
  // de plăci). Geometria/grosimea frontului vine dintr-un material generic MDF_VOPSIT din
  // catalog; costul lui de placă e ulterior scos din bucket-ul de plăci de către computeCosts.
  const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  if (!input.frontMaterialId && !isVopsit) return { parts: [], fronts: [], warnings: [] };

  const material = input.frontMaterialId
    ? findMaterial(catalogs, input.frontMaterialId)
    : catalogs.materials.find((m) => m.kind === 'MDF_VOPSIT');
  if (!material) {
    throw new Error(`Corpul ${input.label}: nu există un material MDF vopsit în catalog pentru fronturi`);
  }
  // MDF vopsit și MDF înfoliat au fața finisată pe toate laturile — fără cant ABS
  const NO_EDGE_KINDS: MaterialKind[] = ['MDF_VOPSIT', 'MDF_INFOLIAT'];
  const bandId = NO_EDGE_KINDS.includes(material.kind) ? null : input.edgeBands.frontPerimeterId;
  const edges: PartEdges = bandId ? { l1: bandId, l2: bandId, w1: bandId, w2: bandId } : {};

  if (input.blindPanelWidthMm !== undefined && input.blindPanelWidthMm < 0) {
    throw new Error(
      `Corpul ${input.label}: blindPanelWidthMm nu poate fi negativ (${input.blindPanelWidthMm}mm)`,
    );
  }
  const blindW = input.type === 'COLT' ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const usableW = assertPositiveDim(
    input.widthMm - 2 * cc.outerGapMm - blindW, 'lățime utilă fronturi', input.label,
  );
  let frontH = assertPositiveDim(input.heightMm - 2 * cc.outerGapMm, 'înălțime front', input.label);
  const handleType = input.handle?.type;
  if (handleType === 'GOLA') {
    frontH = assertPositiveDim(frontH - cc.golaFrontDeductMm, 'înălțime front (GOLA)', input.label);
  }
  if (handleType === 'FARA' && input.handle?.frontExtensionMm && input.doors > 0) {
    frontH += input.handle.frontExtensionMm; // front prelungit ca să ai de unde deschide
  }

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

  if ((input.drawers?.count ?? 0) > 0) {
    const heights = drawerFrontHeights(input, cc);
    // GOLA: profilul ocupă din frontul de sus al stivei de sertare
    const adjusted = handleType === 'GOLA' && heights.length > 0
      ? [assertPositiveDim(heights[0] - cc.golaFrontDeductMm, 'front sertar sus (GOLA)', input.label), ...heights.slice(1)]
      : heights;
    // grupează înălțimile identice într-o singură linie de piesă
    const groups = new Map<number, number>();
    for (const h of adjusted) groups.set(h, (groups.get(h) ?? 0) + 1);
    for (const [h, qty] of groups) {
      parts.push({
        cabinetLabel: input.label, name: 'Front sertar',
        lengthMm: h, widthMm: usableW, qty,
        materialId: material.id, edges,
      });
    }
    for (const h of adjusted) fronts.push({ kind: 'SERTAR', widthMm: usableW, heightMm: h });
  } else if (input.doors > 0) {
    const doorW = assertPositiveDim(
      (usableW - (input.doors - 1) * cc.frontGapMm) / input.doors, 'lățime ușă', input.label,
    );
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

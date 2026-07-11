import { assertPositiveDim, findMaterial } from './carcass';
import { drawerFrontHeights } from './fronts';
import type { CabinetInput, Catalogs, ConstructionConstants, Part, Warning } from './types';

export function pickSlideNominal(
  depthMm: number,
  cc: ConstructionConstants,
): { nominalMm: number; warnings: Warning[] } {
  const maxLength = depthMm - cc.slideClearanceMm;
  const fitting = cc.slideNominalsMm.filter((n) => n <= maxLength);
  if (fitting.length === 0) {
    const smallest = Math.min(...cc.slideNominalsMm);
    return {
      nominalMm: smallest,
      warnings: [{
        code: 'SLIDE_DEPTH',
        message: `Adâncime ${depthMm}mm prea mică pentru glisiera minimă de ${smallest}mm`,
      }],
    };
  }
  return { nominalMm: Math.max(...fitting), warnings: [] };
}

export function expandDrawerBoxes(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { parts: Part[]; warnings: Warning[] } {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return { parts: [], warnings: [] };

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const bottom = findMaterial(catalogs, drawers.bottomMaterialId);
  const t = carcass.thicknessMm;
  const innerW = input.widthMm - 2 * t;
  const { nominalMm, warnings } = pickSlideNominal(input.depthMm, cc);
  const heights = drawerFrontHeights(input, cc);
  const fe = input.edgeBands.carcassFrontEdgeId;

  const parts: Part[] = [];
  const push = (p: Part) => {
    const same = parts.find(
      (q) => q.name === p.name && q.lengthMm === p.lengthMm && q.widthMm === p.widthMm && q.materialId === p.materialId,
    );
    if (same) same.qty += p.qty;
    else parts.push(p);
  };

  for (const frontH of heights) {
    if (drawers.system === 'PAL_BOX') {
      const boxW = assertPositiveDim(
        innerW - cc.palBoxSlideAllowanceMm, 'lățime cutie sertar (PAL_BOX)', input.label,
      );
      const boxH = Math.max(frontH - cc.palBoxHeightDeductMm, cc.palBoxMinHeightMm);
      const boxInnerW = assertPositiveDim(
        boxW - 2 * t, 'lățime față/spate cutie sertar (PAL_BOX)', input.label,
      );
      push({
        cabinetLabel: input.label, name: 'Laterală sertar',
        lengthMm: nominalMm, widthMm: boxH, qty: 2,
        materialId: carcass.id, edges: { l1: fe },
      });
      push({
        cabinetLabel: input.label, name: 'Față/Spate cutie sertar',
        lengthMm: boxInnerW, widthMm: boxH, qty: 2,
        materialId: carcass.id, edges: { l1: fe },
      });
      push({
        cabinetLabel: input.label, name: 'Fund sertar',
        lengthMm: nominalMm, widthMm: boxW, qty: 1,
        materialId: bottom.id, edges: {},
      });
    } else {
      const bottomW = assertPositiveDim(
        innerW - cc.metalBoxBottomDeductMm, 'lățime fund sertar (METAL_BOX)', input.label,
      );
      push({
        cabinetLabel: input.label, name: 'Fund sertar',
        lengthMm: nominalMm, widthMm: bottomW, qty: 1,
        materialId: bottom.id, edges: {},
      });
      push({
        cabinetLabel: input.label, name: 'Spate sertar',
        lengthMm: bottomW, widthMm: cc.metalBoxBackHeightMm, qty: 1,
        materialId: carcass.id, edges: {},
      });
    }
  }

  return { parts, warnings };
}

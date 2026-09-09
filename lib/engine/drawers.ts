import { assertPositiveDim, findMaterial } from './carcass';
import { drawerFrontHeights } from './fronts';
import type { CabinetInput, Catalogs, ConstructionConstants, PieceInstance, Warning } from './types';

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
  legHeightMm?: number,
): { pieces: PieceInstance[]; warnings: Warning[] } {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return { pieces: [], warnings: [] };

  // TANDEMBOX = sertar metalic complet preasamblat — nimic la debitare, doar setul din feronerie
  if (drawers.system !== 'PAL_BOX') return { pieces: [], warnings: [] };
  if (!drawers.bottomMaterialId) {
    throw new Error(`Corpul ${input.label}: cutia de sertar din PAL cere materialul fundului`);
  }

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const bottom = findMaterial(catalogs, drawers.bottomMaterialId);
  const t = carcass.thicknessMm;
  const innerW = input.widthMm - 2 * t;
  const { nominalMm, warnings } = pickSlideNominal(input.depthMm, cc);
  const heights = drawerFrontHeights(input, cc, legHeightMm);
  const fe = input.edgeBands.carcassFrontEdgeId;

  // laterala cutiei = piesă verticală, lungă pe glisieră (sus/jos), scurtă pe fața/spatele cutiei
  const BOX_SIDE_AXES: PieceInstance['edgeAxis'] = { sus: 'L', jos: 'L', fata: 'W', spate: 'W' };
  // fundul cutiei stă culcat ca un fund/blat de corp (fata/spate pe lungime, stanga/dreapta pe lățime)
  const SIDE_AXES_HORIZ_LIKE: PieceInstance['edgeAxis'] = { fata: 'L', spate: 'L', stanga: 'W', dreapta: 'W' };

  const pieces: PieceInstance[] = [];
  const cols = Math.max(1, drawers.columns ?? 1);
  // regiunea utilă pe fiecare coloană (lățimea interioară împărțită, minus lufturile dintre coloane)
  const colRegion = (innerW - (cols - 1) * cc.frontGapMm) / cols;

  heights.forEach((frontH, i) => {
    const boxW = assertPositiveDim(
      colRegion - cc.palBoxSlideAllowanceMm, 'lățime cutie sertar (PAL_BOX)', input.label,
    );
    const boxH = Math.max(frontH - cc.palBoxHeightDeductMm, cc.palBoxMinHeightMm);
    const boxInnerW = assertPositiveDim(
      boxW - 2 * t, 'lățime față/spate cutie sertar (PAL_BOX)', input.label,
    );
    const tag = (i: number, c: number) => cols > 1 ? `${i + 1}·c${c + 1}` : `${i + 1}`;
    for (let c = 0; c < cols; c++) {
      for (let j = 0; j < 2; j++) {
        pieces.push({
          key: `sertar:${i}:${c}:laterala:${j}`, cabinetLabel: input.label,
          name: 'Laterală sertar', label: `Sertar ${tag(i, c)} · laterală ${j === 0 ? 'stânga' : 'dreapta'}`,
          lengthMm: nominalMm, widthMm: boxH, materialId: carcass.id,
          edges: { sus: fe }, edgeAxis: BOX_SIDE_AXES,
        });
      }
      (['fata', 'spate'] as const).forEach((pos) => {
        pieces.push({
          key: `sertar:${i}:${c}:${pos}`, cabinetLabel: input.label,
          name: 'Față/Spate cutie sertar', label: `Sertar ${tag(i, c)} · ${pos === 'fata' ? 'față' : 'spate'} cutie`,
          lengthMm: boxInnerW, widthMm: boxH, materialId: carcass.id,
          edges: { sus: fe }, edgeAxis: { sus: 'L', jos: 'L', stanga: 'W', dreapta: 'W' },
        });
      });
      pieces.push({
        key: `sertar:${i}:${c}:fund`, cabinetLabel: input.label,
        name: 'Fund sertar', label: `Sertar ${tag(i, c)} · fund`,
        lengthMm: nominalMm, widthMm: boxW, materialId: bottom.id,
        edges: {}, edgeAxis: SIDE_AXES_HORIZ_LIKE,
      });
    }
  });

  return { pieces, warnings };
}

import type { CabinetInput, ConstructionConstants } from '@/lib/engine';

export interface IsoFrontRect {
  kind: 'USA' | 'SERTAR' | 'PANOU_ORB';
  xMm: number; yMm: number; wMm: number; hMm: number; // plan frontal, origine colț stânga-jos
  handle?: { xMm: number; yMm: number };
}

export interface CabinetIsoModel {
  widthMm: number; heightMm: number; depthMm: number;
  shelfYsMm: number[];
  fronts: IsoFrontRect[];
}

const HANDLE_INSET_MM = 40; // distanța mânerului față de marginea ușii

export function buildIsoModel(input: CabinetInput, cc: ConstructionConstants): CabinetIsoModel {
  const { widthMm: W, heightMm: H, depthMm: D } = input;
  const g = cc.outerGapMm;
  const gap = cc.frontGapMm;
  const fronts: IsoFrontRect[] = [];

  const drawerCount = input.drawers?.count ?? 0;
  const hasFronts = input.frontMaterialId !== null && (input.doors > 0 || drawerCount > 0);

  const blindW = input.type === 'COLT' && hasFronts ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const frontX0 = g + blindW;
  const usableW = W - 2 * g - blindW;
  const frontH = H - 2 * g;

  if (blindW > 0) {
    fronts.push({ kind: 'PANOU_ORB', xMm: g, yMm: g, wMm: blindW, hMm: frontH });
  }

  if (hasFronts && drawerCount > 0) {
    const heights = input.drawers!.frontHeightsMm
      ?? Array.from({ length: drawerCount }, () => (H - 2 * g - (drawerCount - 1) * gap) / drawerCount);
    let topY = H - g; // sertarul 1 e sus
    for (const h of heights) {
      fronts.push({
        kind: 'SERTAR', xMm: frontX0, yMm: topY - h, wMm: usableW, hMm: h,
        handle: { xMm: frontX0 + usableW / 2, yMm: topY - HANDLE_INSET_MM },
      });
      topY -= h + gap;
    }
  } else if (hasFronts && input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * gap) / input.doors;
    for (let i = 0; i < input.doors; i++) {
      const x = frontX0 + i * (doorW + gap);
      // mânerul pe muchia dinspre mijloc la 2 uși; pe dreapta la o singură ușă
      const handleX = input.doors === 2 && i === 0 ? x + doorW - HANDLE_INSET_MM
        : input.doors === 2 ? x + HANDLE_INSET_MM
        : x + doorW - HANDLE_INSET_MM;
      fronts.push({
        kind: 'USA', xMm: x, yMm: g, wMm: doorW, hMm: frontH,
        handle: { xMm: handleX, yMm: g + frontH / 2 },
      });
    }
  }

  const shelfYsMm = drawerCount > 0 ? [] :
    Array.from({ length: input.shelves }, (_, i) => (H * (i + 1)) / (input.shelves + 1));

  return { widthMm: W, heightMm: H, depthMm: D, shelfYsMm, fronts };
}

import type { CabinetInput, ConstructionConstants } from '@/lib/engine';

export type HandleMarkKind = 'BARA' | 'BUTON' | 'INGROPAT' | 'PUSH';

export interface IsoRect {
  xMm: number; yMm: number; wMm: number; hMm: number; // plan frontal, origine colț stânga-jos
}

export interface IsoFrontRect extends IsoRect {
  kind: 'USA' | 'SERTAR' | 'PANOU_ORB';
  handle?: { xMm: number; yMm: number; kind: HandleMarkKind; vertical: boolean };
  jStrip?: IsoRect; // banda frezată J pe muchia de prindere
}

export interface CabinetIsoModel {
  widthMm: number; heightMm: number; depthMm: number;
  shelfYsMm: number[];
  fronts: IsoFrontRect[];
  golaBars: IsoRect[]; // profilul GOLA desenat în golul lăsat de fronturile scurtate
}

const HANDLE_INSET_MM = 40; // distanța mânerului față de marginea ușii
const J_STRIP_MM = 16;      // grosimea vizuală a benzii frezate J

export function buildIsoModel(input: CabinetInput, cc: ConstructionConstants): CabinetIsoModel {
  const { widthMm: W, heightMm: H, depthMm: D } = input;
  const g = cc.outerGapMm;
  const gap = cc.frontGapMm;
  const fronts: IsoFrontRect[] = [];
  const golaBars: IsoRect[] = [];

  const drawerCount = input.drawers?.count ?? 0;
  // MDF vopsit: frontMaterialId e null (frontul se cotează per m², nu din catalogul de plăci),
  // dar corpul are fronturi — la fel ca în expandFronts.
  const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  const hasFronts = (input.frontMaterialId !== null || isVopsit) && (input.doors > 0 || drawerCount > 0);

  const blindW = input.type === 'COLT' && hasFronts ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const frontX0 = g + blindW;
  const usableW = W - 2 * g - blindW;
  const frontH = H - 2 * g;

  const handleType = input.handle?.type;
  const markKind: HandleMarkKind | null =
    handleType === undefined || handleType === 'APLICAT' ? 'BARA'
    : handleType === 'BUTON' ? 'BUTON'
    : handleType === 'INGROPAT' ? 'INGROPAT'
    : handleType === 'PUSH' ? 'PUSH'
    : null;
  const isGola = handleType === 'GOLA';
  const isJ = handleType === 'PROFIL_J';
  const deduct = cc.golaFrontDeductMm;
  // la suspendate prinderea e pe muchia de jos (profilul GOLA / freza J stau jos)
  const gripAtBottom = input.type === 'SUSPENDAT';

  const doorH = isGola ? frontH - deduct
    : handleType === 'FARA' && input.handle?.frontExtensionMm ? frontH + input.handle.frontExtensionMm
    : frontH;
  // GOLA: golul rămâne pe partea profilului; FARA: prelungirea coboară sub linia corpului
  const doorY = isGola ? (gripAtBottom ? g + deduct : g) : g - (doorH - frontH);

  const doorJStrip = (x: number, w: number): IsoRect =>
    gripAtBottom
      ? { xMm: x, yMm: doorY, wMm: w, hMm: J_STRIP_MM }
      : { xMm: x, yMm: doorY + doorH - J_STRIP_MM, wMm: w, hMm: J_STRIP_MM };

  if (blindW > 0) {
    fronts.push({ kind: 'PANOU_ORB', xMm: g, yMm: doorY, wMm: blindW, hMm: doorH });
  }

  if (hasFronts && drawerCount > 0) {
    let heights = input.drawers!.frontHeightsMm
      ?? Array.from({ length: drawerCount }, () => (H - 2 * g - (drawerCount - 1) * gap) / drawerCount);
    if (isGola && heights.length > 0) heights = [heights[0] - deduct, ...heights.slice(1)];
    // GOLA: profilul stă deasupra primului sertar — stiva coboară, golul nu mai apare jos
    let topY = isGola ? H - g - deduct : H - g; // sertarul 1 e sus
    if (isGola) golaBars.push({ xMm: g, yMm: H - g - deduct, wMm: W - 2 * g, hMm: deduct });
    for (const h of heights) {
      fronts.push({
        kind: 'SERTAR', xMm: frontX0, yMm: topY - h, wMm: usableW, hMm: h,
        ...(markKind ? { handle: { xMm: frontX0 + usableW / 2, yMm: topY - HANDLE_INSET_MM, kind: markKind, vertical: false } } : {}),
        ...(isJ ? { jStrip: { xMm: frontX0, yMm: topY - J_STRIP_MM, wMm: usableW, hMm: J_STRIP_MM } } : {}),
      });
      topY -= h + gap;
    }
  } else if (hasFronts && input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * gap) / input.doors;
    if (isGola) {
      golaBars.push(gripAtBottom
        ? { xMm: g, yMm: g, wMm: W - 2 * g, hMm: deduct }
        : { xMm: g, yMm: H - g - deduct, wMm: W - 2 * g, hMm: deduct });
    }
    for (let i = 0; i < input.doors; i++) {
      const x = frontX0 + i * (doorW + gap);
      // mânerul pe muchia dinspre mijloc la 2 uși; pe dreapta la o singură ușă
      const handleX = input.doors === 2 && i === 0 ? x + doorW - HANDLE_INSET_MM
        : input.doors === 2 ? x + HANDLE_INSET_MM
        : x + doorW - HANDLE_INSET_MM;
      fronts.push({
        kind: 'USA', xMm: x, yMm: doorY, wMm: doorW, hMm: doorH,
        ...(markKind ? { handle: { xMm: handleX, yMm: doorY + doorH / 2, kind: markKind, vertical: true } } : {}),
        ...(isJ ? { jStrip: doorJStrip(x, doorW) } : {}),
      });
    }
  }

  const shelfYsMm = drawerCount > 0 ? [] :
    Array.from({ length: input.shelves }, (_, i) => (H * (i + 1)) / (input.shelves + 1));

  return { widthMm: W, heightMm: H, depthMm: D, shelfYsMm, fronts, golaBars };
}

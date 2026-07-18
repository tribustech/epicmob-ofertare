import type { CabinetInput, ConstructionConstants } from '@/lib/engine';
import { resolveFalseFronts } from '@/lib/engine/fronts';

export type HandleMarkKind = 'BARA' | 'BUTON' | 'INGROPAT' | 'PUSH';

export interface IsoRect {
  xMm: number; yMm: number; wMm: number; hMm: number; // plan frontal, origine colț stânga-jos
}

export interface IsoFrontRect extends IsoRect {
  kind: 'USA' | 'SERTAR' | 'FALS';
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

  const { stangaMm: fS, dreaptaMm: fD } = hasFronts
    ? resolveFalseFronts(input, cc) : { stangaMm: 0, dreaptaMm: 0 };
  const luftS = fS > 0 ? gap / 2 : g;
  const luftD = fD > 0 ? gap / 2 : g;
  const frontX0 = fS > 0 ? fS + gap / 2 : g;
  const usableW = W - fS - fD - luftS - luftD;
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

  const doorH = isGola ? frontH - deduct
    : handleType === 'FARA' && input.handle?.frontExtensionMm ? frontH + input.handle.frontExtensionMm
    : frontH;
  // GOLA: golul profilului rămâne sus; FARA: prelungirea coboară sub linia corpului
  const doorY = isGola ? g : g - (doorH - frontH);

  // prinderea (profil GOLA / freză J) e pe muchia de sus a frontului, indiferent de tipul corpului
  const doorJStrip = (x: number, w: number): IsoRect =>
    ({ xMm: x, yMm: doorY + doorH - J_STRIP_MM, wMm: w, hMm: J_STRIP_MM });

  if (fS > 0) fronts.push({ kind: 'FALS', xMm: 0, yMm: doorY, wMm: fS - gap / 2, hMm: doorH });
  if (fD > 0) fronts.push({ kind: 'FALS', xMm: W - (fD - gap / 2), yMm: doorY, wMm: fD - gap / 2, hMm: doorH });

  if (hasFronts && drawerCount > 0) {
    const heights = input.drawers!.frontHeightsMm
      ?? Array.from({ length: drawerCount }, () => (H - 2 * g - (drawerCount - 1) * gap) / drawerCount);
    let topY = H - g; // sertarul 1 e sus
    // GOLA: fiecare sertar are profilul lui deasupra frontului (frontul se scurtează cu profilul)
    for (const h of heights) {
      if (isGola) golaBars.push({ xMm: g, yMm: topY - deduct, wMm: W - 2 * g, hMm: deduct });
      const rowTop = isGola ? topY - deduct : topY;
      const frontHRow = isGola ? h - deduct : h;
      fronts.push({
        kind: 'SERTAR', xMm: frontX0, yMm: rowTop - frontHRow, wMm: usableW, hMm: frontHRow,
        ...(markKind ? { handle: { xMm: frontX0 + usableW / 2, yMm: rowTop - HANDLE_INSET_MM, kind: markKind, vertical: false } } : {}),
        ...(isJ ? { jStrip: { xMm: frontX0, yMm: rowTop - J_STRIP_MM, wMm: usableW, hMm: J_STRIP_MM } } : {}),
      });
      topY -= h + gap;
    }
  } else if (hasFronts && input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * gap) / input.doors;
    if (isGola) {
      golaBars.push({ xMm: g, yMm: H - g - deduct, wMm: W - 2 * g, hMm: deduct });
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

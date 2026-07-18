import { assertPositiveDim, dim, findMaterial } from './carcass';
import { LEGGED_TYPES } from './constants';
import type {
  CabinetInput, Catalogs, ConstructionConstants, DimTerm, FrontInfo, MaterialKind, PieceInstance, Warning,
} from './types';

export function drawerFrontHeights(
  input: CabinetInput, cc: ConstructionConstants, legHeightMm?: number,
): number[] {
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
  // corpul stă pe picior: fronturile scad la fel ca lateralele (vezi expandCarcass)
  const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
  const usable = input.heightMm - legDeduct - 2 * cc.outerGapMm - (drawers.count - 1) * cc.frontGapMm;
  return Array.from({ length: drawers.count }, () => usable / drawers.count);
}

/** Falsurile rezolvate (0 = lipsă). Corpurile vechi de COLȚ fără falseFronts cad pe
 *  blindPanelWidthMm (legacy) sau pe defaultul din setări — păstrează comportamentul
 *  panoului orb, inclusiv la COLȚ cu sertare. */
export function resolveFalseFronts(
  input: CabinetInput, cc: ConstructionConstants,
): { stangaMm: number; dreaptaMm: number } {
  if (input.falseFronts) {
    return { stangaMm: input.falseFronts.stangaMm ?? 0, dreaptaMm: input.falseFronts.dreaptaMm ?? 0 };
  }
  if (input.type === 'COLT') {
    return { stangaMm: input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm, dreaptaMm: 0 };
  }
  return { stangaMm: 0, dreaptaMm: 0 };
}

export function expandFronts(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
  legHeightMm?: number,
): { pieces: PieceInstance[]; fronts: FrontInfo[]; warnings: Warning[] } {
  // MDF vopsit: frontMaterialId e null (frontul se cotează per m² în EUR, nu din catalogul
  // de plăci). Geometria/grosimea frontului vine dintr-un material generic MDF_VOPSIT din
  // catalog; costul lui de placă e ulterior scos din bucket-ul de plăci de către computeCosts.
  const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  if (!input.frontMaterialId && !isVopsit) return { pieces: [], fronts: [], warnings: [] };

  const material = input.frontMaterialId
    ? findMaterial(catalogs, input.frontMaterialId)
    : catalogs.materials.find((m) => m.kind === 'MDF_VOPSIT');
  if (!material) {
    throw new Error(`Corpul ${input.label}: nu există un material MDF vopsit în catalog pentru fronturi`);
  }
  // MDF vopsit și MDF înfoliat au fața finisată pe toate laturile — fără cant ABS
  const NO_EDGE_KINDS: MaterialKind[] = ['MDF_VOPSIT', 'MDF_INFOLIAT'];
  const bandId = NO_EDGE_KINDS.includes(material.kind) ? null : input.edgeBands.frontPerimeterId;
  // front = piesă verticală cu fața spre tine; lengthMm = înălțimea → stânga/dreapta pe lungime
  const FRONT_AXES: PieceInstance['edgeAxis'] = { sus: 'W', jos: 'W', stanga: 'L', dreapta: 'L' };
  const perim: PieceInstance['edges'] = bandId
    ? { sus: bandId, jos: bandId, stanga: bandId, dreapta: bandId }
    : {};

  const { stangaMm: fS, dreaptaMm: fD } = resolveFalseFronts(input, cc);
  if (fS < 0 || fD < 0) {
    throw new Error(`Corpul ${input.label}: frontul fals nu poate fi negativ`);
  }
  // fals = piesă fixă la ras cu marginea: pe partea lui nu se scade luftul exterior,
  // ci jumătate din luftul dintre fronturi (spre frontul vecin)
  const luftS = fS > 0 ? cc.frontGapMm / 2 : cc.outerGapMm;
  const luftD = fD > 0 ? cc.frontGapMm / 2 : cc.outerGapMm;
  const usableW = assertPositiveDim(
    input.widthMm - fS - fD - luftS - luftD, 'lățime utilă fronturi', input.label,
  );
  // corpul stă pe picior: fronturile scad la fel ca lateralele (vezi expandCarcass)
  const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
  let frontH = assertPositiveDim(
    input.heightMm - legDeduct - 2 * cc.outerGapMm, 'înălțime front', input.label,
  );
  const handleType = input.handle?.type;
  if (handleType === 'GOLA') {
    frontH = assertPositiveDim(frontH - cc.golaFrontDeductMm, 'înălțime front (GOLA)', input.label);
  }
  if (handleType === 'FARA' && input.handle?.frontExtensionMm && input.doors > 0) {
    frontH += input.handle.frontExtensionMm; // front prelungit ca să ai de unde deschide
  }

  const frontHTerms: DimTerm[] = [
    { label: 'înălțime corp', valueMm: input.heightMm },
    ...(legDeduct > 0 ? [{ label: 'picior', valueMm: -legDeduct }] : []),
    { label: 'luft sus + jos', valueMm: -2 * cc.outerGapMm },
    ...(handleType === 'GOLA' ? [{ label: 'profil GOLA', valueMm: -cc.golaFrontDeductMm }] : []),
    ...(handleType === 'FARA' && input.handle?.frontExtensionMm && input.doors > 0
      ? [{ label: 'prelungire front', valueMm: input.handle.frontExtensionMm }] : []),
  ];
  const frontHCalc = dim('Înălțime', frontHTerms);

  const widthTermsBase: DimTerm[] = [
    { label: 'lățime corp', valueMm: input.widthMm },
    ...(fS > 0 ? [{ label: 'fals stânga', valueMm: -fS }] : []),
    ...(fD > 0 ? [{ label: 'fals dreapta', valueMm: -fD }] : []),
    { label: 'luft stânga', valueMm: -luftS },
    { label: 'luft dreapta', valueMm: -luftD },
  ];

  const pieces: PieceInstance[] = [];
  const fronts: FrontInfo[] = [];
  const warnings: Warning[] = [];

  for (const [side, nominal] of [['stanga', fS], ['dreapta', fD]] as const) {
    if (nominal <= 0) continue;
    pieces.push({
      key: `fals:${side}`, cabinetLabel: input.label, name: 'Front fals',
      label: side === 'stanga' ? 'Front fals stânga' : 'Front fals dreapta',
      lengthMm: frontH,
      widthMm: assertPositiveDim(nominal - cc.frontGapMm / 2, `front fals ${side}`, input.label),
      materialId: material.id,
      edges: perim, edgeAxis: FRONT_AXES,
      calc: {
        length: frontHCalc,
        width: dim('Lățime', [
          { label: 'fals nominal', valueMm: nominal },
          { label: 'luft spre front', valueMm: -cc.frontGapMm / 2 },
        ]),
      },
    });
  }

  if ((input.drawers?.count ?? 0) > 0) {
    const heights = drawerFrontHeights(input, cc, legHeightMm);
    // GOLA: fiecare sertar are profilul lui deasupra frontului — toate fronturile se scurtează
    const adjusted = handleType === 'GOLA'
      ? heights.map((h, i) => assertPositiveDim(h - cc.golaFrontDeductMm, `front sertar ${i + 1} (GOLA)`, input.label))
      : heights;
    // regruparea înălțimilor identice într-o singură linie de piesă se face în toParts
    const n = input.drawers!.count;
    adjusted.forEach((h, i) => {
      pieces.push({
        key: `front-sertar:${i}`, cabinetLabel: input.label, name: 'Front sertar',
        label: `Front sertar ${i + 1}`,
        lengthMm: h, widthMm: usableW, materialId: material.id,
        edges: perim, edgeAxis: FRONT_AXES,
        calc: {
          ...(input.drawers!.frontHeightsMm ? {} : {
            length: dim('Înălțime', [
              { label: 'înălțime corp', valueMm: input.heightMm },
              ...(legDeduct > 0 ? [{ label: 'picior', valueMm: -legDeduct }] : []),
              { label: 'luft sus + jos', valueMm: -2 * cc.outerGapMm },
              ...(n > 1 ? [
                { label: `${n - 1}× luft între fronturi`, valueMm: -(n - 1) * cc.frontGapMm },
                { label: `partea celorlalte ${n - 1} fronturi`, valueMm: -(heights[i]) * (n - 1) },
              ] : []),
              ...(handleType === 'GOLA' ? [{ label: 'profil GOLA', valueMm: -cc.golaFrontDeductMm }] : []),
            ]),
          }),
          width: dim('Lățime', widthTermsBase),
        },
      });
      fronts.push({ kind: 'SERTAR', widthMm: usableW, heightMm: h });
    });
  } else if (input.doors > 0) {
    const doorW = assertPositiveDim(
      (usableW - (input.doors - 1) * cc.frontGapMm) / input.doors, 'lățime ușă', input.label,
    );
    for (let i = 0; i < input.doors; i++) {
      pieces.push({
        key: `usa:${i}`, cabinetLabel: input.label, name: 'Ușă',
        label: input.doors > 1 ? `Ușă ${i + 1}` : 'Ușă',
        lengthMm: frontH, widthMm: doorW, materialId: material.id,
        edges: perim, edgeAxis: FRONT_AXES,
        calc: {
          length: frontHCalc,
          width: dim('Lățime', [
            ...widthTermsBase,
            ...(input.doors > 1 ? [
              { label: `${input.doors - 1}× luft între uși`, valueMm: -(input.doors - 1) * cc.frontGapMm },
              { label: `partea celorlalte ${input.doors - 1} uși`, valueMm: -doorW * (input.doors - 1) },
            ] : []),
          ]),
        },
      });
      fronts.push({ kind: 'USA', widthMm: doorW, heightMm: frontH });
    }
    if (doorW > cc.doorMaxWidthMm) {
      warnings.push({
        code: 'DOOR_WIDTH',
        message: `Ușă de ${Math.round(doorW)}mm lățime — peste ${cc.doorMaxWidthMm}mm pentru balamale standard`,
        cabinetLabel: input.label,
      });
    }
  }

  return { pieces, fronts, warnings };
}

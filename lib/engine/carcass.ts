import { LEGGED_TYPES } from './constants';
import type {
  CabinetInput, Catalogs, ConstructionConstants, DimCalc, DimTerm, PanelMount, PieceInstance, Warning,
} from './types';

export function findMaterial(catalogs: Catalogs, id: string) {
  const m = catalogs.materials.find((mat) => mat.id === id);
  if (!m) throw new Error(`Material inexistent în catalog: ${id}`);
  return m;
}

/** Construiește derivarea unei dimensiuni; termenii cu 0 (ex. picior absent) se elimină. */
export function dim(label: string, terms: DimTerm[]): DimCalc {
  const kept = terms.filter((t) => t.valueMm !== 0);
  return { label, resultMm: kept.reduce((s, t) => s + t.valueMm, 0), terms: kept };
}

/** Validează că o dimensiune derivată e strict pozitivă; altfel aruncă eroare cu eticheta corpului. */
export function assertPositiveDim(valueMm: number, what: string, label: string): number {
  if (valueMm <= 0) {
    throw new Error(`Corpul ${label}: dimensiune imposibilă pentru ${what} (${valueMm}mm)`);
  }
  return valueMm;
}

export function expandCarcass(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
  legHeightMm?: number,
): { pieces: PieceInstance[]; warnings: Warning[] } {
  const { widthMm: W, heightMm: H, depthMm: D, label } = input;
  if (W <= 0 || H <= 0 || D <= 0) throw new Error(`Dimensiuni invalide pentru corpul ${label}`);

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const t = carcass.thicknessMm;
  const fe = input.edgeBands.carcassFrontEdgeId;
  // interiorul e mărginit de cele două laterale (2× grosimea plăcii)
  const grosime2x: DimTerm = { label: '2× grosime laterală', valueMm: -2 * t };
  const innerW = assertPositiveDim(W - 2 * t, 'lățime interioară corp', label);

  // spatele se rezolvă din start: grosimea PFL + rezerva de holtșurub se scad din ADÂNCIMEA
  // lateralelor și a blatului/fundului (spatele stă în spate, prins cu holtșurub)
  if (input.back.enabled && !input.back.materialId) {
    throw new Error(`Corpul ${label}: spate activat fără material`);
  }
  const backMat = input.back.enabled ? findMaterial(catalogs, input.back.materialId!) : null;
  const hasPfl = backMat?.kind === 'PFL';
  const pflThick = hasPfl ? backMat!.thicknessMm : 0;
  const screw = hasPfl ? cc.screwAllowanceMm : 0;

  const mountTop: PanelMount = input.mount?.top ?? 'INCADRAT';
  const mountBottom: PanelMount = input.mount?.bottom ?? 'INCADRAT';
  // corpul stă pe picior: înălțimea totală H include piciorul, deci lateralele/spatele scad cu el
  const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
  const aplicatTop = mountTop === 'APLICAT' ? t : 0;
  const aplicatBottom = mountBottom === 'APLICAT' ? t : 0;
  // capetele aplicate acoperă toată lățimea și scurtează lateralele cu grosimea plăcii
  const sideH = assertPositiveDim(H - aplicatTop - aplicatBottom - legDeduct, 'înălțime laterală', label);
  const sideHCalc = dim('Înălțime', [
    { label: 'înălțime corp', valueMm: H },
    { label: 'blat aplicat', valueMm: -aplicatTop },
    { label: 'fund aplicat', valueMm: -aplicatBottom },
    { label: 'picior', valueMm: -legDeduct },
  ]);
  // adâncimea pieselor orizontale/laterale: din D se scade PFL-ul + rezerva de șurub
  const panelDepth = assertPositiveDim(D - pflThick - screw, 'adâncime piesă (după spate PFL)', label);
  const depthCalc = dim('Adâncime', [
    { label: 'adâncime', valueMm: D },
    { label: 'PFL', valueMm: -pflThick },
    { label: 'șurub', valueMm: -screw },
  ]);
  const panelW = (m: PanelMount) => (m === 'APLICAT' ? W : innerW);
  const panelWCalc = (m: PanelMount): DimCalc =>
    m === 'APLICAT'
      ? dim('Lățime', [{ label: 'lățime corp', valueMm: W }])
      : dim('Lățime', [{ label: 'lățime corp', valueMm: W }, grosime2x]);

  // axele de cant: laterala e verticală (fata/spate pe lungime, sus/jos pe lățime);
  // blat/fund/poliță LR/pazie sunt orizontale, culcate pe lățime (fata/spate pe lungime, stanga/dreapta pe lățime)
  const SIDE_AXES_VERT: PieceInstance['edgeAxis'] = { fata: 'L', spate: 'L', sus: 'W', jos: 'W' };
  const SIDE_AXES_HORIZ: PieceInstance['edgeAxis'] = { fata: 'L', spate: 'L', stanga: 'W', dreapta: 'W' };

  const pieces: PieceInstance[] = [];
  (['stânga', 'dreapta'] as const).forEach((pos, i) => {
    pieces.push({
      key: `laterala:${i}`, cabinetLabel: label,
      name: 'Laterală', label: `Laterală ${pos}`,
      lengthMm: sideH, widthMm: panelDepth, materialId: carcass.id,
      edges: { fata: fe }, edgeAxis: SIDE_AXES_VERT,
      calc: { length: sideHCalc, width: depthCalc },
    });
  });

  const topVariant = input.pieces?.top?.variant ?? 'PLIN';
  if (topVariant === 'PLIN') {
    pieces.push({
      key: 'blat-corp', cabinetLabel: label, name: 'Blat corp', label: 'Blat corp',
      lengthMm: panelW(mountTop), widthMm: panelDepth, materialId: carcass.id,
      edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
      calc: { length: panelWCalc(mountTop), width: depthCalc },
    });
  } else if (topVariant === 'PAZII') {
    const pazieW = input.pieces?.top?.pazieWidthMm ?? cc.pazieDefaultWidthMm;
    assertPositiveDim(pazieW, 'lățime pazie', label);
    const pazieCalc = {
      length: panelWCalc(mountTop),
      width: dim('Adâncime', [{ label: 'lățime pazie', valueMm: pazieW }]),
    };
    pieces.push(
      {
        key: 'pazie-fata', cabinetLabel: label, name: 'Pazie', label: 'Pazie față',
        lengthMm: panelW(mountTop), widthMm: pazieW, materialId: carcass.id,
        edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ, calc: pazieCalc,
      },
      {
        key: 'pazie-spate', cabinetLabel: label, name: 'Pazie', label: 'Pazie spate',
        lengthMm: panelW(mountTop), widthMm: pazieW, materialId: carcass.id,
        edges: {}, edgeAxis: SIDE_AXES_HORIZ, calc: pazieCalc,
      },
    );
  } // ABSENT: nimic

  pieces.push({
    key: 'fund-corp', cabinetLabel: label, name: 'Fund corp', label: 'Fund corp',
    lengthMm: panelW(mountBottom), widthMm: panelDepth, materialId: carcass.id,
    edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
    calc: { length: panelWCalc(mountBottom), width: depthCalc },
  });

  if (input.shelves > 0) {
    const shelfW = assertPositiveDim(D - cc.shelfSetbackMm, 'lățime poliță', label);
    const shelfMat = input.shelf?.materialId ? findMaterial(catalogs, input.shelf.materialId) : carcass;
    const interiorCalc = dim('Lățime interioară', [{ label: 'lățime corp', valueMm: W }, grosime2x]);
    const shelfDepthCalc = dim('Adâncime', [
      { label: 'adâncime', valueMm: D },
      { label: 'retragere poliță', valueMm: -cc.shelfSetbackMm },
    ]);
    // nesting-ul nu rotește piese (decorul curge pe lungime) — axa FAȚĂ–SPATE
    // înseamnă piesa rotită în lista de debitare, cu cantul frontal pe latura scurtă
    for (let i = 0; i < input.shelves; i++) {
      if (input.shelf?.decorAxis === 'FB') {
        pieces.push({
          key: `polita:${i}`, cabinetLabel: label, name: 'Poliță', label: `Poliță ${i + 1}`,
          lengthMm: shelfW, widthMm: innerW, materialId: shelfMat.id,
          edges: { fata: fe },
          edgeAxis: { fata: 'W', spate: 'W', stanga: 'L', dreapta: 'L' },
          calc: { length: shelfDepthCalc, width: interiorCalc },
        });
      } else {
        pieces.push({
          key: `polita:${i}`, cabinetLabel: label, name: 'Poliță', label: `Poliță ${i + 1}`,
          lengthMm: innerW, widthMm: shelfW, materialId: shelfMat.id,
          edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
          calc: { length: interiorCalc, width: shelfDepthCalc },
        });
      }
    }
  }

  if (backMat) {
    const isFalt = input.back.mount === 'FALT';
    const faltRebate = isFalt ? cc.backRebateMm : 0;
    pieces.push({
      key: 'spate', cabinetLabel: label, name: 'Spate', label: 'Spate',
      lengthMm: assertPositiveDim(H - faltRebate - legDeduct, 'înălțime spate', label),
      widthMm: W - faltRebate,
      materialId: backMat.id,
      edges: {}, edgeAxis: { sus: 'W', jos: 'W', stanga: 'L', dreapta: 'L' },
      calc: {
        length: dim('Înălțime', [
          { label: 'înălțime corp', valueMm: H },
          { label: 'falț', valueMm: -faltRebate },
          { label: 'picior', valueMm: -legDeduct },
        ]),
        width: dim('Lățime', [
          { label: 'lățime corp', valueMm: W },
          { label: 'falț', valueMm: -faltRebate },
        ]),
      },
    });
  }

  const warnings: Warning[] = [];
  if (input.shelves > 0 && innerW > cc.shelfSpanWarnMm) {
    warnings.push({
      code: 'SHELF_SPAN',
      message: `Poliță cu deschidere ${innerW}mm — peste ${cc.shelfSpanWarnMm}mm, recomandat sprijin intermediar`,
      cabinetLabel: label,
    });
  }

  return { pieces, warnings };
}

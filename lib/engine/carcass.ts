import { LEGGED_TYPES } from './constants';
import type {
  CabinetInput, Catalogs, ConstructionConstants, DimCalc, DimTerm, PanelMount, Part, Warning,
} from './types';

export function findMaterial(catalogs: Catalogs, id: string) {
  const m = catalogs.materials.find((mat) => mat.id === id);
  if (!m) throw new Error(`Material inexistent în catalog: ${id}`);
  return m;
}

/** Construiește derivarea unei dimensiuni; termenii cu 0 (ex. picior absent) se elimină. */
function dim(label: string, terms: DimTerm[]): DimCalc {
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
): { parts: Part[]; warnings: Warning[] } {
  const { widthMm: W, heightMm: H, depthMm: D, label } = input;
  if (W <= 0 || H <= 0 || D <= 0) throw new Error(`Dimensiuni invalide pentru corpul ${label}`);

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const t = carcass.thicknessMm;
  const fe = input.edgeBands.carcassFrontEdgeId;
  // interiorul e mărginit de cele două laterale (2× grosimea plăcii)
  const grosime2x: DimTerm = { label: '2× grosime laterală', valueMm: -2 * t };
  const innerW = assertPositiveDim(W - 2 * t, 'lățime interioară corp', label);

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
  const depthCalc = dim('Adâncime', [{ label: 'adâncime', valueMm: D }]);
  const panelW = (m: PanelMount) => (m === 'APLICAT' ? W : innerW);
  const panelWCalc = (m: PanelMount): DimCalc =>
    m === 'APLICAT'
      ? dim('Lățime', [{ label: 'lățime corp', valueMm: W }])
      : dim('Lățime', [{ label: 'lățime corp', valueMm: W }, grosime2x]);

  const parts: Part[] = [
    {
      cabinetLabel: label, name: 'Laterală',
      lengthMm: sideH, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
      calc: { length: sideHCalc, width: depthCalc },
    },
  ];
  if (mountTop === mountBottom) {
    parts.push({
      cabinetLabel: label, name: 'Blat corp / Fund corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
      calc: { length: panelWCalc(mountTop), width: depthCalc },
    });
  } else {
    parts.push({
      cabinetLabel: label, name: 'Blat corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
      calc: { length: panelWCalc(mountTop), width: depthCalc },
    });
    parts.push({
      cabinetLabel: label, name: 'Fund corp',
      lengthMm: panelW(mountBottom), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
      calc: { length: panelWCalc(mountBottom), width: depthCalc },
    });
  }

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
    if (input.shelf?.decorAxis === 'FB') {
      parts.push({
        cabinetLabel: label, name: 'Poliță',
        lengthMm: shelfW, widthMm: innerW, qty: input.shelves,
        materialId: shelfMat.id, edges: { w1: fe },
        calc: { length: shelfDepthCalc, width: interiorCalc },
      });
    } else {
      parts.push({
        cabinetLabel: label, name: 'Poliță',
        lengthMm: innerW, widthMm: shelfW, qty: input.shelves,
        materialId: shelfMat.id, edges: { l1: fe },
        calc: { length: interiorCalc, width: shelfDepthCalc },
      });
    }
  }

  if (input.back.enabled) {
    if (!input.back.materialId) {
      throw new Error(`Corpul ${label}: spate activat fără material`);
    }
    const back = findMaterial(catalogs, input.back.materialId);
    const isFalt = input.back.mount === 'FALT';
    const faltRebate = isFalt ? cc.backRebateMm : 0;
    parts.push({
      cabinetLabel: label, name: 'Spate',
      lengthMm: assertPositiveDim(H - faltRebate - legDeduct, 'înălțime spate', label),
      widthMm: W - faltRebate,
      qty: 1, materialId: back.id, edges: {},
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

  return { parts, warnings };
}

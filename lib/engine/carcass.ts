import type { CabinetInput, Catalogs, ConstructionConstants, PanelMount, Part, Warning } from './types';

export function findMaterial(catalogs: Catalogs, id: string) {
  const m = catalogs.materials.find((mat) => mat.id === id);
  if (!m) throw new Error(`Material inexistent în catalog: ${id}`);
  return m;
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
): { parts: Part[]; warnings: Warning[] } {
  const { widthMm: W, heightMm: H, depthMm: D, label } = input;
  if (W <= 0 || H <= 0 || D <= 0) throw new Error(`Dimensiuni invalide pentru corpul ${label}`);

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const t = carcass.thicknessMm;
  const fe = input.edgeBands.carcassFrontEdgeId;
  const innerW = assertPositiveDim(W - 2 * t, 'lățime interioară corp', label);

  const mountTop: PanelMount = input.mount?.top ?? 'INCADRAT';
  const mountBottom: PanelMount = input.mount?.bottom ?? 'INCADRAT';
  // capetele aplicate acoperă toată lățimea și scurtează lateralele cu grosimea plăcii
  const sideH = assertPositiveDim(
    H - (mountTop === 'APLICAT' ? t : 0) - (mountBottom === 'APLICAT' ? t : 0),
    'înălțime laterală', label,
  );
  const panelW = (m: PanelMount) => (m === 'APLICAT' ? W : innerW);

  const parts: Part[] = [
    {
      cabinetLabel: label, name: 'Laterală',
      lengthMm: sideH, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
  ];
  if (mountTop === mountBottom) {
    parts.push({
      cabinetLabel: label, name: 'Blat corp / Fund corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    });
  } else {
    parts.push({
      cabinetLabel: label, name: 'Blat corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
    });
    parts.push({
      cabinetLabel: label, name: 'Fund corp',
      lengthMm: panelW(mountBottom), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
    });
  }

  if (input.shelves > 0) {
    const shelfW = assertPositiveDim(D - cc.shelfSetbackMm, 'lățime poliță', label);
    const shelfMat = input.shelf?.materialId ? findMaterial(catalogs, input.shelf.materialId) : carcass;
    // nesting-ul nu rotește piese (decorul curge pe lungime) — axa FAȚĂ–SPATE
    // înseamnă piesa rotită în lista de debitare, cu cantul frontal pe latura scurtă
    if (input.shelf?.decorAxis === 'FB') {
      parts.push({
        cabinetLabel: label, name: 'Poliță',
        lengthMm: shelfW, widthMm: innerW, qty: input.shelves,
        materialId: shelfMat.id, edges: { w1: fe },
      });
    } else {
      parts.push({
        cabinetLabel: label, name: 'Poliță',
        lengthMm: innerW, widthMm: shelfW, qty: input.shelves,
        materialId: shelfMat.id, edges: { l1: fe },
      });
    }
  }

  if (input.back.enabled) {
    if (!input.back.materialId) {
      throw new Error(`Corpul ${label}: spate activat fără material`);
    }
    const back = findMaterial(catalogs, input.back.materialId);
    const isFalt = input.back.mount === 'FALT';
    parts.push({
      cabinetLabel: label, name: 'Spate',
      lengthMm: isFalt ? H - cc.backRebateMm : H,
      widthMm: isFalt ? W - cc.backRebateMm : W,
      qty: 1, materialId: back.id, edges: {},
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

import type { CabinetInput, Catalogs, ConstructionConstants, Part, Warning } from './types';

export function findMaterial(catalogs: Catalogs, id: string) {
  const m = catalogs.materials.find((mat) => mat.id === id);
  if (!m) throw new Error(`Material inexistent în catalog: ${id}`);
  return m;
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
  const innerW = W - 2 * t;

  const parts: Part[] = [
    {
      cabinetLabel: label, name: 'Laterală',
      lengthMm: H, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
    {
      cabinetLabel: label, name: 'Blat corp / Fund corp',
      lengthMm: innerW, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
  ];

  if (input.shelves > 0) {
    parts.push({
      cabinetLabel: label, name: 'Poliță',
      lengthMm: innerW, widthMm: D - cc.shelfSetbackMm, qty: input.shelves,
      materialId: carcass.id, edges: { l1: fe },
    });
  }

  if (input.back.enabled) {
    const back = findMaterial(catalogs, input.back.materialId ?? '');
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

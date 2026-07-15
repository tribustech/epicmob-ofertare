// Verificarea „negru lucios" e trivială (doar 4 coduri RAL) — o ținem aici, într-un modul
// PUR (fără fs/path), ca engine-ul să nu importe lib/ral.ts (care citește un JSON de pe disc
// și ar băga node:fs/node:path în bundle-ul de browser prin estimarea live din client).
const BLACK_RAL = new Set(['9004', '9005', '9011', '9017']);

export function ralIsBlack(code: string | null | undefined): boolean {
  if (!code) return false;
  const num = String(code).toUpperCase().replace(/[^0-9]/g, ''); // "RAL 9005" → "9005"
  return BLACK_RAL.has(num);
}

export type FrontVopsitCostArgs = {
  areaSqm: number;
  frontCount: number;
  pricePerSqmEur: number;
  faces: number;
  finish: 'MAT' | 'LUCIOS';
  colorCategory: 'NORMALA' | 'VIE' | 'METALIZAT';
  ralBlack: boolean;
  hasHandleMilling: boolean;
  supplier: {
    handleMillingEur: number;
    vividSurchargeEur: number;
    metallicSurchargeEur: number;
    blackGlossEurPerFace: number;
  };
};

export function frontVopsitCostEur(args: FrontVopsitCostArgs): number {
  const {
    areaSqm,
    frontCount,
    pricePerSqmEur,
    faces,
    finish,
    colorCategory,
    ralBlack,
    hasHandleMilling,
    supplier,
  } = args;

  const suplCuloare =
    colorCategory === 'VIE'
      ? supplier.vividSurchargeEur
      : colorCategory === 'METALIZAT'
        ? supplier.metallicSurchargeEur
        : 0;

  const suplNegru =
    finish === 'LUCIOS' && ralBlack ? supplier.blackGlossEurPerFace * faces : 0;

  const frezManer = hasHandleMilling ? supplier.handleMillingEur * frontCount : 0;

  return areaSqm * (pricePerSqmEur + suplCuloare + suplNegru) + frezManer;
}

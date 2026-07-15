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

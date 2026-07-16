import type { BoardMaterial, Warning } from './types';

export interface BlatResult {
  materialId: string;
  pieces: number;
  fitsOnDepth: boolean;      // adâncimea încape pe lățimea plăcii (nu îmbinăm pe adâncime)
  totalAreaSqm: number;      // aria folosită (lungime × adâncime)
  boughtAreaSqm: number;     // aria cumpărată (plăci întregi la PER_SHEET; = folosită la m²)
  wastePct: number | null;   // pierderi din placa întreagă (null la m²)
  sheets: number | null;     // nr. plăci (PER_SHEET) pentru „Necesar de materiale"; null la m²
  boardCost: number;         // costul materialului blat
  cuttingCost: number;       // debitare = pieces × cutPricePerPiece
  warnings: Warning[];
}

/**
 * Blaturile vin în plăci cu lungime × lățime fixe (ex. 4100×600, 4100×900).
 * Nu se îmbină niciodată pe adâncime: dacă adâncimea cerută depășește lățimea plăcii,
 * calculul nu poate deduce automat numărul de plăci → avertizează și folosește nr. manual.
 * Altfel numărul de plăci = câte lungimi de placă acoperă lungimea blatului.
 */
export function computeBlat(args: {
  label: string;
  lengthMm: number;   // rularea pe perete (CabinetInput.widthMm)
  depthMm: number;    // față–spate
  material: BoardMaterial;
  manualPieces?: number;
  cutPricePerPiece: number;
}): BlatResult {
  const { label, lengthMm, depthMm, material, manualPieces, cutPricePerPiece } = args;

  const fitsOnDepth = depthMm <= material.sheetWidthMm;
  const pieces = fitsOnDepth
    ? Math.ceil(lengthMm / material.sheetLengthMm)
    : Math.max(0, Math.floor(manualPieces ?? 0));

  const totalAreaSqm = (lengthMm / 1000) * (depthMm / 1000);
  // ca la PAL: se cumpără plăci întregi și se taie din ele; restul e pierdere
  const isPerSheet = material.pricing.mode === 'PER_SHEET';
  const boughtAreaSqm = isPerSheet
    ? pieces * (material.sheetLengthMm / 1000) * (material.sheetWidthMm / 1000)
    : totalAreaSqm;
  const wastePct = isPerSheet && boughtAreaSqm > 0
    ? Math.max(0, (1 - totalAreaSqm / boughtAreaSqm) * 100)
    : null;
  const boardCost = material.pricing.mode === 'PER_SHEET'
    ? pieces * material.pricing.pricePerSheet
    : totalAreaSqm * material.pricing.pricePerSqm;
  const cuttingCost = pieces * cutPricePerPiece;

  const warnings: Warning[] = [];
  if (!fitsOnDepth) {
    warnings.push({
      code: 'BLAT_DEPTH_OVER_SHEET',
      message: `Blat ${label}: adâncimea (${depthMm} mm) depășește lățimea plăcii (${material.sheetWidthMm} mm) — introdu manual numărul de plăci`,
      cabinetLabel: label,
    });
  }

  return {
    materialId: material.id,
    pieces,
    fitsOnDepth,
    totalAreaSqm,
    boughtAreaSqm,
    wastePct,
    sheets: isPerSheet ? pieces : null,
    boardCost,
    cuttingCost,
    warnings,
  };
}

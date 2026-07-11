import type { ConstructionConstants, Warning } from './types';

const HINGE_MAX_KG: Record<number, number> = { 2: 6, 3: 12, 4: 18, 5: 24 };

export function doorWeightKg(
  widthMm: number,
  heightMm: number,
  thicknessMm: number,
  cc: ConstructionConstants,
): number {
  return (widthMm / 1000) * (heightMm / 1000) * thicknessMm * cc.boardDensityKgPerSqmPerMm;
}

export function suggestHingeCount(
  heightMm: number,
  widthMm: number,
  weightKg: number,
  cc: ConstructionConstants,
): { count: number; warnings: Warning[] } {
  let count = heightMm <= 900 ? 2 : heightMm <= 1500 ? 3 : heightMm <= 2100 ? 4 : 5;
  while (count < 5 && weightKg > HINGE_MAX_KG[count]) count++;

  const warnings: Warning[] = [];
  if (weightKg > HINGE_MAX_KG[count]) {
    warnings.push({
      code: 'DOOR_WEIGHT',
      message: `Ușă de ${weightKg.toFixed(1)}kg — peste limita pentru ${count} balamale standard; verifică balamale heavy-duty`,
    });
  }
  return { count, warnings };
}

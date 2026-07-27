import type { ConstructionConstants } from '@/lib/engine';

/** Parametrii de blat ai ansamblului, rezolvați (grosimea vine din materialul de blat ales). */
export interface SubBlatParams {
  baseHeightMm: number;   // „Înălțime corpuri bază" (≈900), de la podea la fața blatului
  blatDepthMm: number;    // adâncimea blatului (≈600)
  blatThicknessMm: number; // grosimea blatului (din Material.thicknessMm)
}

export type SubBlatDeducts = Pick<ConstructionConstants, 'subBlatClearanceMm' | 'subBlatDoorMm'>;

/** Dimensiunile derivate ale unui corp BAZA „sub blat":
 *  - înălțime carcasă = înălțime corpuri bază − picioare − grosime blat
 *  - adâncime corp (exterioară) = adâncime blat − luft sub blat − ușă
 *
 *  NB: adâncimea e cea EXTERIOARĂ (ca peste tot în app). Spatele (PFL + rezervă holtșurub) se
 *  scade separat de motor din lateralele/blatul corpului — NU se mai scade și aici, altfel s-ar
 *  număra de două ori. Ambele rezultate sunt „auto"; în editor rămân editabile. */
export function deriveSubBlatDims(
  params: SubBlatParams,
  legHeightMm: number,
  cc: SubBlatDeducts,
): { heightMm: number; depthMm: number } {
  const heightMm = Math.round(params.baseHeightMm - legHeightMm - params.blatThicknessMm);
  const depthMm = Math.round(params.blatDepthMm - cc.subBlatClearanceMm - cc.subBlatDoorMm);
  return { heightMm, depthMm };
}

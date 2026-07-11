import type { ConstructionConstants } from './types';

export const DEFAULT_CONSTRUCTION: ConstructionConstants = {
  frontGapMm: 3,
  outerGapMm: 2,
  shelfSetbackMm: 30,
  backRebateMm: 4,
  boardDensityKgPerSqmPerMm: 0.695,
  slideClearanceMm: 30,
  slideNominalsMm: [270, 300, 350, 400, 450, 500, 550, 600, 650],
  palBoxSlideAllowanceMm: 26,
  palBoxHeightDeductMm: 60,
  palBoxMinHeightMm: 80,
  metalBoxBottomDeductMm: 87,
  metalBoxBackHeightMm: 70,
  legsPerCabinet: 4,
  shelfSpanWarnMm: 900,
  doorMaxWidthMm: 650,
  blindPanelDefaultWidthMm: 100,
};

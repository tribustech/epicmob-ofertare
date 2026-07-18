import type { CabinetType, ConstructionConstants } from './types';

/** Tipurile de corp care stau pe picioare reglabile (soclu) — piciorul se scade din înălțime. */
export const LEGGED_TYPES = new Set<CabinetType>(['BAZA', 'INALT', 'COLT']);

export const DEFAULT_CONSTRUCTION: ConstructionConstants = {
  frontGapMm: 2,
  outerGapMm: 1,
  shelfSetbackMm: 30,
  backRebateMm: 4,
  boardDensityKgPerSqmPerMm: 0.695,
  slideClearanceMm: 30,
  slideNominalsMm: [270, 300, 350, 400, 450, 500, 550, 600, 650],
  palBoxSlideAllowanceMm: 26,
  palBoxHeightDeductMm: 60,
  palBoxMinHeightMm: 80,
  legsPerCabinet: 4,
  screwAllowanceMm: 2,
  shelfSpanWarnMm: 900,
  doorMaxWidthMm: 650,
  blindPanelDefaultWidthMm: 100,
  tandemboxFrontClearanceMm: 30,
  golaFrontDeductMm: 35,
  frontExtensionDefaultMm: 30,
  pazieDefaultWidthMm: 100,
};

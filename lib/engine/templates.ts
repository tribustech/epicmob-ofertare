import { expandCarcass } from './carcass';
import { expandDrawerBoxes } from './drawers';
import { expandFronts } from './fronts';
import { suggestHardware } from './hardware';
import type { CabinetInput, Catalogs, ConstructionConstants, ExpandedCabinet } from './types';

export function expandCabinet(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): ExpandedCabinet {
  if (input.type === 'SERTARE' && (!input.drawers || input.drawers.count <= 0)) {
    throw new Error(`Corpul ${input.label}: tipul SERTARE cere sertare definite`);
  }
  if (input.type !== 'SERTARE' && input.drawers) {
    throw new Error(`Corpul ${input.label}: sertarele sunt permise doar la tipul SERTARE`);
  }
  if (input.type === 'SERTARE' && input.doors > 0) {
    throw new Error(`Corpul ${input.label}: tipul SERTARE nu poate avea uși`);
  }
  if (input.doors > 0 && !input.frontMaterialId) {
    throw new Error(`Corpul ${input.label}: ușile cer un material de front`);
  }

  const carcass = expandCarcass(input, catalogs, cc);
  const fronts = expandFronts(input, catalogs, cc);
  const boxes = input.type === 'SERTARE'
    ? expandDrawerBoxes(input, catalogs, cc)
    : { parts: [], warnings: [] };
  const hardware = suggestHardware(input, fronts.fronts, catalogs, cc);

  return {
    input,
    parts: [...carcass.parts, ...fronts.parts, ...boxes.parts],
    hardware: hardware.suggestions,
    warnings: [...carcass.warnings, ...fronts.warnings, ...boxes.warnings, ...hardware.warnings],
  };
}

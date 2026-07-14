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
  const drawerCount = input.drawers?.count ?? 0;
  if (input.drawers && drawerCount <= 0) {
    throw new Error(`Corpul ${input.label}: sertarele cer cel puțin un sertar`);
  }
  if (drawerCount > 0 && input.doors > 0) {
    throw new Error(`Corpul ${input.label}: alege fie uși, fie sertare, nu ambele`);
  }
  if (drawerCount > 0 && input.shelves > 0) {
    throw new Error(`Corpul ${input.label}: corpul cu sertare nu poate avea polițe`);
  }
  if ((input.doors > 0 || drawerCount > 0) && !input.frontMaterialId) {
    throw new Error(`Corpul ${input.label}: fronturile cer un material de front`);
  }

  const carcass = expandCarcass(input, catalogs, cc);
  const fronts = expandFronts(input, catalogs, cc);
  const boxes = drawerCount > 0
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

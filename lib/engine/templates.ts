import { expandCarcass, findMaterial } from './carcass';
import { expandDrawerBoxes } from './drawers';
import { expandFronts } from './fronts';
import { suggestHardware } from './hardware';
import type { CabinetInput, Catalogs, ConstructionConstants, ExpandedCabinet, MaterialKind } from './types';

// mânerele frezate în front (profil J, îngropat) cer un material care se poate freza:
// doar MDF vopsit/înfoliat — PAL/PFL nu se frezează, iar melaminatul ar expune miezul brut
const MILLED_HANDLE_TYPES = new Set(['PROFIL_J', 'INGROPAT']);
const UNMILLABLE_KINDS: MaterialKind[] = ['PAL', 'PFL', 'MDF_MELAMINAT'];

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
  // MDF vopsit nu folosește un material de front din catalogul de plăci (frontMaterialId e null);
  // geometria vine dintr-un material generic MDF_VOPSIT rezolvat în expandFronts.
  const isVopsitFront = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  if ((input.doors > 0 || drawerCount > 0) && !input.frontMaterialId && !isVopsitFront) {
    throw new Error(`Corpul ${input.label}: fronturile cer un material de front`);
  }
  if (
    input.handle && MILLED_HANDLE_TYPES.has(input.handle.type)
    && input.frontMaterialId && (input.doors > 0 || drawerCount > 0)
  ) {
    const frontKind = findMaterial(catalogs, input.frontMaterialId).kind;
    if (UNMILLABLE_KINDS.includes(frontKind)) {
      const handleName = input.handle.type === 'PROFIL_J' ? 'profilul J' : 'mânerul îngropat';
      throw new Error(
        `Corpul ${input.label}: ${handleName} cere front din MDF vopsit sau înfoliat — ${frontKind} nu se poate freza`,
      );
    }
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

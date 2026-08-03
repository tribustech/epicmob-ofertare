import { LEGGED_TYPES } from '@/lib/engine/constants';
import type { CabinetInput, Part } from '@/lib/engine';

export const PLINTH_HEIGHT_MM = 100;
export const PLINTH_MODES = ['NONE', 'ASSEMBLY', 'CABINETS'] as const;
export type PlinthMode = (typeof PLINTH_MODES)[number];

export interface PlinthAssembly {
  id: string;
  name: string;
  plinthMode: string;
}

export interface PlinthCabinet {
  id: string;
  assemblyId: string | null;
  input: CabinetInput;
  plinthEnabled: boolean;
}

export function normalizePlinthMode(value: string | null | undefined): PlinthMode {
  return PLINTH_MODES.includes(value as PlinthMode) ? value as PlinthMode : 'NONE';
}

export function cabinetHasPlinth(
  modeValue: string | null | undefined,
  input: CabinetInput,
  plinthEnabled: boolean,
): boolean {
  const mode = normalizePlinthMode(modeValue);
  if (input.type === 'BLAT') return false;
  if (mode === 'ASSEMBLY') return LEGGED_TYPES.has(input.type);
  return mode === 'CABINETS' && plinthEnabled;
}

function part(label: string, name: string, lengthMm: number, materialId: string): Part {
  return {
    cabinetLabel: label,
    name,
    lengthMm,
    widthMm: PLINTH_HEIGHT_MM,
    qty: 1,
    materialId,
    edges: {},
  };
}

export function buildPlinthParts({
  assemblies,
  cabinets,
}: {
  assemblies: PlinthAssembly[];
  cabinets: PlinthCabinet[];
}): Part[] {
  const parts: Part[] = [];

  for (const assembly of assemblies) {
    const mode = normalizePlinthMode(assembly.plinthMode);
    const assemblyCabinets = cabinets.filter((cabinet) => cabinet.assemblyId === assembly.id);

    if (mode === 'ASSEMBLY') {
      const lengthByMaterial = new Map<string, number>();
      for (const cabinet of assemblyCabinets) {
        const { input } = cabinet;
        if (!cabinetHasPlinth(mode, input, cabinet.plinthEnabled) || input.widthMm <= 0 || !input.carcassMaterialId) continue;
        lengthByMaterial.set(
          input.carcassMaterialId,
          (lengthByMaterial.get(input.carcassMaterialId) ?? 0) + input.widthMm,
        );
      }
      for (const [materialId, lengthMm] of lengthByMaterial) {
        parts.push(part(assembly.name, 'Plintă ansamblu', lengthMm, materialId));
      }
    }

    if (mode === 'CABINETS') {
      for (const cabinet of assemblyCabinets) {
        const { input } = cabinet;
        if (!cabinetHasPlinth(mode, input, cabinet.plinthEnabled) || input.widthMm <= 0 || !input.carcassMaterialId) continue;
        parts.push(part(input.label, 'Plintă corp', input.widthMm, input.carcassMaterialId));
      }
    }
  }

  return parts;
}

import type { CabinetInput } from '@/lib/engine';

// inputJson vechi poate conține tipul dispărut 'SERTARE' și sistemul redenumit 'METAL_BOX'
export function normalizeCabinetInput(raw: unknown): CabinetInput {
  const input = raw as Omit<CabinetInput, 'type'> & { type: CabinetInput['type'] | 'SERTARE' };
  const type = input.type === 'SERTARE' ? 'BAZA' : input.type;
  const drawers = input.drawers && (input.drawers.system as string) === 'METAL_BOX'
    ? { ...input.drawers, system: 'TANDEMBOX' as const }
    : input.drawers;
  if (type === input.type && drawers === input.drawers) return input as CabinetInput;
  return { ...(input as CabinetInput), type, drawers };
}

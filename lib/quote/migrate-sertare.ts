import type { CabinetInput } from '@/lib/engine';

// inputJson vechi poate avea tipul dispărut 'SERTARE'
export type LegacyCabinetInput = Omit<CabinetInput, 'type'> & {
  type: CabinetInput['type'] | 'SERTARE';
};

export function migrateSertareInput(
  input: LegacyCabinetInput,
): { input: CabinetInput; changed: boolean } {
  if (input.type !== 'SERTARE') return { input: input as CabinetInput, changed: false };
  return { input: { ...input, type: 'BAZA' }, changed: true };
}

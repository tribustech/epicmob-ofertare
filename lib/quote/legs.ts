import type { HardwareRow } from '@/lib/catalog/convert';

// alege piciorul activ cu nominala == legHeightMm (cel mai ieftin); fallback la id-ul implicit
export function pickLegId(
  hardware: (HardwareRow & { active: boolean })[],
  legHeightMm: number,
  fallback: string | null,
): string | null {
  const candidates = hardware
    .filter((h) => h.active && h.category === 'PICIOR' && h.nominalLengthMm === legHeightMm)
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  return candidates[0]?.id ?? fallback;
}

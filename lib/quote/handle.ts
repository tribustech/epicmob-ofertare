import type { CabinetInput, FreeLine, HandleType } from '@/lib/engine';

export interface ProjectHandle { type: HandleType; itemId: string | null }

export const HANDLE_TYPE_OPTIONS: { value: HandleType; label: string }[] = [
  { value: 'APLICAT', label: 'Mâner aplicat' },
  { value: 'BUTON', label: 'Buton' },
  { value: 'INGROPAT', label: 'Mâner îngropat' },
  { value: 'PROFIL_J', label: 'Profil J (freză)' },
  { value: 'GOLA', label: 'Sistem GOLA' },
  { value: 'PUSH', label: 'Push (TIP-ON)' },
  { value: 'FARA', label: 'Fără mâner (front prelungit)' },
];

/** Moștenirea: corpul fără excepție primește mânerul proiectului; excepția de TIP
 *  fără produs ales moștenește produsul proiectului când tipul coincide. */
export function withResolvedHandle(input: CabinetInput, project: ProjectHandle): CabinetInput {
  if (!input.handle) {
    return { ...input, handle: { type: project.type, itemId: project.itemId ?? undefined } };
  }
  if (input.handle.itemId === undefined && input.handle.type === project.type && project.itemId) {
    return { ...input, handle: { ...input.handle, itemId: project.itemId } };
  }
  return input;
}

/** Costurile atipice de mâner — intră în bucket-ul de feronerie (primesc manopera %). */
export function handleExtraCost(
  input: CabinetInput,
  prices: { profilJPerFront: number; golaPricePerMl: number },
): FreeLine[] {
  const h = input.handle;
  if (!h) return [];
  const frontCount = (input.doors > 0 ? input.doors : 0) + (input.drawers?.count ?? 0);
  const lines: FreeLine[] = [];
  if (h.type === 'PROFIL_J' && frontCount > 0) {
    lines.push({ name: `Prelucrare profil J — ${input.label}`, amount: frontCount * prices.profilJPerFront });
  }
  if (h.type === 'GOLA' && frontCount > 0 && (input.frontMaterialId != null || input.mdfFront != null)) {
    // uși: un singur profil sus; sertare: câte un profil deasupra fiecărui front
    const rows = (input.drawers?.count ?? 0) > 0 ? input.drawers!.count : 1;
    lines.push({ name: `Profil GOLA — ${input.label}`, amount: rows * (input.widthMm / 1000) * prices.golaPricePerMl });
  }
  return lines;
}

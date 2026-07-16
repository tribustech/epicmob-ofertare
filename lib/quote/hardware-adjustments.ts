import { z } from 'zod';
import type { HardwareAdjustments, HardwareSlot } from '@/lib/engine';

export const HARDWARE_SLOTS: HardwareSlot[] = [
  'balamale', 'maner', 'sertare', 'picioare', 'suspendare', 'suporti-polita', 'cleme-soclu', 'holtsurub', 'aventos',
];

const slotAdjustmentSchema = z.object({
  itemId: z.string().min(1).optional(),
  qty: z.number().int().min(0).optional(),
}).refine((a) => a.itemId !== undefined || a.qty !== undefined, { message: 'Abatere goală' });

export const hardwareAdjustmentsSchema = z.object({
  slots: z.record(z.enum(HARDWARE_SLOTS as [HardwareSlot, ...HardwareSlot[]]), slotAdjustmentSchema).optional(),
  extra: z.array(z.object({ hardwareId: z.string().min(1), qty: z.number().int().min(1) })).optional(),
});

/** Abateri fără conținut → null (corpul rămâne complet pe automat). */
export function pruneAdjustments(adj: HardwareAdjustments | null): HardwareAdjustments | null {
  if (!adj) return null;
  const slots = Object.fromEntries(
    Object.entries(adj.slots ?? {}).filter(([, v]) => v && (v.itemId !== undefined || v.qty !== undefined)),
  );
  const extra = (adj.extra ?? []).filter((l) => l.hardwareId && l.qty > 0);
  if (Object.keys(slots).length === 0 && extra.length === 0) return null;
  return {
    ...(Object.keys(slots).length > 0 ? { slots } : {}),
    ...(extra.length > 0 ? { extra } : {}),
  };
}

/**
 * Citește `Cabinet.hardwareJson` în formatul nou (feronerie v4).
 * Formatul vechi (array de HardwareLine = „înlocuiește tot") se convertește
 * echivalent: toate sloturile auto pe 0 + liniile vechi ca extra — astfel
 * corpurile nemigrate păstrează exact feroneria de dinainte.
 */
export function normalizeHardwareJson(raw: string | null): HardwareAdjustments | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    const lines = parsed as { hardwareId: string; qty: number }[];
    return {
      slots: Object.fromEntries(HARDWARE_SLOTS.map((s) => [s, { qty: 0 }])),
      extra: lines.filter((l) => l.hardwareId && l.qty > 0),
    };
  }
  return pruneAdjustments(parsed as HardwareAdjustments);
}

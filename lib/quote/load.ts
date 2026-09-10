import { prisma } from '@/lib/db';
import type { Assembly, Quote } from '@prisma/client';
import type { CabinetInput, HandleType, HardwareAdjustments } from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { computeQuote, type QuoteInput, type QuoteResult, type SnapshotData } from './compute';
import { normalizeHardwareJson } from './hardware-adjustments';
import { normalizeCabinetInput } from './normalize-input';

export interface LoadedCabinet {
  id: string;
  sortOrder: number;
  assemblyId: string | null;
  plinthEnabled: boolean;
  input: CabinetInput;
  hardwareAdjustments: HardwareAdjustments | null;
  extraParts: ExtraPart[];
}

export async function loadQuote(id: string): Promise<{
  quote: Quote;
  assemblies: Assembly[];
  cabinets: LoadedCabinet[];
} | null> {
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: {
      cabinets: { orderBy: { sortOrder: 'asc' } },
      assemblies: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!quote) return null;
  const cabinets: LoadedCabinet[] = quote.cabinets.map((c) => ({
    id: c.id,
    sortOrder: c.sortOrder,
    assemblyId: c.assemblyId,
    plinthEnabled: c.plinthEnabled,
    input: normalizeCabinetInput(JSON.parse(c.inputJson)),
    hardwareAdjustments: normalizeHardwareJson(c.hardwareJson),
    extraParts: JSON.parse(c.extraPartsJson) as ExtraPart[],
  }));
  return { quote, assemblies: quote.assemblies, cabinets };
}

export function legHeightByCabinet(assemblies: Assembly[], cabinets: LoadedCabinet[]): Map<string, number> {
  const legHeightByAssembly = new Map(assemblies.map((a) => [a.id, a.legHeightMm]));
  const map = new Map<string, number>();
  for (const c of cabinets) {
    if (c.assemblyId) {
      const legHeightMm = legHeightByAssembly.get(c.assemblyId);
      if (legHeightMm !== undefined) map.set(c.id, legHeightMm);
    }
  }
  return map;
}

export function toQuoteInput(
  quote: { laborPct: number; freeLinesJson: string; loosePanelsJson?: string; handleType: string; handleItemId: string | null },
  cabinets: LoadedCabinet[],
  legHeightMap: Map<string, number> = new Map(),
  assemblies: Assembly[] = [],
): QuoteInput {
  return {
    laborPct: quote.laborPct,
    freeLines: JSON.parse(quote.freeLinesJson),
    loosePanels: JSON.parse(quote.loosePanelsJson ?? '[]'),
    cabinets: cabinets.map((c) => ({
      id: c.id,
      assemblyId: c.assemblyId,
      plinthEnabled: c.plinthEnabled,
      input: c.input,
      hardwareAdjustments: c.hardwareAdjustments,
      extraParts: c.extraParts,
      legHeightMm: legHeightMap.get(c.id) ?? null,
    })),
    assemblies: assemblies.map((a) => ({ id: a.id, name: a.name, plinthMode: a.plinthMode })),
    quoteHandle: { type: quote.handleType as HandleType, itemId: quote.handleItemId },
  };
}

export function tryComputeQuote(
  input: QuoteInput,
  snapshot: SnapshotData,
): { quote: QuoteResult | null; error: string | null } {
  try {
    return { quote: computeQuote(input, snapshot), error: null };
  } catch (e) {
    return { quote: null, error: e instanceof Error ? e.message : 'Eroare de calcul' };
  }
}

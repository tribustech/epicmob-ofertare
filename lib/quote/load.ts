import { prisma } from '@/lib/db';
import type { Assembly, Project } from '@prisma/client';
import type { CabinetInput, HardwareLine } from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { computeQuote, type QuoteInput, type QuoteResult, type SnapshotData } from './compute';

export interface LoadedCabinet {
  id: string;
  sortOrder: number;
  assemblyId: string | null;
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
}

export async function loadProject(id: string): Promise<{
  project: Project;
  assemblies: Assembly[];
  cabinets: LoadedCabinet[];
} | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      cabinets: { orderBy: { sortOrder: 'asc' } },
      assemblies: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!project) return null;
  const cabinets: LoadedCabinet[] = project.cabinets.map((c) => ({
    id: c.id,
    sortOrder: c.sortOrder,
    assemblyId: c.assemblyId,
    input: JSON.parse(c.inputJson) as CabinetInput,
    hardwareOverrides: c.hardwareJson ? (JSON.parse(c.hardwareJson) as HardwareLine[]) : null,
    extraParts: JSON.parse(c.extraPartsJson) as ExtraPart[],
  }));
  return { project, assemblies: project.assemblies, cabinets };
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
  project: { markupPct: number; freeLinesJson: string },
  cabinets: LoadedCabinet[],
  legHeightMap: Map<string, number> = new Map(),
): QuoteInput {
  return {
    markupPct: project.markupPct,
    freeLines: JSON.parse(project.freeLinesJson),
    cabinets: cabinets.map((c) => ({
      input: c.input,
      hardwareOverrides: c.hardwareOverrides,
      extraParts: c.extraParts,
      legHeightMm: legHeightMap.get(c.id) ?? null,
    })),
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

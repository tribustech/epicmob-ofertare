import { prisma } from '@/lib/db';
import type { Project } from '@prisma/client';
import type { CabinetInput, HardwareLine } from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { computeQuote, type QuoteInput, type QuoteResult, type SnapshotData } from './compute';

export interface LoadedCabinet {
  id: string;
  sortOrder: number;
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
}

export async function loadProject(id: string): Promise<{
  project: Project;
  cabinets: LoadedCabinet[];
  snapshot: SnapshotData | null;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { cabinets: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!project) return null;
  const cabinets: LoadedCabinet[] = project.cabinets.map((c) => ({
    id: c.id,
    sortOrder: c.sortOrder,
    input: JSON.parse(c.inputJson) as CabinetInput,
    hardwareOverrides: c.hardwareJson ? (JSON.parse(c.hardwareJson) as HardwareLine[]) : null,
    extraParts: JSON.parse(c.extraPartsJson) as ExtraPart[],
  }));
  const snapshot = project.snapshotJson ? (JSON.parse(project.snapshotJson) as SnapshotData) : null;
  return { project, cabinets, snapshot };
}

export function toQuoteInput(
  project: { markupPct: number; yieldFactor: number; freeLinesJson: string },
  cabinets: LoadedCabinet[],
): QuoteInput {
  return {
    markupPct: project.markupPct,
    yieldFactor: project.yieldFactor,
    freeLines: JSON.parse(project.freeLinesJson),
    cabinets: cabinets.map((c) => ({
      input: c.input,
      hardwareOverrides: c.hardwareOverrides,
      extraParts: c.extraParts,
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

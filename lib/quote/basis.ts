import type { Project } from '@prisma/client';
import { buildSnapshot } from './snapshot';
import type { SnapshotData } from './compute';

export type QuoteBasis =
  | { kind: 'LIVE'; snapshot: SnapshotData }
  | { kind: 'FROZEN'; snapshot: SnapshotData }
  | { kind: 'MISSING' };

export function isFrozenStatus(status: string): boolean {
  return status === 'TRIMISA' || status === 'ACCEPTATA';
}

export async function getQuoteBasis(project: Pick<Project, 'status' | 'snapshotJson'>): Promise<QuoteBasis> {
  if (isFrozenStatus(project.status)) {
    if (!project.snapshotJson) return { kind: 'MISSING' };
    return { kind: 'FROZEN', snapshot: JSON.parse(project.snapshotJson) as SnapshotData };
  }
  return { kind: 'LIVE', snapshot: await buildSnapshot() };
}

import type { Quote } from '@prisma/client';
import { buildSnapshot } from './snapshot';
import type { SnapshotData } from './compute';
import { isFrozenStatus } from './status';

export type QuoteBasis =
  | { kind: 'LIVE'; snapshot: SnapshotData }
  | { kind: 'FROZEN'; snapshot: SnapshotData }
  | { kind: 'MISSING' };

export { isFrozenStatus } from './status';

export async function getQuoteBasis(quote: Pick<Quote, 'status' | 'snapshotJson'>): Promise<QuoteBasis> {
  if (isFrozenStatus(quote.status)) {
    if (!quote.snapshotJson) return { kind: 'MISSING' };
    return { kind: 'FROZEN', snapshot: JSON.parse(quote.snapshotJson) as SnapshotData };
  }
  return { kind: 'LIVE', snapshot: await buildSnapshot() };
}

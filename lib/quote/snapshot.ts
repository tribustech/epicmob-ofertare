import { prisma } from '@/lib/db';
import type { SnapshotData } from './compute';

export async function buildSnapshot(): Promise<SnapshotData> {
  const [materials, edgeBands, hardware, cuttingRates, settings] = await Promise.all([
    prisma.material.findMany(),
    prisma.edgeBand.findMany(),
    prisma.hardwareItem.findMany(),
    prisma.cuttingRate.findMany(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!settings) throw new Error('Setările lipsesc — rulează npm run db:seed');
  return {
    takenAt: new Date().toISOString(),
    materials, edgeBands, hardware, cuttingRates,
    settings,
  };
}

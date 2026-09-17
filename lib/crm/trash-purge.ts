import { prisma } from '@/lib/db';
import { trashCutoff } from './trash';

/** Șterge definitiv clienții dați, cu tot ce ține de ei. Banii rămân în registru: mișcările
 *  și alocările de cheltuieli își pierd doar legătura cu proiectul (cheltuiala devine indirectă). */
export async function purgeClients(clientIds: string[]): Promise<number> {
  if (clientIds.length === 0) return 0;
  const projects = await prisma.project.findMany({ where: { clientId: { in: clientIds } }, select: { id: true } });
  const projectIds = projects.map((p) => p.id);
  await prisma.$transaction([
    ...(projectIds.length > 0 ? [
      prisma.movement.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null, incomeType: null } }),
      prisma.documentAllocation.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.quote.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.project.deleteMany({ where: { id: { in: projectIds } } }),
    ] : []),
    prisma.client.deleteMany({ where: { id: { in: clientIds } } }),
  ]);
  return clientIds.length;
}

/** Golirea automată: ce stă în coș de peste 30 de zile dispare. Rulează la deschiderea coșului. */
export async function purgeExpiredTrash(now = new Date()): Promise<number> {
  const expired = await prisma.client.findMany({
    where: { deletedAt: { not: null, lte: trashCutoff(now) } },
    select: { id: true },
  });
  return purgeClients(expired.map((c) => c.id));
}

/** Ce e în coș, cu numărul de proiecte și data ștergerii. */
export async function loadTrash() {
  const rows = await prisma.client.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    select: {
      id: true, name: true, stage: true, phone: true, deletedAt: true,
      _count: { select: { projects: true, documents: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, stage: c.stage, phone: c.phone, deletedAt: c.deletedAt!,
    projects: c._count.projects, documents: c._count.documents,
  }));
}

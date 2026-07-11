import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    where: { cabinets: { some: { assemblyId: null } } },
    include: { cabinets: { where: { assemblyId: null } } },
  });

  for (const project of projects) {
    const assembly = await prisma.assembly.create({
      data: { projectId: project.id, name: 'Ansamblu 1', legHeightMm: 100, sortOrder: 0 },
    });
    await prisma.cabinet.updateMany({
      where: { id: { in: project.cabinets.map((c) => c.id) } },
      data: { assemblyId: assembly.id },
    });
    console.log(`Proiect ${project.id}: ${project.cabinets.length} corpuri asignate la "${assembly.name}"`);
  }

  console.log(`Backfill complet: ${projects.length} proiecte actualizate.`);
}

main()
  .catch((e) => { console.error('BACKFILL FAIL:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

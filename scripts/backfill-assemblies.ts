import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const quotes = await prisma.quote.findMany({
    where: { cabinets: { some: { assemblyId: null } } },
    include: { cabinets: { where: { assemblyId: null } } },
  });

  for (const quote of quotes) {
    const assembly = await prisma.assembly.create({
      data: { quoteId: quote.id, name: 'Ansamblu 1', legHeightMm: 100, sortOrder: 0 },
    });
    await prisma.cabinet.updateMany({
      where: { id: { in: quote.cabinets.map((c) => c.id) } },
      data: { assemblyId: assembly.id },
    });
    console.log(`Proiect ${quote.id}: ${quote.cabinets.length} corpuri asignate la "${assembly.name}"`);
  }

  console.log(`Backfill complet: ${quotes.length} proiecte actualizate.`);
}

main()
  .catch((e) => { console.error('BACKFILL FAIL:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

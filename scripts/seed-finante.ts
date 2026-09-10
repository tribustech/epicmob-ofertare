/**
 * Finanțe F1 — seed idempotent (npm run db:seed-finante):
 * 1. Categoriile de cost implicite (upsert pe nume + scope; nu suprascrie modificările ulterioare).
 * 2. Două conturi de pornire („Cont firmă" BANCA, „Cash atelier" CASH) doar dacă nu există niciun cont.
 */
import { prisma } from '../lib/db';
import { DEFAULT_COST_CATEGORIES } from '../lib/finance/constants';

async function main() {
  let created = 0;
  for (const [i, c] of DEFAULT_COST_CATEGORIES.entries()) {
    const existing = await prisma.costCategory.findUnique({ where: { name_scope: { name: c.name, scope: c.scope } } });
    if (existing) continue;
    await prisma.costCategory.create({ data: { name: c.name, scope: c.scope, sortOrder: i, quoteBucket: c.quoteBucket ?? null } });
    created++;
  }
  console.log(`Categorii de cost create: ${created} (total ${await prisma.costCategory.count()})`);

  if ((await prisma.account.count()) === 0) {
    await prisma.account.createMany({
      data: [
        { name: 'Cont firmă', kind: 'BANCA', sortOrder: 0 },
        { name: 'Cash atelier', kind: 'CASH', sortOrder: 1 },
      ],
    });
    console.log('Conturi create: Cont firmă (bancă), Cash atelier (cash)');
  } else {
    console.log('Conturi existente: nimic de creat');
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());

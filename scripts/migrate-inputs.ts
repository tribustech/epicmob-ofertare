import { PrismaClient } from '@prisma/client';
import { normalizeCabinetInput } from '../lib/quote/normalize-input';

const prisma = new PrismaClient();

async function main() {
  const cabinets = await prisma.cabinet.findMany();
  let migrated = 0;
  for (const cab of cabinets) {
    const raw = JSON.parse(cab.inputJson);
    const input = normalizeCabinetInput(raw);
    const next = JSON.stringify(input);
    if (next === cab.inputJson) continue;
    await prisma.cabinet.update({ where: { id: cab.id }, data: { inputJson: next } });
    migrated += 1;
  }
  console.log(`Migrate: ${migrated} corpuri normalizate (din ${cabinets.length} total).`);
}

main().finally(() => prisma.$disconnect());

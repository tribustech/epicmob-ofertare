import { PrismaClient } from '@prisma/client';
import { migrateSertareInput, type LegacyCabinetInput } from '../lib/quote/migrate-sertare';

const prisma = new PrismaClient();

async function main() {
  const cabinets = await prisma.cabinet.findMany();
  let migrated = 0;
  for (const cab of cabinets) {
    const legacy = JSON.parse(cab.inputJson) as LegacyCabinetInput;
    const { input, changed } = migrateSertareInput(legacy);
    if (!changed) continue;
    await prisma.cabinet.update({
      where: { id: cab.id },
      data: { inputJson: JSON.stringify(input) },
    });
    migrated += 1;
  }
  console.log(`Migrate: ${migrated} corpuri SERTARE → BAZA (din ${cabinets.length} total).`);
}

main().finally(() => prisma.$disconnect());

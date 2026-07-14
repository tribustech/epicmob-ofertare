import { PrismaClient } from '@prisma/client';
import { buildSnapshot } from '../lib/quote/snapshot';
import { computeQuote } from '../lib/quote/compute';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();

async function main() {
  const pal = await prisma.material.findFirstOrThrow({ where: { kind: 'PAL', active: true } });
  const pfl = await prisma.material.findFirstOrThrow({ where: { kind: 'PFL', active: true } });
  const band = await prisma.edgeBand.findFirstOrThrow({ where: { active: true } });

  const input: CabinetInput = {
    label: 'SMOKE-B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: pal.id, frontMaterialId: pal.id,
    back: { enabled: true, materialId: pfl.id, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: band.id, frontPerimeterId: band.id },
  };

  const project = await prisma.project.create({
    data: {
      name: 'SMOKE TEST', laborPct: 120, yieldFactor: 0.8,
      cabinets: { create: [{ sortOrder: 0, inputJson: JSON.stringify(input) }] },
    },
  });

  try {
    const snapshot = await buildSnapshot();
    const quote = computeQuote(
      { laborPct: 120, freeLines: [], cabinets: [{ input, hardwareOverrides: null, extraParts: [] }] },
      snapshot,
    );
    if (!(quote.costs.totalCost > 0)) throw new Error('Cost total zero');
    if (!(quote.costs.sellPrice > quote.costs.totalCost)) throw new Error('Adaosul nu s-a aplicat');
    if (quote.parts.length < 5) throw new Error('Prea puține piese generate');
    if (quote.cutList.length < 1) throw new Error('Lista de debitare e goală');
    console.log('SMOKE OK:', {
      piese: quote.parts.length,
      costTotal: quote.costs.totalCost.toFixed(2),
      pretVanzare: quote.costs.sellPrice.toFixed(2),
      leiPerMl: quote.costs.leiPerMl?.toFixed(0),
    });
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
  }
}

main()
  .catch((e) => { console.error('SMOKE FAIL:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

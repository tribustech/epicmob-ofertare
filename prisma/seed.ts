import { PrismaClient } from '@prisma/client';
import { DEFAULT_CONSTRUCTION } from '../lib/engine';

const prisma = new PrismaClient();

async function main() {
  const materials = [
    { id: 'pal-alb', name: 'PAL alb W980 18mm', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null },
    { id: 'pal-stejar', name: 'PAL stejar Halifax 18mm', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 330, pricePerSqm: null },
    { id: 'pfl-alb', name: 'PFL alb 3mm', kind: 'PFL', thicknessMm: 3, sheetLengthMm: 2850, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 100, pricePerSqm: null },
    { id: 'mdf-vopsit', name: 'MDF vopsit mat 18mm', kind: 'MDF_VOPSIT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450 },
    { id: 'mdf-infoliat', name: 'MDF înfoliat 18mm', kind: 'MDF_INFOLIAT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 320 },
  ];
  for (const m of materials) {
    await prisma.material.upsert({ where: { id: m.id }, update: m, create: m });
  }
  // Produsul implicit pentru fronturile din sticlă. Nu suprascriem prețul la seed,
  // astfel încât valoarea ajustată ulterior din Catalog > Materiale să fie păstrată.
  await prisma.material.upsert({
    where: { id: 'sticla-rama-standard' },
    update: {},
    create: {
      id: 'sticla-rama-standard', name: 'Sticlă cu ramă (complet)', kind: 'STICLA_RAMA',
      thicknessMm: 20, sheetLengthMm: 3000, sheetWidthMm: 2000,
      pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 400,
      category: 'PLACA', active: true, hasGrain: false,
    },
  });
  await prisma.material.upsert({
    where: { id: 'sticla-polita-standard' },
    update: {},
    create: {
      id: 'sticla-polita-standard', name: 'Sticlă poliță clară 8mm', kind: 'STICLA_POLITA',
      thicknessMm: 8, sheetLengthMm: 3000, sheetWidthMm: 2000,
      pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 300,
      category: 'PLACA', active: true, hasGrain: false,
    },
  });

  const edgeBands = [
    { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1 },
    { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2 },
    { id: 'abs-2', name: 'ABS 2mm', thicknessMm: 2, pricePerMl: 3 },
  ];
  for (const e of edgeBands) {
    await prisma.edgeBand.upsert({ where: { id: e.id }, update: e, create: e });
  }

  const hardware = [
    { id: 'balama-blum-cliptop', name: 'Balama Blum ClipTop Blumotion 110° + plăcuță', category: 'BALAMA', pricePerUnit: 15, nominalLengthMm: null, loadClassKg: null },
    { id: 'tandembox-450', name: 'Set Blum Tandembox antaro 450mm 30kg', category: 'SERTAR', pricePerUnit: 180, nominalLengthMm: 450, loadClassKg: 30 },
    { id: 'tandembox-500', name: 'Set Blum Tandembox antaro 500mm 30kg', category: 'SERTAR', pricePerUnit: 190, nominalLengthMm: 500, loadClassKg: 30 },
    { id: 'glisiera-bile-450', name: 'Glisiere bile 450mm (pereche)', category: 'SERTAR', pricePerUnit: 35, nominalLengthMm: 450, loadClassKg: 25 },
    { id: 'maner-standard', name: 'Mâner standard 128mm', category: 'MANER', pricePerUnit: 10, nominalLengthMm: null, loadClassKg: null },
    { id: 'picior-reglabil', name: 'Picior reglabil 100mm', category: 'PICIOR', pricePerUnit: 2.5, nominalLengthMm: null, loadClassKg: null },
    { id: 'sina-suspendare', name: 'Set suspendare corp (2 suporți + șină)', category: 'SINA_SUSPENDARE', pricePerUnit: 8, nominalLengthMm: null, loadClassKg: null },
    { id: 'holtsurub-std', name: 'Holtșurub 3.5×16', category: 'HOLTSURUB', pricePerUnit: 0.1, nominalLengthMm: null, loadClassKg: null },
    { id: 'tandembox-m-500', name: 'Tandembox antaro M (83mm) 500mm', category: 'SERTAR', pricePerUnit: 120, nominalLengthMm: 500, boxHeightMm: 83 },
    { id: 'tandembox-k-500', name: 'Tandembox antaro K (115mm) 500mm', category: 'SERTAR', pricePerUnit: 135, nominalLengthMm: 500, boxHeightMm: 115 },
    { id: 'tandembox-c-500', name: 'Tandembox antaro C (192mm) 500mm', category: 'SERTAR', pricePerUnit: 155, nominalLengthMm: 500, boxHeightMm: 192 },
    { id: 'tandembox-d-500', name: 'Tandembox antaro D (224mm) 500mm', category: 'SERTAR', pricePerUnit: 170, nominalLengthMm: 500, boxHeightMm: 224 },
  ];
  for (const h of hardware) {
    await prisma.hardwareItem.upsert({ where: { id: h.id }, update: h, create: h });
  }

  const cuttingRates = [
    { id: 'debitare-pfl', maxThicknessMm: 10, pricePerSheet: 33 },
    { id: 'debitare-pal-18', maxThicknessMm: 32, pricePerSheet: 50 },
    { id: 'debitare-pal-38', maxThicknessMm: 38, pricePerSheet: 70 },
  ];
  for (const c of cuttingRates) {
    await prisma.cuttingRate.upsert({ where: { id: c.id }, update: c, create: c });
  }

  const settings = {
    id: 1,
    laborPct: 120,
    profilJPerFront: 25,
    golaPricePerMl: 90,
    sheetYieldFactor: 0.8,
    cutKerfMm: 4,
    cutTrimMm: 10,
    // convenția atelierului EpicMob: rost 2mm între uși, 1mm la margine → ușă = L/n − 2mm, H − 2mm
    constructionJson: JSON.stringify({ ...DEFAULT_CONSTRUCTION, frontGapMm: 2, outerGapMm: 1 }),
    defaultHingeId: 'balama-blum-cliptop',
    defaultHandleId: 'maner-standard',
    defaultLegId: 'picior-reglabil',
    defaultRailId: 'sina-suspendare',
  };
  await prisma.appSettings.upsert({ where: { id: 1 }, update: settings, create: settings });

  console.log('Seed complet.');
}

main().finally(() => prisma.$disconnect());

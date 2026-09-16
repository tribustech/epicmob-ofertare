// Ofertă „Dulap uși glisante 240×225×60" — client nou + proiect + ofertă, calculată cu codul paginii de ofertă.
import { PrismaClient } from '@prisma/client';
import { loadQuote, toQuoteInput, tryComputeQuote, legHeightByCabinet } from '../lib/quote/load';
import { getQuoteBasis } from '../lib/quote/basis';
import { estimateCabinetCost } from '../lib/quote/estimate';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();
const USER = 'cmtvinrpq0000hliggi5weh61';
const CARCASS = 'cmtikjvhf0000hla8aepnpl49'; // Egger W990 ST9 Alb Crystal, PAL 18
const PFL = 'pfl-alb';
const BAND_C = 'abs-04';
const BAND_F = 'abs-1';
const BARA = 'cmta263u2000hhlaw4tr36jsl';
const W = 600, H = 2250, D = 500; // 4 coloane × 600 = 2400; adâncime carcasă 500 + 100 sistem glisare = 600

const H_JOS = 530, H_SUS = H - H_JOS; // laterale: corp jos cu 2 sertare (~21 cm front) + corp sus cu polițe
function col(label: string, o: { drawers?: boolean; shelves: number; bara?: boolean; type?: 'BAZA' | 'SUSPENDAT'; h?: number }): { input: CabinetInput; hw: object | null } {
  const input = {
    label, type: o.type ?? 'BAZA', widthMm: W, heightMm: o.h ?? H, depthMm: D,
    mount: { top: 'INCADRAT', bottom: 'INCADRAT' },
    shelves: o.shelves, shelf: { materialId: CARCASS },
    doors: 0, carcassMaterialId: CARCASS,
    frontKind: 'PAL', frontMaterialId: o.drawers ? CARCASS : null,
    ...(o.drawers ? { drawers: { count: 2, system: 'TANDEMBOX' }, hardwareSel: { tandemboxHeightMm: 115 } } : {}),
    back: { enabled: true, materialId: PFL, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: BAND_C, frontPerimeterId: o.drawers ? BAND_F : null },
  } as CabinetInput;
  const hw = o.drawers
    ? { slots: { sertare: { itemId: 'tandembox-450' }, maner: { itemId: 'maner-standard' } } }
    : o.bara ? { extra: [{ hardwareId: BARA, qty: 1 }] } : null;
  return { input, hw };
}

async function main() {
  const NAME = 'Dulap uși glisante 240×225';
  const CLIENT = 'Client nou — dulap glisant 240';
  const wants = 'Dulap cu uși glisante 240×225×60 cm, PAL Egger/Kronospan, sistem glisare Häfele, 4 sertare interioare';

  // idempotent: șterge o rulare anterioară
  const old = await prisma.client.findFirst({ where: { name: CLIENT }, include: { projects: true } });
  if (old) {
    for (const p of old.projects) { await prisma.quote.deleteMany({ where: { projectId: p.id } }); await prisma.project.delete({ where: { id: p.id } }); }
    await prisma.client.delete({ where: { id: old.id } });
  }

  const client = await prisma.client.create({ data: { name: CLIENT, stage: 'CALIFICAT', source: 'Altul', wants, createdById: USER } });
  await prisma.event.create({ data: { type: 'CLIENT_CREATED', clientId: client.id, userId: USER, payloadJson: JSON.stringify({ source: 'Altul' }) } });
  const project = await prisma.project.create({ data: { name: NAME, clientId: client.id, status: 'OFERTARE', createdById: USER, description: wants } });
  await prisma.event.create({ data: { type: 'PROJECT_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ name: NAME }) } });

  // 2 uși glisante × 122 cm pe toată lățimea de 240
  const loose = [{ name: 'Ușă glisantă', materialId: CARCASS, lengthMm: 2200, widthMm: 1220, qty: 2, edgeBandId: BAND_F, edgeMode: 'ALL' }];
  const free = [{ name: 'Sistem glisare Häfele Slido (2 uși, soft-close) — estimare', amount: 900, inCommission: false }];
  const observatii = [
    'Dulap 240×225×60 cm cu 2 uși glisante (sistem Häfele), PAL 18 mm.',
    'Interior: 4 coloane × 60 cm — laterale cu 4 polițe + 2 sertare Blum Tandembox fiecare (4 sertare), mijloc cu 2 polițe sus + bară de haine.',
    'Adâncime totală 60 cm: carcase 50 cm + sistem de glisare. Decorul PAL se alege împreună cu clientul.',
  ].join('\n');
  const quote = await prisma.quote.create({
    data: {
      projectId: project.id, version: 1, name: NAME, clientName: CLIENT, status: 'CIORNA', observatii,
      laborPct: 120, yieldFactor: 0.8, handleType: 'APLICAT', handleItemId: 'maner-standard',
      freeLinesJson: JSON.stringify(free), loosePanelsJson: JSON.stringify(loose),
      assemblies: { create: [{ name: 'Dressing', kind: 'FARA_BLAT', legHeightMm: 100, plinthMode: 'NONE', sortOrder: 0 }] },
    },
    include: { assemblies: true },
  });
  await prisma.event.create({ data: { type: 'QUOTE_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ quoteId: quote.id, version: 1 }) } });
  const asmId = quote.assemblies[0].id;

  const cols = [
    col('C1 Stânga jos — 2 sertare', { drawers: true, shelves: 0, h: H_JOS }),
    col('C1 Stânga sus — polițe', { shelves: 3, type: 'SUSPENDAT', h: H_SUS }),
    col('C2 Mijloc stânga — bară haine', { shelves: 2, bara: true }),
    col('C3 Mijloc dreapta — bară haine', { shelves: 2, bara: true }),
    col('C4 Dreapta jos — 2 sertare', { drawers: true, shelves: 0, h: H_JOS }),
    col('C4 Dreapta sus — polițe', { shelves: 3, type: 'SUSPENDAT', h: H_SUS }),
  ];
  await prisma.$transaction(cols.map((c, idx) => prisma.cabinet.create({
    data: { quoteId: quote.id, assemblyId: asmId, sortOrder: idx, inputJson: JSON.stringify(c.input), hardwareJson: c.hw ? JSON.stringify(c.hw) : null, plinthEnabled: false },
  })));

  // calcul identic cu pagina de ofertă
  const data = (await loadQuote(quote.id))!;
  const basis = await getQuoteBasis(data.quote);
  const snap = (basis as any).snapshot;
  const legMap = legHeightByCabinet(data.assemblies, data.cabinets);
  const q = toQuoteInput(data.quote, data.cabinets, legMap, data.assemblies);
  const r = tryComputeQuote(q, snap);
  if (!r.quote) { console.error('COMPUTE ERROR:', r.error); process.exit(1); }
  const b = r.quote.costs.breakdown;
  console.log(`client=${client.id} project=${project.id} quote=${quote.id}`);
  console.log(`TOTAL: ${r.quote.costs.sellPrice.toFixed(0)} lei (cost ${r.quote.costs.totalCost.toFixed(0)})`);
  console.log(`  plăci ${b.boards.toFixed(0)} | cant ${b.edging.toFixed(0)} | debitare ${b.cuttingService.toFixed(0)} | feronerie ${b.hardware.toFixed(0)} | manoperă ${b.labor.toFixed(0)}`);
  console.log('  breakdown:', JSON.stringify(b));
  console.log('  warnings:', JSON.stringify((r.quote as any).warnings ?? []).slice(0, 800));
  console.log('  sheets:', JSON.stringify((r.quote as any).sheets ?? (r.quote as any).cutList?.summary ?? null)?.slice(0, 600));
  for (const c of data.cabinets) {
    const est = estimateCabinetCost({ input: c.input, hardwareAdjustments: c.hardwareAdjustments ?? null, extraParts: c.extraParts ?? [] }, snap, { laborPct: 120, yieldFactor: 0.8, legHeightMm: legMap.get(c.id) ?? null, quoteHandle: { type: 'APLICAT', itemId: 'maner-standard' } });
    console.log(`     ${String(c.input.label).padEnd(34)} : ${est.sell.toFixed(0)}`);
  }
  console.log('  URL: http://localhost:3000/oferte/' + quote.id + '/oferta');
}
main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

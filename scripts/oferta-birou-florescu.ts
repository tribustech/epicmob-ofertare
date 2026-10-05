// Ofertă „Birou — Andreea Florescu" din planșele designerului (COTE BIROU.pdf) + randări.
// Perete 2900: 4 suspendate albe 600×873×398 + coloană centrală 500 stejar (corp jos 860, blat mic 40,
// 3 nișe 350 cu poliță 40, corp sus 594). 2 blaturi de birou albe 1150×700 (cadrele electrice — clientul).
// Riflaj + LED = linii libere estimate. Client nou + proiect + ofertă (ciornă). Idempotent.
import { PrismaClient } from '@prisma/client';
import { loadQuote, toQuoteInput, tryComputeQuote, legHeightByCabinet } from '../lib/quote/load';
import { getQuoteBasis } from '../lib/quote/basis';
import { estimateCabinetCost } from '../lib/quote/estimate';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();
const USER = 'cmtvinrpq0000hliggi5weh61';
const ALB = 'decor-egger-w1000st9-placa';      // Egger W1000 ST9 Alb Premium (alb cald), PAL 18
const STEJAR = 'decor-egger-h3170st12-placa';  // Egger H3170 ST12 Stejar Kendal Natur, PAL 18
const PFL = 'pfl-alb';
const BAND_C = 'abs-04';
const BAND_F = 'abs-1';
const BAND_2 = 'abs-2';
const SUPORT_POLITA = 'cms2zkr6p0001lc04x69zo1n7';
const CLEMA_SOCLU = 'cms2znvot0002lc046h02a5vh';

type O = { doors?: number; shelves?: number; front?: boolean; back?: 'PFL' | 'PAL' };
function mk(label: string, type: CabinetInput['type'], mat: string, w: number, h: number, d: number, o: O): CabinetInput {
  const hasFront = o.front !== false && (o.doors ?? 0) > 0;
  return {
    label, type, widthMm: w, heightMm: h, depthMm: d,
    mount: { top: 'INCADRAT', bottom: 'INCADRAT' },
    shelves: o.shelves ?? 0, shelf: { materialId: mat },
    doors: o.doors ?? 0, carcassMaterialId: mat,
    frontKind: 'PAL', frontMaterialId: hasFront ? mat : null,
    back: o.back === 'PAL' ? { enabled: true, materialId: mat, mount: 'FALT' } : { enabled: true, materialId: PFL, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: BAND_C, frontPerimeterId: hasFront ? BAND_F : null },
    ...(hasFront ? { handle: { type: 'FARA' } } : {}),
  } as CabinetInput;
}

async function main() {
  const NAME = 'Birou — Andreea Florescu';
  const CLIENT = 'Andreea Florescu';
  const PHONE = '0744654145';
  const wants = 'Birou în apartament nou: perete 2,90 m cu suspendate albe, coloană centrală stejar cu nișe, 2 birouri reglabile, riflaj lemn. Randări de la designer. Stil cald & natural, PAL, alb cald. Termen: cât mai repede. Contact preferat: WhatsApp.';

  const old = await prisma.client.findFirst({ where: { OR: [{ name: CLIENT }, { phone: PHONE }] }, include: { projects: true } });
  if (old) {
    for (const p of old.projects) {
      await prisma.event.deleteMany({ where: { projectId: p.id } });
      await prisma.quote.deleteMany({ where: { projectId: p.id } });
      await prisma.project.delete({ where: { id: p.id } });
    }
    await prisma.event.deleteMany({ where: { clientId: old.id } });
    await prisma.client.delete({ where: { id: old.id } });
  }

  const client = await prisma.client.create({ data: { name: CLIENT, phone: PHONE, stage: 'CALIFICAT', source: 'Formular site', wants, createdById: USER } });
  await prisma.event.create({ data: { type: 'CLIENT_CREATED', clientId: client.id, userId: USER, payloadJson: JSON.stringify({ source: 'Formular site' }) } });
  const project = await prisma.project.create({ data: { name: NAME, clientId: client.id, status: 'OFERTARE', createdById: USER, description: wants } });
  await prisma.event.create({ data: { type: 'PROJECT_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ name: NAME }) } });

  const loose = [
    // blat mic peste corpul de jos (540×638) + polițele dintre nișe — PAL stejar dublat 2×18 ≈ 40 mm
    { name: 'Blat mic coloană 540×638 (PAL dublat)', materialId: STEJAR, lengthMm: 638, widthMm: 540, qty: 2, edgeBandId: BAND_2, edgeMode: 'ALL' },
    { name: 'Dublură poliță nișă 40 mm', materialId: STEJAR, lengthMm: 464, widthMm: 450, qty: 2, edgeBandId: BAND_2, edgeMode: 'L1' },
    // blaturi birou albe 1150×700, PAL dublat (~36 mm) — cadrele electrice le cumpără clientul
    { name: 'Blat birou 1150×700 (PAL dublat)', materialId: ALB, lengthMm: 1150, widthMm: 700, qty: 4, edgeBandId: BAND_2, edgeMode: 'ALL' },
  ];
  const free = [
    // Hornbach „Panou riflaj acustic stejar natur furniruit 18×572×2400” 376,48 lei/buc (oct 2026): 2 zone × 1200 lat →
    // 2 panouri întregi/zonă + fâșie de ~60 mm (ambele fâșii dintr-un al 5-lea panou); resturile de 650 mm nu se refolosesc.
    { name: 'Riflaj acustic stejar natur furniruit, pe pâslă — 5 panouri 572×2400 (~4,2 m²) + adeziv', amount: 1950, inCommission: false },
    { name: 'Bandă LED sub suspendate + nișe (profil, sursă, montaj)', amount: 600, inCommission: false },
  ];
  const observatii = [
    'Mobilier birou conform planșelor designerului (perete 2,90 m, h ≈ 2,72 m).',
    'Sus: 4 corpuri suspendate 60 × 87 cm, PAL Egger W1000 Alb Premium, fronturi fără mâner (deschidere de jos).',
    'Centru: coloană 50 cm PAL Egger H3170 Stejar Kendal Natur — corp jos cu ușă, blat 40 mm cu priză, 3 nișe deschise cu iluminare LED, corp închis sus.',
    'Două blaturi de birou 115 × 70 cm, PAL alb dublat. NU sunt incluse cadrele (picioarele) electrice reglabile pe înălțime — se achiziționează de client; le montăm noi blaturile pe ele.',
    'Cadre electrice recomandate (alb, 2 motoare, orientativ ~870–2.400 lei/buc): Arka Chairs ST24 (72–120 cm, 120 kg), Arka Chairs ST30 (anti-coliziune), StableDesk Plus / Biz Pro (125 kg). Le putem achiziționa noi la cerere.',
    'Riflaj lemn pe peretele din spatele birourilor (~4,2 m²) și banda LED incluse. Cotele finale se măsoară la fața locului.',
  ].join('\n');
  const quote = await prisma.quote.create({
    data: {
      projectId: project.id, version: 1, name: NAME, clientName: CLIENT, status: 'CIORNA', observatii,
      laborPct: 120, yieldFactor: 0.8, handleType: 'FARA',
      freeLinesJson: JSON.stringify(free), loosePanelsJson: JSON.stringify(loose),
      assemblies: { create: [{ name: 'Birou', kind: 'FARA_BLAT', legHeightMm: 100, plinthMode: 'CABINETS', sortOrder: 0 }] },
    },
    include: { assemblies: true },
  });
  await prisma.event.create({ data: { type: 'QUOTE_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ quoteId: quote.id, version: 1 }) } });
  const asmId = quote.assemblies[0].id;

  const shelfHw = { slots: { 'suporti-polita': { itemId: SUPORT_POLITA } } };
  const rows: { input: CabinetInput; hw?: object }[] = [
    { input: mk('S1 Suspendat stânga', 'SUSPENDAT', ALB, 600, 873, 398, { doors: 1, shelves: 1 }), hw: shelfHw },
    { input: mk('S2 Suspendat stânga', 'SUSPENDAT', ALB, 600, 873, 398, { doors: 1, shelves: 1 }), hw: shelfHw },
    { input: mk('C1 Corp jos coloană', 'BAZA', STEJAR, 500, 860, 600, { doors: 1, shelves: 1 }),
      hw: { slots: { 'suporti-polita': { itemId: SUPORT_POLITA }, 'cleme-soclu': { itemId: CLEMA_SOCLU } } } },
    { input: mk('C2 Nișe deschise 3 × 350', 'SUSPENDAT', STEJAR, 500, 1130, 468, { shelves: 2, back: 'PAL' }), hw: shelfHw },
    { input: mk('C3 Corp sus coloană', 'SUSPENDAT', STEJAR, 500, 594, 468, { doors: 1 }) },
    { input: mk('S3 Suspendat dreapta', 'SUSPENDAT', ALB, 600, 873, 398, { doors: 1, shelves: 1 }), hw: shelfHw },
    { input: mk('S4 Suspendat dreapta', 'SUSPENDAT', ALB, 600, 873, 398, { doors: 1, shelves: 1 }), hw: shelfHw },
  ];
  await prisma.$transaction(rows.map((r, idx) => prisma.cabinet.create({
    data: { quoteId: quote.id, assemblyId: asmId, sortOrder: idx, inputJson: JSON.stringify(r.input), hardwareJson: r.hw ? JSON.stringify(r.hw) : null,
      plinthEnabled: r.input.type === 'BAZA' },
  })));

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
  console.log('  breakdown:', JSON.stringify(b));
  console.log('  warnings:', JSON.stringify(r.quote.warnings ?? []).slice(0, 1500));
  console.log('  unresolved:', JSON.stringify((r.quote as any).unresolvedHardware ?? []).slice(0, 800));
  console.log('  hardware:', JSON.stringify((r.quote as any).hardwareSummary ?? []));
  for (const c of data.cabinets) {
    const est = estimateCabinetCost({ input: c.input, hardwareAdjustments: c.hardwareAdjustments ?? null, extraParts: c.extraParts ?? [] }, snap,
      { laborPct: 120, yieldFactor: 0.8, legHeightMm: legMap.get(c.id) ?? null, quoteHandle: { type: 'FARA' } });
    console.log(`     ${String(c.input.label).padEnd(30)} ${c.input.widthMm}×${c.input.heightMm}×${c.input.depthMm} : ${est.sell.toFixed(0)}`);
  }
  console.log('  URL: /oferte/' + quote.id + '/oferta');
}
main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

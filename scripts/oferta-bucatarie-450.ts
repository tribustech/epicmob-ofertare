// Ofertă „Bucătărie 450×249" din schița de mână + poza de inspirație (corpuri albe, suspendate stejar, blat stejar).
// Client nou + proiect + ofertă (ciornă), calculată cu codul paginii de ofertă. Idempotent.
import { PrismaClient } from '@prisma/client';
import { loadQuote, toQuoteInput, tryComputeQuote, legHeightByCabinet } from '../lib/quote/load';
import { getQuoteBasis } from '../lib/quote/basis';
import { estimateCabinetCost } from '../lib/quote/estimate';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();
const USER = 'cmtvinrpq0000hliggi5weh61';
const ALB = 'cmtikjvhf0000hla8aepnpl49';          // Egger W990 ST9 Alb Crystal, PAL 18
const STEJAR = 'decor-egger-h3170st12-placa';     // Egger H3170 ST12 Stejar Kendal Natur, PAL 18
const BLAT = 'decor-egger-h3331st10-blat-600-38'; // Egger H3331 ST10 Stejar Nebraska Natur, 600×38
const PFL = 'pfl-alb';
const BAND_C = 'abs-04';
const BAND_F = 'abs-1';
const MDF_VOPSIT = 'mdf-vopsit';                  // placă MDF vopsit mat 18 (panouri vizibile)
// fronturile albe: MDF vopsit Paint Mob, front plan, mat, 2 fețe, RAL 9010
const VOPSIT = { supplierId: 'supplier-paint-mob', modelId: 'model-paint-mob-plan-plan', finish: 'MAT', faces: 2, ralCode: 'RAL 9010', colorCategory: 'NORMALA' };
const SUPORT_POLITA = 'cms2zkr6p0001lc04x69zo1n7';
const CLEMA_SOCLU = 'cms2znvot0002lc046h02a5vh';

const LEG = 100, BASE_H = 900, BLAT_T = 38;
const H_BAZA = BASE_H - LEG - BLAT_T;  // 762 — corp sub blat
const D_BAZA = 600 - 25 - 20;          // 555 — derivat „sub blat" (blat 600)
const H_TOTAL = 2490, H_CUTIE_SUS = 400;
const H_COLOANA = H_TOTAL - H_CUTIE_SUS - LEG; // 1990 — coloane pe picioare, cutie 400 deasupra
const H_SUSP = 590, D_SUSP = 350;

type O = { doors?: number; drawers?: number; shelves?: number; back?: boolean; front?: 'PAL' | 'NONE'; mat?: string; subBlat?: boolean };
function mk(label: string, type: CabinetInput['type'], w: number, h: number, d: number, o: O): CabinetInput {
  const mat = o.mat ?? ALB;
  const hasFront = o.front !== 'NONE' && ((o.doors ?? 0) > 0 || (o.drawers ?? 0) > 0);
  return {
    label, type, widthMm: w, heightMm: h, depthMm: d,
    mount: { top: 'INCADRAT', bottom: 'INCADRAT' },
    shelves: o.shelves ?? 0, shelf: { materialId: mat },
    doors: o.doors ?? 0, carcassMaterialId: mat,
    ...(hasFront && mat === ALB
      ? { frontKind: 'MDF_VOPSIT', frontMaterialId: null, mdfFront: VOPSIT }
      : { frontKind: 'PAL', frontMaterialId: hasFront ? mat : null }),
    ...(o.drawers ? { drawers: { count: o.drawers, system: 'TANDEMBOX' }, hardwareSel: { tandemboxHeightMm: 115 } } : {}),
    back: o.back === false ? { enabled: false, mount: 'FALT' } : { enabled: true, materialId: PFL, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: BAND_C, frontPerimeterId: hasFront && mat !== ALB ? BAND_F : null },
    ...(type === 'SUSPENDAT' && hasFront ? { handle: { type: 'FARA' } } : {}),
    ...(o.subBlat ? { subBlat: true, pieces: { top: { variant: 'PAZII' } } } : {}),
  } as CabinetInput;
}
const B = (l: string, w: number, o: O) => mk(l, 'BAZA', w, H_BAZA, D_BAZA, { subBlat: true, ...o });
const U = (l: string, w: number, o: O) => mk(l, 'SUSPENDAT', w, H_SUSP, D_SUSP, { mat: STEJAR, doors: 1, ...o });
const T = (l: string, w: number, d: number) => mk(l, 'SUSPENDAT', w, H_CUTIE_SUS, d, { doors: w > 650 ? 2 : 1 });

type Row = { input: CabinetInput; hw?: object };
function cabinets(): Row[] {
  const legged = { slots: { 'cleme-soclu': { itemId: CLEMA_SOCLU } } };
  return [
    // stânga: coloană 600 cuptor + microunde
    { input: mk('C1 Coloană — 2 sertare jos', 'BAZA', 600, H_BAZA, D_BAZA, { drawers: 2 }), hw: legged },
    { input: mk('C1 Nișă cuptor + microunde', 'SUSPENDAT', 600, H_COLOANA - H_BAZA, D_BAZA, { shelves: 1, front: 'NONE' }) },
    { input: T('C1 Cutie sus', 600, D_BAZA) },
    // corpuri sub blat
    { input: B('B1 Cargo 200 (sticle)', 200, { drawers: 1 }), hw: legged },
    { input: B('B2 Plită — 2 sertare', 700, { drawers: 2 }), hw: legged },
    { input: B('B3 Chiuvetă', 620, { doors: 1, back: false }), hw: legged },
    { input: B('B4 Sertare', 700, { drawers: 2 }), hw: legged },
    { input: B('B5 Dulap', 670, { doors: 2, shelves: 1 }), hw: legged },
    // suspendate stejar (590) + cutii albe (400) deasupra
    { input: U('U1 Hotă', 700, { doors: 2, shelves: 0 }) },
    { input: U('U2', 620, { shelves: 1 }), hw: { slots: { 'suporti-polita': { itemId: SUPORT_POLITA } } } },
    { input: U('U3', 700, { doors: 2, shelves: 1 }), hw: { slots: { 'suporti-polita': { itemId: SUPORT_POLITA } } } },
    { input: U('U4', 670, { doors: 2, shelves: 1 }), hw: { slots: { 'suporti-polita': { itemId: SUPORT_POLITA } } } },
    { input: T('S1 Cutie sus', 700, D_SUSP) },
    { input: T('S2 Cutie sus', 620, D_SUSP) },
    { input: T('S3 Cutie sus', 700, D_SUSP) },
    { input: T('S4 Cutie sus', 670, D_SUSP) },
    // dreapta: coloană 600 cu 5 sertare interioare + coloană 400 cu polițe
    { input: mk('C2 Coloană — 5 sertare interioare', 'INALT', 600, H_COLOANA, D_BAZA, { doors: 1 }),
      hw: { slots: { 'cleme-soclu': { itemId: CLEMA_SOCLU } }, extra: [{ hardwareId: 'tandembox-k-500', qty: 5 }] } },
    { input: T('C2 Cutie sus', 600, D_BAZA) },
    { input: mk('C3 Coloană 400 — polițe', 'INALT', 400, H_COLOANA, D_BAZA, { doors: 1, shelves: 5 }),
      hw: { slots: { 'cleme-soclu': { itemId: CLEMA_SOCLU }, 'suporti-polita': { itemId: SUPORT_POLITA } } } },
    { input: T('C3 Cutie sus', 400, D_BAZA) },
  ];
}

async function main() {
  const NAME = 'Bucătărie 450×249 (schiță)';
  const CLIENT = 'Client nou — bucătărie 450';
  const wants = 'Bucătărie liniară 4,50 m × 2,49 m: coloană cuptor+microunde, 5 corpuri sub blat, suspendate stejar + cutii albe, 2 coloane dreapta';

  const old = await prisma.client.findFirst({ where: { name: CLIENT }, include: { projects: true } });
  if (old) {
    for (const p of old.projects) {
      await prisma.event.deleteMany({ where: { projectId: p.id } });
      await prisma.quote.deleteMany({ where: { projectId: p.id } });
      await prisma.project.delete({ where: { id: p.id } });
    }
    await prisma.event.deleteMany({ where: { clientId: old.id } });
    await prisma.client.delete({ where: { id: old.id } });
  }

  const client = await prisma.client.create({ data: { name: CLIENT, stage: 'CALIFICAT', source: 'Altul', wants, createdById: USER } });
  await prisma.event.create({ data: { type: 'CLIENT_CREATED', clientId: client.id, userId: USER, payloadJson: JSON.stringify({ source: 'Altul' }) } });
  const project = await prisma.project.create({ data: { name: NAME, clientId: client.id, status: 'OFERTARE', createdById: USER, description: wants } });
  await prisma.event.create({ data: { type: 'PROJECT_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ name: NAME }) } });

  const loose = [
    { name: 'Panou spate blat (stejar) 600', materialId: STEJAR, lengthMm: 2690, widthMm: 600, qty: 1, edgeBandId: BAND_F, edgeMode: 'L2' },
    { name: 'Front sertar interior', materialId: ALB, lengthMm: 560, widthMm: 150, qty: 5, edgeBandId: BAND_F, edgeMode: 'ALL' },
    { name: 'Fâșie compensare stânga 60 (MDF vopsit)', materialId: MDF_VOPSIT, lengthMm: 2490, widthMm: 60, qty: 1 },
    { name: 'Panou lateral capăt dreapta (MDF vopsit)', materialId: MDF_VOPSIT, lengthMm: 2490, widthMm: 580, qty: 1 },
  ];
  const free = [{ name: 'Accesoriu cargo 200 (sticle/ulei) — estimare', amount: 400, inCommission: false }];
  const observatii = [
    'Bucătărie liniară 450 × 249 cm. Fronturi și panouri vizibile albe din MDF vopsit mat RAL 9010 (2 fețe); corpuri PAL Egger W990 Alb Crystal; suspendate + panou spate blat PAL Egger H3170 Stejar Kendal Natur; blat Egger H3331 Stejar Nebraska Natur 38 mm.',
    'Stânga: coloană 60 cm cu nișă cuptor + microunde și 2 sertare jos. Sub blat: cargo 20, 2 sertare sub plită (70), chiuvetă (62), 2 sertare (70), dulap (67). Sus: suspendate 59 cm stejar (unul pentru hotă) + cutii 40 cm albe.',
    'Dreapta: coloană 60 cm cu 5 sertare interioare + coloană 40 cm cu polițe. Sertare Blum Tandembox, profil GOLA la corpurile de jos și coloane, suspendatele fără mâner (front prelungit). Electrocasnicele nu sunt incluse.',
  ].join('\n');
  const quote = await prisma.quote.create({
    data: {
      projectId: project.id, version: 1, name: NAME, clientName: CLIENT, status: 'CIORNA', observatii,
      laborPct: 120, yieldFactor: 0.8, handleType: 'GOLA',
      freeLinesJson: JSON.stringify(free), loosePanelsJson: JSON.stringify(loose),
      assemblies: { create: [{ name: 'Bucătărie', kind: 'BUCATARIE', legHeightMm: LEG, plinthMode: 'CABINETS', sortOrder: 0,
        baseHeightMm: BASE_H, blatMaterialId: BLAT, blatDepthMm: 600, upperHeightMm: H_SUSP }] },
    },
    include: { assemblies: true },
  });
  await prisma.event.create({ data: { type: 'QUOTE_CREATED', clientId: client.id, projectId: project.id, userId: USER, payloadJson: JSON.stringify({ quoteId: quote.id, version: 1 }) } });
  const asmId = quote.assemblies[0].id;

  const rows: Row[] = [
    ...cabinets(),
    { input: { label: 'Blat 289', type: 'BLAT', widthMm: 2890, heightMm: BLAT_T, depthMm: 600, shelves: 0, doors: 0, carcassMaterialId: '', frontMaterialId: null,
      back: { enabled: false, mount: 'FALT' }, edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null }, blat: { materialId: BLAT, cantMode: 'FRONT_SIDES' } } as CabinetInput },
  ];
  await prisma.$transaction(rows.map((r, idx) => prisma.cabinet.create({
    data: { quoteId: quote.id, assemblyId: asmId, sortOrder: idx, inputJson: JSON.stringify(r.input), hardwareJson: r.hw ? JSON.stringify(r.hw) : null,
      plinthEnabled: r.input.type === 'BAZA' || r.input.type === 'INALT' },
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
  console.log(`  plăci ${b.boards.toFixed(0)} | cant ${b.edging.toFixed(0)} | debitare ${b.cuttingService.toFixed(0)} | feronerie ${b.hardware.toFixed(0)} | manoperă ${b.labor.toFixed(0)}`);
  console.log('  breakdown:', JSON.stringify(b));
  console.log('  warnings:', JSON.stringify((r.quote as any).warnings ?? []).slice(0, 1500));
  console.log('  issues:', JSON.stringify((r.quote as any).cabinetIssues ?? (r.quote as any).issues ?? []).slice(0, 1500));
  console.log('  boards:', JSON.stringify((r.quote as any).boards?.map?.((x: any) => [x.materialId, x.sheets ?? x.count, x.wastePct]) ?? null));
  for (const c of data.cabinets) {
    const est = estimateCabinetCost({ input: c.input, hardwareAdjustments: c.hardwareAdjustments ?? null, extraParts: c.extraParts ?? [] }, snap,
      { laborPct: 120, yieldFactor: 0.8, legHeightMm: legMap.get(c.id) ?? null, quoteHandle: { type: 'GOLA' } });
    console.log(`     ${String(c.input.label).padEnd(36)} ${String(c.input.widthMm).padStart(5)}×${String(c.input.heightMm).padStart(4)} : ${est.sell.toFixed(0)}`);
  }
  console.log('  URL: /oferte/' + quote.id + '/oferta');
}
main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

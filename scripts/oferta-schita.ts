import { PrismaClient } from '@prisma/client';
import { loadProject, toQuoteInput, tryComputeQuote, legHeightByCabinet } from '../lib/quote/load';
import { getQuoteBasis } from '../lib/quote/basis';
import { estimateCabinetCost } from '../lib/quote/estimate';
import type { QuoteInput } from '../lib/quote/compute';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();
const CARCASS = 'cmtikjvhf0000hla8aepnpl49'; // W990 Alb Crystal (PAL alb)
const PAL_FRONT = CARCASS;
const BLAT = 'decor-egger-f021st75-blat-600-38';
const PFL = 'pfl-alb';
const BAND = 'abs-04';

const vopsitFront = () => ({ frontKind: 'MDF_VOPSIT' as const, frontMaterialId: null, mdfFront: { supplierId: 'supplier-paint-mob', modelId: 'model-paint-mob-plan-plan', finish: 'MAT' as const, faces: 2, ralCode: 'RAL 9010', colorCategory: 'NORMALA' as const } });

type Extra = { doors?: number; drawers?: number; shelves?: number; back?: boolean };
function mk(label: string, type: CabinetInput['type'], w: number, h: number, d: number, e: Extra): CabinetInput {
  const hasBack = e.back !== false && type !== 'BLAT';
  return {
    label, type, widthMm: w, heightMm: h, depthMm: d,
    mount: { top: 'INCADRAT', bottom: 'INCADRAT' },
    shelves: e.shelves ?? 0, shelf: { materialId: CARCASS },
    doors: e.doors ?? 0, carcassMaterialId: CARCASS, ...vopsitFront(),
    ...(e.drawers ? { drawers: { count: e.drawers, system: 'TANDEMBOX' }, hardwareSel: { tandemboxHeightMm: 115 } } : {}),
    back: hasBack ? { enabled: true, materialId: PFL, mount: 'FALT' } : { enabled: false, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: BAND, frontPerimeterId: BAND },
  } as CabinetInput;
}
function cabs(): CabinetInput[] {
  const B = (l: string, w: number, e: Extra) => mk(l, 'BAZA', w, 820, 560, e);
  const U = (l: string, w: number, e: Extra) => mk(l, 'SUSPENDAT', w, 700, 320, { shelves: 1, ...e });
  return [
    B('B1 Jolly cargo', 150, { drawers: 1 }), B('B2 Mască chiuvetă', 500, { doors: 2, back: false }),
    B('B3 MSV', 450, { doors: 1, back: false }), B('B4 Sertare', 500, { drawers: 3 }),
    B('B5 Cuptor', 600, { drawers: 1 }), B('B6 Corp final', 300, { doors: 1, shelves: 1 }),
    mk('Coloană frigider', 'INALT', 600, 2250, 560, { doors: 1, shelves: 2 }),
    U('U1', 150, { doors: 1 }), U('U2', 500, { doors: 1 }), U('U3', 450, { doors: 1 }),
    U('U4', 500, { doors: 1 }), U('U5', 600, { doors: 2 }), U('U6', 300, { doors: 1 }),
    { label: 'Blat 310', type: 'BLAT', widthMm: 3100, heightMm: 38, depthMm: 600, shelves: 0, doors: 0, carcassMaterialId: '', frontMaterialId: null, back: { enabled: false, mount: 'FALT' }, edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null }, blat: { materialId: BLAT } } as CabinetInput,
  ];
}
const palify = (i: CabinetInput): CabinetInput => {
  if (i.type === 'BLAT') return i;
  const c = { ...i, frontKind: 'PAL', frontMaterialId: PAL_FRONT } as CabinetInput; delete (c as any).mdfFront; return c;
};

async function createProject(name: string, clientName: string, inputs: CabinetInput[]) {
  await prisma.project.deleteMany({ where: { name } });
  const freeLines = [{ name: 'Cargo Jolly 150 (sticle/ulei)', amount: 400, inCommission: false }];
  const project = await prisma.project.create({
    data: {
      name, clientName, status: 'CIORNA',
      laborPct: 120, yieldFactor: 0.8, handleType: 'APLICAT', handleItemId: 'maner-standard',
      freeLinesJson: JSON.stringify(freeLines),
      assemblies: { create: [{ name: 'Bucătărie', kind: 'BUCATARIE', legHeightMm: 100, plinthMode: 'CABINETS', sortOrder: 0 }] },
    },
    include: { assemblies: true },
  });
  const asmId = project.assemblies[0].id;
  await prisma.$transaction(inputs.map((inp, idx) => prisma.cabinet.create({
    data: { projectId: project.id, assemblyId: inp.type === 'BLAT' ? null : asmId, sortOrder: idx, inputJson: JSON.stringify(inp), plinthEnabled: inp.type === 'BAZA' || inp.type === 'INALT' },
  })));
  return project.id;
}

async function priceOf(projectId: string) {
  const data = (await loadProject(projectId))!;
  const basis = await getQuoteBasis(data.project);
  const snap = (basis as any).snapshot;
  const legMap = legHeightByCabinet(data.assemblies, data.cabinets);
  const q = toQuoteInput(data.project, data.cabinets, legMap, data.assemblies);
  const _r = tryComputeQuote(q, snap); if(!_r.quote){ console.error("COMPUTE ERROR:", _r.error); } const quote = _r.quote!;
  const per = data.cabinets.map((c) => {
    const est = estimateCabinetCost({ input: c.input, hardwareAdjustments: c.hardwareAdjustments ?? null, extraParts: c.extraParts ?? [] }, snap, { laborPct: 120, yieldFactor: 0.8, legHeightMm: legMap.get(c.id) ?? null, projectHandle: { type: 'APLICAT', itemId: 'maner-standard' } });
    return { label: c.input.label as string, w: c.input.widthMm, sell: est.sell };
  });
  return { quote, per };
}

async function main() {
  const vopsitInputs = cabs();
  const palInputs = vopsitInputs.map(palify);
  const idVopsit = await createProject('Bucătărie schiță 310×225', 'Client schiță — MDF vopsit', vopsitInputs);
  const idPal = await createProject('Bucătărie schiță 310×225 — PAL', 'Client schiță — PAL', palInputs);

  for (const [name, id] of [['VOPSIT (2 fețe)', idVopsit], ['PAL', idPal]] as const) {
    const { quote: q, per } = await priceOf(id);
    const b = q.costs.breakdown;
    console.log(`\n===== ${name} =====  (proiect ${id})`);
    console.log(`TOTAL: ${q.costs.sellPrice.toFixed(0)} lei (cost ${q.costs.totalCost.toFixed(0)})`);
    console.log(`  plăci ${b.boards.toFixed(0)} | cant ${b.edging.toFixed(0)} | debitare ${b.cuttingService.toFixed(0)} | feronerie ${b.hardware.toFixed(0)} | manoperă ${b.labor.toFixed(0)}`);
    console.log('  URL: /proiecte/' + id + '/oferta');
    per.forEach((c) => console.log(`     ${c.label.padEnd(20)} ${String(c.w).padStart(4)} : ${c.sell.toFixed(0)}`));
  }
}
main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

import { prisma } from '@/lib/db';
import type { CabinetInput } from '@/lib/engine';
import type { Proposal, ProposalCabinet } from './schema';

export type FrontVariant = 'vopsit' | 'pal';

export interface BuildIds {
  carcass: string;   // PAL alb pentru carcasă + fronturi PAL
  blat: string;      // material blat 38
  band: string;      // cant ABS 0.4
  pfl: string;       // spate PFL
  vopsitSupplierId: string;
  vopsitModelId: string;
}

// Rezolvă materialele/feroneria implicite din catalog (nu hardcodăm id-uri fragile).
export async function resolveBuildIds(): Promise<BuildIds> {
  const carcass = await prisma.material.findFirst({ where: { kind: 'PAL', category: 'PLACA', active: true, thicknessMm: 18, name: { contains: 'Alb' } }, orderBy: { pricePerSheet: 'asc' } });
  const blat = await prisma.material.findFirst({ where: { category: 'BLAT', active: true, thicknessMm: 38 } });
  const band = await prisma.edgeBand.findFirst({ where: { active: true, thicknessMm: 0.4 } })
    ?? await prisma.edgeBand.findFirst({ where: { active: true } });
  const pfl = await prisma.material.findFirst({ where: { kind: 'PFL', active: true } });
  const sup = await prisma.frontSupplier.findFirst({ where: { productType: 'VOPSIT' }, include: { models: true } });
  const model = sup?.models.find((m) => m.tier === 'PLAN') ?? sup?.models[0];
  if (!carcass || !blat || !band || !pfl || !sup || !model) {
    throw new Error('Lipsesc materiale de bază în catalog (PAL alb / blat 38 / cant / PFL / furnizor vopsit).');
  }
  return { carcass: carcass.id, blat: blat.id, band: band.id, pfl: pfl.id, vopsitSupplierId: sup.id, vopsitModelId: model.id };
}

// materialele efective (default + alegerile utilizatorului din formular)
interface Eff {
  carcass: string; frontPal: string; blat: string; band: string; pfl: string;
  vopsitSupplierId: string; vopsitModelId: string; vopsitRal: string; vopsitFinish: 'MAT' | 'LUCIOS';
}

function frontSpec(front: FrontVariant, e: Eff) {
  if (front === 'vopsit') {
    return { frontKind: 'MDF_VOPSIT' as const, frontMaterialId: null, mdfFront: { supplierId: e.vopsitSupplierId, modelId: e.vopsitModelId, finish: e.vopsitFinish, faces: 2, ralCode: e.vopsitRal, colorCategory: 'NORMALA' as const } };
  }
  return { frontKind: 'PAL' as const, frontMaterialId: e.frontPal };
}

function oneCabinet(c: ProposalCabinet, front: FrontVariant, e: Eff): CabinetInput {
  if (c.section === 'BLAT' || c.role === 'blat') {
    return { label: c.label, type: 'BLAT', widthMm: c.widthMm, heightMm: 38, depthMm: c.depthMm || 600, shelves: 0, doors: 0, carcassMaterialId: '', frontMaterialId: null, back: { enabled: false, mount: 'FALT' }, edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null }, blat: { materialId: e.blat } } as CabinetInput;
  }
  let { doors, drawers } = c;
  let back = true;
  if (c.role === 'cargo') { drawers = Math.max(1, drawers || 1); doors = 0; }
  if (c.role === 'chiuveta') { back = false; doors = doors || 2; }
  if (c.role === 'masina_spalat') { back = false; doors = doors || 1; }
  if (c.role === 'cuptor') { drawers = drawers || 1; doors = 0; }
  const f = frontSpec(front, e);
  return {
    label: c.label, type: c.section, widthMm: c.widthMm, heightMm: c.heightMm, depthMm: c.depthMm,
    mount: { top: 'INCADRAT', bottom: 'INCADRAT' },
    shelves: c.shelves ?? 0, shelf: { materialId: e.carcass },
    doors, carcassMaterialId: e.carcass, ...f,
    ...(drawers ? { drawers: { count: drawers, system: 'TANDEMBOX' }, hardwareSel: { tandemboxHeightMm: 115 } } : {}),
    back: back ? { enabled: true, materialId: e.pfl, mount: 'FALT' } : { enabled: false, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: e.band, frontPerimeterId: e.band },
  } as CabinetInput;
}

export interface CreateOptions {
  clientName: string;
  front: FrontVariant;
  addSoclu: boolean;
  cargoLine: boolean;
  // materiale alese (opționale — cad pe default dacă lipsesc)
  carcassMaterialId?: string;
  frontPalMaterialId?: string;
  blatMaterialId?: string;
  vopsitRal?: string;
  vopsitFinish?: 'MAT' | 'LUCIOS';
}

function effFrom(opts: CreateOptions, ids: BuildIds): Eff {
  return {
    carcass: opts.carcassMaterialId || ids.carcass,
    frontPal: opts.frontPalMaterialId || opts.carcassMaterialId || ids.carcass,
    blat: opts.blatMaterialId || ids.blat,
    band: ids.band, pfl: ids.pfl,
    vopsitSupplierId: ids.vopsitSupplierId, vopsitModelId: ids.vopsitModelId,
    vopsitRal: opts.vopsitRal || 'RAL 9010', vopsitFinish: opts.vopsitFinish || 'MAT',
  };
}

export function buildCabinetInputs(proposal: Proposal, opts: CreateOptions, ids: BuildIds): CabinetInput[] {
  const e = effFrom(opts, ids);
  return proposal.cabinets.map((c) => oneCabinet(c, opts.front, e));
}

// Creează un proiect complet din propunere. Întoarce id-ul proiectului.
export async function createProjectFromProposal(proposal: Proposal, opts: CreateOptions, ids: BuildIds): Promise<string> {
  const inputs = buildCabinetInputs(proposal, opts, ids);
  const freeLines = opts.cargoLine && proposal.cabinets.some((c) => c.role === 'cargo')
    ? [{ name: 'Cargo Jolly (sticle/ulei)', amount: 400, inCommission: false }]
    : [];
  const name = `${proposal.assemblyName} — ${opts.front === 'vopsit' ? 'MDF vopsit' : 'PAL'}`;
  const project = await prisma.project.create({
    data: {
      name, clientName: opts.clientName || proposal.clientName || 'Client nou', status: 'CIORNA',
      laborPct: 120, yieldFactor: 0.8, handleType: 'APLICAT', handleItemId: 'maner-standard',
      freeLinesJson: JSON.stringify(freeLines),
      assemblies: { create: [{ name: proposal.assemblyName, kind: 'BUCATARIE', legHeightMm: 100, plinthMode: opts.addSoclu ? 'CABINETS' : 'NONE', sortOrder: 0 }] },
    },
    include: { assemblies: true },
  });
  const asmId = project.assemblies[0].id;
  await prisma.$transaction(inputs.map((inp, idx) => prisma.cabinet.create({
    data: {
      projectId: project.id, assemblyId: inp.type === 'BLAT' ? null : asmId, sortOrder: idx,
      inputJson: JSON.stringify(inp),
      plinthEnabled: opts.addSoclu && (inp.type === 'BAZA' || inp.type === 'INALT'),
    },
  })));
  return project.id;
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formDataToObject } from '@/lib/catalog/schemas';
import { formAction } from '@/lib/forms/form-action';
import {
  blatFormSchema,
  cabinetFormSchema,
  extraPartSchema,
  piecesConfigSchema,
  prunePiecesConfig,
  toBlatInput,
  toCabinetInput,
} from './cabinet-form';
import { hardwareAdjustmentsSchema, pruneAdjustments } from './hardware-adjustments';
import { buildSnapshot } from './snapshot';
import { isFrozenStatus } from './basis';
import { ASSEMBLY_LEG_HEIGHT_PRESETS, ASSEMBLY_NAME_PRESETS } from './assembly-presets';
import { parseProjectDetails } from './project-details';
import { PLINTH_MODES } from './plinth';
import type { CabinetInput, CabinetType } from '@/lib/engine';

const optStr = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

const projectSettingsSchema = z.object({
  laborPct: z.coerce.number().nonnegative(),
  yieldFactor: z.coerce.number().gt(0).lte(1),
  status: z.enum(['CIORNA', 'TRIMISA', 'ACCEPTATA']),
  handleType: z.enum(['APLICAT', 'BUTON', 'INGROPAT', 'PROFIL_J', 'GOLA', 'PUSH', 'FARA']),
  handleItemId: optStr,
});

const freeLineSchema = z.object({
  name: z.string().trim().min(1, 'Denumirea liniei lipsește'),
  amount: z.coerce.number().finite(),
});

const optFreeText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optFreeNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
);

// tip ansamblu + parametri de blat (bucătărie / comodă cu blat), partajați de add + update.
const ASSEMBLY_KINDS = ['FARA_BLAT', 'CU_BLAT', 'BUCATARIE'] as const;
const assemblyBlatFields = {
  kind: z.enum(ASSEMBLY_KINDS).default('FARA_BLAT'),
  baseHeightMm: optFreeNumber,
  blatMaterialId: optFreeText,
  blatDepthMm: optFreeNumber,
  upperHeightMm: optFreeNumber,
};
type AssemblyBlatInput = {
  kind: (typeof ASSEMBLY_KINDS)[number];
  baseHeightMm?: number; blatMaterialId?: string; blatDepthMm?: number; upperHeightMm?: number;
};
// la CU_BLAT/BUCATARIE cerem material + adâncime + înălțime bază; la FARA_BLAT nimic.
const requireBlatFields = (d: AssemblyBlatInput) =>
  d.kind === 'FARA_BLAT' || (d.baseHeightMm != null && !!d.blatMaterialId && d.blatDepthMm != null);
// golește câmpurile de blat când tipul nu le folosește (comutarea la FARA_BLAT le curăță).
function normalizeAssemblyBlat(d: AssemblyBlatInput) {
  const hasBlat = d.kind !== 'FARA_BLAT';
  return {
    kind: d.kind,
    baseHeightMm: hasBlat ? d.baseHeightMm ?? null : null,
    blatMaterialId: hasBlat ? d.blatMaterialId ?? null : null,
    blatDepthMm: hasBlat ? d.blatDepthMm ?? null : null,
    upperHeightMm: d.kind === 'BUCATARIE' ? d.upperHeightMm ?? null : null,
  };
}

const assemblySchema = z
  .object({
    name: z.string().trim().min(1, 'Numele ansamblului lipsește'),
    legHeightMm: z.coerce.number().positive(),
    plinthMode: z.enum(PLINTH_MODES).default('NONE'),
    ...assemblyBlatFields,
  })
  .refine(requireBlatFields, {
    message: 'Completează materialul, adâncimea și înălțimea bazei pentru blat',
    path: ['blatMaterialId'],
  });

const newAssemblySchema = z
  .object({
    namePreset: z.enum(ASSEMBLY_NAME_PRESETS),
    name: optFreeText,
    legHeightPreset: z.enum(ASSEMBLY_LEG_HEIGHT_PRESETS),
    legHeightMm: optFreeNumber,
    plinthMode: z.enum(PLINTH_MODES).default('NONE'),
    ...assemblyBlatFields,
  })
  .transform((d) => ({
    name: d.name && d.name.length > 0 ? d.name : d.namePreset,
    legHeightMm: d.legHeightMm ?? Number(d.legHeightPreset),
    plinthMode: d.plinthMode,
    kind: d.kind,
    baseHeightMm: d.baseHeightMm,
    blatMaterialId: d.blatMaterialId,
    blatDepthMm: d.blatDepthMm,
    upperHeightMm: d.upperHeightMm,
  }))
  .refine((d) => d.name !== 'Altul', {
    message: 'Alege un nume — preselecția „Altul" cere numele liber completat',
    path: ['name'],
  })
  .refine(requireBlatFields, {
    message: 'Completează materialul, adâncimea și înălțimea bazei pentru blat',
    path: ['blatMaterialId'],
  });

export const createProject = formAction(async (fd: FormData) => {
  const d = parseProjectDetails(formDataToObject(fd));
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('Setările lipsesc — rulează npm run db:seed');
  const project = await prisma.project.create({
    data: {
      name: d.name,
      clientName: d.clientName ?? null,
      clientContact: d.clientContact ?? null,
      laborPct: settings.laborPct,
      yieldFactor: settings.sheetYieldFactor,
    },
  });
  revalidatePath('/proiecte');
  redirect(`/proiecte/${project.id}`);
});

export const updateProjectDetails = formAction(async (id: string, fd: FormData) => {
  const d = parseProjectDetails(formDataToObject(fd));
  await prisma.project.update({
    where: { id },
    data: {
      name: d.name,
      clientName: d.clientName ?? null,
      clientContact: d.clientContact ?? null,
    },
  });
  revalidatePath('/proiecte');
  revalidatePath(`/proiecte/${id}`);
  revalidatePath(`/proiecte/${id}/oferta`);
});

export const updateProjectSettings = formAction(async (id: string, fd: FormData) => {
  const d = projectSettingsSchema.parse(formDataToObject(fd));
  const project = await prisma.project.findUniqueOrThrow({ where: { id } });
  // spread-ul cu handleItemId undefined NU șterge coloana — setăm explicit null
  const data: Omit<typeof d, 'handleItemId'> & { snapshotJson?: string; handleItemId: string | null } = {
    ...d,
    handleItemId: d.handleItemId ?? null,
  };
  if (isFrozenStatus(d.status) && (!isFrozenStatus(project.status) || !project.snapshotJson)) {
    data.snapshotJson = JSON.stringify(await buildSnapshot());
  }
  await prisma.project.update({ where: { id }, data });
  revalidatePath(`/proiecte/${id}`);
});

export const deleteProject = formAction(async (id: string) => {
  await prisma.project.delete({ where: { id } });
  revalidatePath('/proiecte');
  redirect('/proiecte');
});

export const duplicateProject = formAction(async (id: string) => {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: { assemblies: true, cabinets: true },
  });

  const copy = await prisma.$transaction(async (tx) => {
    const copy = await tx.project.create({
      data: {
        name: `${project.name} (copie)`,
        clientName: project.clientName,
        clientContact: project.clientContact,
        laborPct: project.laborPct,
        yieldFactor: project.yieldFactor,
        freeLinesJson: project.freeLinesJson,
        snapshotJson: project.snapshotJson,
        handleType: project.handleType,
        handleItemId: project.handleItemId,
      },
    });

    const assemblyIdMap = new Map<string, string>();
    for (const a of project.assemblies) {
      const newAssembly = await tx.assembly.create({
        data: {
          projectId: copy.id,
          name: a.name,
          legHeightMm: a.legHeightMm,
          plinthMode: a.plinthMode,
          sortOrder: a.sortOrder,
        },
      });
      assemblyIdMap.set(a.id, newAssembly.id);
    }

    for (const c of project.cabinets) {
      await tx.cabinet.create({
        data: {
          projectId: copy.id,
          assemblyId: c.assemblyId ? (assemblyIdMap.get(c.assemblyId) ?? null) : null,
          sortOrder: c.sortOrder,
          inputJson: c.inputJson,
          hardwareJson: c.hardwareJson,
          extraPartsJson: c.extraPartsJson,
          plinthEnabled: c.plinthEnabled,
        },
      });
    }

    return copy;
  });

  revalidatePath('/proiecte');
  redirect(`/proiecte/${copy.id}`);
});

export const addFreeLine = formAction(async (projectId: string, fd: FormData) => {
  const d = freeLineSchema.parse(formDataToObject(fd));
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const lines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];
  lines.push(d);
  await prisma.project.update({ where: { id: projectId }, data: { freeLinesJson: JSON.stringify(lines) } });
  revalidatePath(`/proiecte/${projectId}`);
});

export const removeFreeLine = formAction(async (projectId: string, index: number) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const lines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];
  lines.splice(index, 1);
  await prisma.project.update({ where: { id: projectId }, data: { freeLinesJson: JSON.stringify(lines) } });
  revalidatePath(`/proiecte/${projectId}`);
});

export const addAssembly = formAction(async (projectId: string, fd: FormData) => {
  const d = newAssemblySchema.parse(formDataToObject(fd));
  const count = await prisma.assembly.count({ where: { projectId } });
  await prisma.assembly.create({
    data: { projectId, name: d.name, legHeightMm: d.legHeightMm, plinthMode: d.plinthMode, sortOrder: count, ...normalizeAssemblyBlat(d) },
  });
  revalidatePath(`/proiecte/${projectId}`);
});

export const updateAssembly = formAction(async (assemblyId: string, fd: FormData) => {
  const d = assemblySchema.parse(formDataToObject(fd));
  const a = await prisma.assembly.update({
    where: { id: assemblyId },
    data: { name: d.name, legHeightMm: d.legHeightMm, plinthMode: d.plinthMode, ...normalizeAssemblyBlat(d) },
  });
  revalidatePath(`/proiecte/${a.projectId}`);
});

export const deleteAssembly = formAction(async (assemblyId: string) => {
  const count = await prisma.cabinet.count({ where: { assemblyId } });
  if (count > 0) throw new Error('Ansamblul are corpuri — mută-le sau șterge-le întâi.');
  const a = await prisma.assembly.delete({ where: { id: assemblyId } });
  revalidatePath(`/proiecte/${a.projectId}`);
});

const layoutSchema = z.object({
  room: z.object({ W: z.number().positive(), D: z.number().positive(), H: z.number().positive() }),
  items: z.array(z.object({
    id: z.string(),
    cx: z.number().finite(), cz: z.number().finite(), by: z.number().finite(),
    rotDeg: z.number().int(),
  })),
  fixed: z.array(z.object({
    id: z.string(), kind: z.enum(['GRINDA', 'STALP', 'PERETE', 'CUTIE', 'GEAM']),
    w: z.number().positive(), h: z.number().positive(), d: z.number().positive(),
    cx: z.number().finite(), cz: z.number().finite(), by: z.number().finite(), rot: z.number().finite(),
  })).default([]),
  walls: z.array(z.object({
    id: z.string(), axis: z.enum(['x', 'z']),
    at: z.number().finite(), lo: z.number().finite(), hi: z.number().finite(), h: z.number().positive(),
  })).default([]),
});

// salvează așezarea 3D a unui ansamblu (dimensiuni cameră + poziția fiecărui corp).
// Apelat din editorul client cu un payload JSON, nu dintr-un <form>.
export async function saveAssemblyLayout(
  assemblyId: string, payload: unknown,
): Promise<{ ok: true } | { error: string }> {
  try {
    const d = layoutSchema.parse(payload);
    const assembly = await prisma.assembly.findUnique({
      where: { id: assemblyId }, select: { projectId: true },
    });
    if (!assembly) throw new Error('Ansamblul nu există');
    // doar corpurile care aparțin ansamblului pot fi actualizate
    const valid = new Set(
      (await prisma.cabinet.findMany({ where: { assemblyId }, select: { id: true } })).map((c) => c.id),
    );
    const items = d.items.filter((it) => valid.has(it.id));
    await prisma.$transaction([
      prisma.assembly.update({
        where: { id: assemblyId },
        data: {
          roomWidthMm: d.room.W, roomDepthMm: d.room.D, roomHeightMm: d.room.H,
          fixedElementsJson: JSON.stringify(d.fixed),
          roomWallsJson: d.walls.length ? JSON.stringify(d.walls) : null,
        },
      }),
      ...items.map((it) => prisma.cabinet.update({
        where: { id: it.id },
        data: { posXMm: it.cx, posZMm: it.cz, posYMm: it.by, rotDeg: it.rotDeg },
      })),
    ]);
    revalidatePath(`/proiecte/${assembly.projectId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return { error: 'Date invalide' };
    return { error: e instanceof Error ? e.message : 'Eroare la salvare' };
  }
}

export const addCabinet = formAction(async (projectId: string, assemblyId: string, type: CabinetType = 'BAZA') => {
  const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } });
  if (!assembly || assembly.projectId !== projectId) {
    throw new Error('Ansamblul nu aparține acestui proiect');
  }
  const count = await prisma.cabinet.count({ where: { projectId } });

  let input: CabinetInput;
  if (type === 'BLAT') {
    // blatul se creează gol: doar tipul; lungime/adâncime/material se aleg în editor
    input = {
      label: `Blat ${count + 1}`, type: 'BLAT',
      widthMm: 0, heightMm: 0, depthMm: 0,
      shelves: 0, doors: 0,
      carcassMaterialId: '', frontMaterialId: null,
      back: { enabled: false, mount: 'FALT' },
      edgeBands: { carcassFrontEdgeId: '', frontPerimeterId: null },
      blat: { materialId: '' },
    };
  } else {
    // corpul se creează GOL (fără dimensiuni/materiale inventate) și e exclus din
    // calculul ofertei până e completat; precompletăm doar alegerile structurale
    // și default-urile care au sens: spate PFL + cant ABS 0,4mm
    const [pfl, band04] = await Promise.all([
      prisma.material.findFirst({ where: { active: true, kind: 'PFL' }, orderBy: { name: 'asc' } }),
      prisma.edgeBand.findFirst({ where: { active: true, thicknessMm: 0.4 }, orderBy: { name: 'asc' } }),
    ]);
    input = {
      label: `C${count + 1}`,
      type,
      widthMm: 0, heightMm: 0, depthMm: 0,
      shelves: 1, doors: 1,
      carcassMaterialId: '',
      frontMaterialId: null,
      back: { enabled: true, materialId: pfl?.id, mount: 'FALT' },
      edgeBands: { carcassFrontEdgeId: band04?.id ?? '', frontPerimeterId: band04?.id ?? null },
    };
  }
  const cab = await prisma.cabinet.create({
    data: { projectId, assemblyId, sortOrder: count, inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${projectId}`);
  redirect(`/proiecte/${projectId}/corp/${cab.id}`);
});

export const updateCabinetData = formAction(async (cabinetId: string, data: Record<string, string>) => {
  const d = cabinetFormSchema.parse(data);
  // configurator 3D: configurația de piese (slot capac/override-uri/piese libere) vine în același submit
  const pieces = data.piecesJson !== undefined && data.piecesJson !== ''
    ? prunePiecesConfig(piecesConfigSchema.parse(JSON.parse(data.piecesJson)))
    : undefined;
  const input = toCabinetInput(d, pieces);
  // feronerie v4: abaterile per rând (tabelul de feronerie) vin în același submit
  const adjustments = data.hardwareAdjustmentsJson !== undefined
    ? pruneAdjustments(hardwareAdjustmentsSchema.parse(JSON.parse(data.hardwareAdjustmentsJson || '{}')))
    : undefined;
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: {
      inputJson: JSON.stringify(input),
      ...(adjustments !== undefined ? { hardwareJson: adjustments ? JSON.stringify(adjustments) : null } : {}),
    },
  });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const updateCabinetPlinth = formAction(async (cabinetId: string, fd: FormData) => {
  const d = z.object({ plinthEnabled: z.enum(['false', 'true']) }).parse(formDataToObject(fd));
  const cabinet = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { plinthEnabled: d.plinthEnabled === 'true' },
  });
  revalidatePath(`/proiecte/${cabinet.projectId}`);
  revalidatePath(`/proiecte/${cabinet.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cabinet.projectId}/plan-debitare`);
});

export const updateBlat = formAction(async (cabinetId: string, fd: FormData) => {
  const d = blatFormSchema.parse(formDataToObject(fd));
  // grosimea informativă vine din material (dacă lipsește, rămâne 0)
  const material = await prisma.material.findUnique({ where: { id: d.blatMaterialId } });
  const input = toBlatInput(d, material?.thicknessMm ?? 0);
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
  // la salvarea blatului ne întoarcem în pagina proiectului
  redirect(`/proiecte/${cab.projectId}`);
});

export const deleteCabinet = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.delete({ where: { id: cabinetId } });
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const duplicateCabinet = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const count = await prisma.cabinet.count({ where: { projectId: cab.projectId } });
  const input = JSON.parse(cab.inputJson) as { label: string };
  input.label = `${input.label} (copie)`;
  await prisma.cabinet.create({
    data: {
      projectId: cab.projectId,
      assemblyId: cab.assemblyId,
      sortOrder: count,
      inputJson: JSON.stringify(input),
      hardwareJson: cab.hardwareJson,
      extraPartsJson: cab.extraPartsJson,
      plinthEnabled: cab.plinthEnabled,
    },
  });
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const addExtraPart = formAction(async (cabinetId: string, fd: FormData) => {
  const d = extraPartSchema.parse(formDataToObject(fd));
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const parts = JSON.parse(cab.extraPartsJson) as unknown[];
  parts.push(d);
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { extraPartsJson: JSON.stringify(parts) } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
});

export const removeExtraPart = formAction(async (cabinetId: string, index: number) => {
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const parts = JSON.parse(cab.extraPartsJson) as unknown[];
  parts.splice(index, 1);
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { extraPartsJson: JSON.stringify(parts) } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
});

export const refreshFrozenPrices = formAction(async (projectId: string) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  if (!isFrozenStatus(project.status)) throw new Error('Proiectul e ciornă — prețurile sunt deja live.');
  await prisma.project.update({
    where: { id: projectId },
    data: { snapshotJson: JSON.stringify(await buildSnapshot()) },
  });
  revalidatePath(`/proiecte/${projectId}`);
});

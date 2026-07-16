'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formDataToObject } from '@/lib/catalog/schemas';
import { formAction } from '@/lib/forms/form-action';
import { cabinetFormSchema, extraPartSchema, toCabinetInput } from './cabinet-form';
import { buildSnapshot } from './snapshot';
import { isFrozenStatus } from './basis';
import { ASSEMBLY_LEG_HEIGHT_PRESETS, ASSEMBLY_NAME_PRESETS } from './assembly-presets';
import type { CabinetInput } from '@/lib/engine';

const optStr = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  clientName: optStr,
  clientContact: optStr,
});

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

const assemblySchema = z.object({
  name: z.string().trim().min(1, 'Numele ansamblului lipsește'),
  legHeightMm: z.coerce.number().positive(),
});

const optFreeText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optFreeNumber = z.preprocess(
  (v) => (v === '' || v == null ? undefined : v),
  z.coerce.number().positive().optional(),
);

const newAssemblySchema = z
  .object({
    namePreset: z.enum(ASSEMBLY_NAME_PRESETS),
    name: optFreeText,
    legHeightPreset: z.enum(ASSEMBLY_LEG_HEIGHT_PRESETS),
    legHeightMm: optFreeNumber,
  })
  .transform((d) => ({
    name: d.name && d.name.length > 0 ? d.name : d.namePreset,
    legHeightMm: d.legHeightMm ?? Number(d.legHeightPreset),
  }))
  .refine((d) => d.name !== 'Altul', {
    message: 'Alege un nume — preselecția „Altul" cere numele liber completat',
    path: ['name'],
  });

export const createProject = formAction(async (fd: FormData) => {
  const d = projectFormSchema.parse(formDataToObject(fd));
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
  await prisma.assembly.create({ data: { projectId, name: d.name, legHeightMm: d.legHeightMm, sortOrder: count } });
  revalidatePath(`/proiecte/${projectId}`);
});

export const updateAssembly = formAction(async (assemblyId: string, fd: FormData) => {
  const d = assemblySchema.parse(formDataToObject(fd));
  const a = await prisma.assembly.update({ where: { id: assemblyId }, data: { name: d.name, legHeightMm: d.legHeightMm } });
  revalidatePath(`/proiecte/${a.projectId}`);
});

export const deleteAssembly = formAction(async (assemblyId: string) => {
  const count = await prisma.cabinet.count({ where: { assemblyId } });
  if (count > 0) throw new Error('Ansamblul are corpuri — mută-le sau șterge-le întâi.');
  const a = await prisma.assembly.delete({ where: { id: assemblyId } });
  revalidatePath(`/proiecte/${a.projectId}`);
});

export const addCabinet = formAction(async (projectId: string, assemblyId: string) => {
  const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } });
  if (!assembly || assembly.projectId !== projectId) {
    throw new Error('Ansamblul nu aparține acestui proiect');
  }
  // corpul se creează GOL (fără dimensiuni/materiale inventate) și e exclus din
  // calculul ofertei până e completat; precompletăm doar alegerile structurale
  // și default-urile care au sens: spate PFL + cant ABS 0,4mm
  const [pfl, band04] = await Promise.all([
    prisma.material.findFirst({ where: { active: true, kind: 'PFL' }, orderBy: { name: 'asc' } }),
    prisma.edgeBand.findFirst({ where: { active: true, thicknessMm: 0.4 }, orderBy: { name: 'asc' } }),
  ]);
  const count = await prisma.cabinet.count({ where: { projectId } });
  const input: CabinetInput = {
    label: `C${count + 1}`,
    type: 'BAZA',
    widthMm: 0, heightMm: 0, depthMm: 0,
    shelves: 1, doors: 1,
    carcassMaterialId: '',
    frontMaterialId: null,
    back: { enabled: true, materialId: pfl?.id, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: band04?.id ?? '', frontPerimeterId: band04?.id ?? null },
  };
  const cab = await prisma.cabinet.create({
    data: { projectId, assemblyId, sortOrder: count, inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${projectId}`);
  redirect(`/proiecte/${projectId}/corp/${cab.id}`);
});

export const updateCabinetData = formAction(async (cabinetId: string, data: Record<string, string>) => {
  const d = cabinetFormSchema.parse(data);
  const input = toCabinetInput(d);
  const cab = await prisma.cabinet.update({ where: { id: cabinetId }, data: { inputJson: JSON.stringify(input) } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
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
    },
  });
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const saveCabinetHardware = formAction(async (cabinetId: string, fd: FormData) => {
  const ids = fd.getAll('hardwareId').map(String);
  const qtys = fd.getAll('qty').map((v) => Number(v));
  const lines = ids
    .map((hardwareId, i) => ({ hardwareId, qty: qtys[i] }))
    .filter((l) => l.hardwareId !== '' && Number.isFinite(l.qty) && l.qty > 0);
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { hardwareJson: JSON.stringify(lines) },
  });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const resetCabinetHardware = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.update({ where: { id: cabinetId }, data: { hardwareJson: null } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
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

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formDataToObject } from '@/lib/catalog/schemas';
import { formAction } from '@/lib/forms/form-action';
import { cabinetFormSchema, extraPartSchema, toCabinetInput } from './cabinet-form';
import { buildSnapshot } from './snapshot';
import type { CabinetInput } from '@/lib/engine';

const optStr = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  clientName: optStr,
  clientContact: optStr,
});

const projectSettingsSchema = z.object({
  markupPct: z.coerce.number().nonnegative(),
  yieldFactor: z.coerce.number().gt(0).lte(1),
  status: z.enum(['CIORNA', 'TRIMISA', 'ACCEPTATA']),
});

const freeLineSchema = z.object({
  name: z.string().trim().min(1, 'Denumirea liniei lipsește'),
  amount: z.coerce.number().finite(),
});

const assemblySchema = z.object({
  name: z.string().trim().min(1, 'Numele ansamblului lipsește'),
  legHeightMm: z.coerce.number().positive(),
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
      markupPct: settings.markupPct,
      yieldFactor: settings.sheetYieldFactor,
    },
  });
  revalidatePath('/proiecte');
  redirect(`/proiecte/${project.id}`);
});

export const updateProjectSettings = formAction(async (id: string, fd: FormData) => {
  const d = projectSettingsSchema.parse(formDataToObject(fd));
  await prisma.project.update({ where: { id }, data: d });
  revalidatePath(`/proiecte/${id}`);
});

export const deleteProject = formAction(async (id: string) => {
  await prisma.project.delete({ where: { id } });
  revalidatePath('/proiecte');
  redirect('/proiecte');
});

export const duplicateProject = formAction(async (id: string) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { cabinets: true } });
  const copy = await prisma.project.create({
    data: {
      name: `${project.name} (copie)`,
      clientName: project.clientName,
      clientContact: project.clientContact,
      markupPct: project.markupPct,
      yieldFactor: project.yieldFactor,
      freeLinesJson: project.freeLinesJson,
      snapshotJson: project.snapshotJson,
      cabinets: {
        create: project.cabinets.map((c) => ({
          sortOrder: c.sortOrder,
          inputJson: c.inputJson,
          hardwareJson: c.hardwareJson,
          extraPartsJson: c.extraPartsJson,
        })),
      },
    },
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
  const d = assemblySchema.parse(formDataToObject(fd));
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
  const pal = await prisma.material.findFirst({ where: { active: true, kind: 'PAL' }, orderBy: { name: 'asc' } });
  const pfl = await prisma.material.findFirst({ where: { active: true, kind: 'PFL' }, orderBy: { name: 'asc' } });
  const band = await prisma.edgeBand.findFirst({ where: { active: true }, orderBy: { thicknessMm: 'asc' } });
  if (!pal || !band) throw new Error('Adaugă întâi un material PAL și un cant în cataloage');
  const count = await prisma.cabinet.count({ where: { projectId } });
  const input: CabinetInput = {
    label: `C${count + 1}`,
    type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: pal.id,
    frontMaterialId: pal.id,
    back: pfl ? { enabled: true, materialId: pfl.id, mount: 'FALT' } : { enabled: false, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: band.id, frontPerimeterId: band.id },
  };
  const cab = await prisma.cabinet.create({
    data: { projectId, assemblyId, sortOrder: count, inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${projectId}`);
  redirect(`/proiecte/${projectId}/corp/${cab.id}`);
});

export const updateCabinet = formAction(async (cabinetId: string, fd: FormData) => {
  const d = cabinetFormSchema.parse(formDataToObject(fd));
  const input = toCabinetInput(d);
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { inputJson: JSON.stringify(input) },
  });
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

export const recalculateProject = formAction(async (projectId: string) => {
  const snapshot = await buildSnapshot();
  await prisma.project.update({
    where: { id: projectId },
    data: { snapshotJson: JSON.stringify(snapshot) },
  });
  revalidatePath(`/proiecte/${projectId}`);
});

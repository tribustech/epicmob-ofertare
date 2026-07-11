'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import {
  cuttingRateSchema, edgeBandSchema, formDataToObject, hardwareSchema,
  laborRateSchema, materialSchema, settingsSchema,
} from './schemas';

function materialData(fd: FormData) {
  const d = materialSchema.parse(formDataToObject(fd));
  return {
    name: d.name, kind: d.kind, thicknessMm: d.thicknessMm,
    sheetLengthMm: d.sheetLengthMm, sheetWidthMm: d.sheetWidthMm,
    pricingMode: d.pricingMode,
    pricePerSheet: d.pricingMode === 'PER_SHEET' ? (d.pricePerSheet ?? null) : null,
    pricePerSqm: d.pricingMode === 'PER_SQM' ? (d.pricePerSqm ?? null) : null,
  };
}

export async function createMaterial(fd: FormData) {
  await prisma.material.create({ data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
}
export async function updateMaterial(id: string, fd: FormData) {
  await prisma.material.update({ where: { id }, data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
}
export async function deactivateMaterial(id: string) {
  await prisma.material.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/materiale');
}

export async function createEdgeBand(fd: FormData) {
  await prisma.edgeBand.create({ data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
}
export async function updateEdgeBand(id: string, fd: FormData) {
  await prisma.edgeBand.update({ where: { id }, data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
}
export async function deactivateEdgeBand(id: string) {
  await prisma.edgeBand.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/canturi');
}

function hardwareData(fd: FormData) {
  const d = hardwareSchema.parse(formDataToObject(fd));
  return {
    name: d.name, category: d.category, pricePerUnit: d.pricePerUnit,
    nominalLengthMm: d.nominalLengthMm ?? null, loadClassKg: d.loadClassKg ?? null,
  };
}

export async function createHardware(fd: FormData) {
  await prisma.hardwareItem.create({ data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
}
export async function updateHardware(id: string, fd: FormData) {
  await prisma.hardwareItem.update({ where: { id }, data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
}
export async function deactivateHardware(id: string) {
  await prisma.hardwareItem.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/feronerie');
}

export async function createCuttingRate(fd: FormData) {
  await prisma.cuttingRate.create({ data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
}
export async function updateCuttingRate(id: string, fd: FormData) {
  await prisma.cuttingRate.update({ where: { id }, data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
}
export async function deleteCuttingRate(id: string) {
  await prisma.cuttingRate.delete({ where: { id } });
  revalidatePath('/cataloage/debitare');
}

export async function updateLaborRate(cabinetType: string, fd: FormData) {
  const d = laborRateSchema.parse(formDataToObject(fd));
  await prisma.laborRate.update({ where: { cabinetType }, data: { price: d.price } });
  revalidatePath('/cataloage/manopera');
}

export async function updateSettings(fd: FormData) {
  const d = settingsSchema.parse(formDataToObject(fd));
  await prisma.appSettings.update({
    where: { id: 1 },
    data: {
      markupPct: d.markupPct, sheetYieldFactor: d.sheetYieldFactor,
      defaultHingeId: d.defaultHingeId ?? null, defaultHandleId: d.defaultHandleId ?? null,
      defaultLegId: d.defaultLegId ?? null, defaultRailId: d.defaultRailId ?? null,
    },
  });
  revalidatePath('/setari');
}

export async function updateConstruction(fd: FormData) {
  const obj = formDataToObject(fd);
  const construction: Record<string, number | number[]> = {};
  for (const key of Object.keys(DEFAULT_CONSTRUCTION)) {
    if (key === 'slideNominalsMm') {
      const raw = obj[key];
      if (raw !== undefined) {
        construction[key] = raw.split(',').map((s) => {
          const n = Number(s.trim());
          if (!Number.isFinite(n) || n <= 0) throw new Error(`Valoare invalidă în lista de nominale: ${s}`);
          return n;
        });
      }
      continue;
    }
    const raw = obj[key];
    if (raw !== undefined && raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Valoare invalidă pentru ${key}: ${raw}`);
      construction[key] = n;
    }
  }
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { constructionJson: JSON.stringify({ ...DEFAULT_CONSTRUCTION, ...construction }) },
  });
  revalidatePath('/setari');
}

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import { formAction } from '@/lib/forms/form-action';
import {
  cuttingRateSchema, edgeBandSchema, formDataToObject, hardwareSchema,
  materialSchema, settingsSchema,
} from './schemas';

function materialData(fd: FormData) {
  const d = materialSchema.parse(formDataToObject(fd));
  return {
    name: d.name, kind: d.kind, thicknessMm: d.thicknessMm,
    sheetLengthMm: d.sheetLengthMm, sheetWidthMm: d.sheetWidthMm,
    pricingMode: d.pricingMode,
    pricePerSheet: d.pricingMode === 'PER_SHEET' ? (d.pricePerSheet ?? null) : null,
    pricePerSqm: d.pricingMode === 'PER_SQM' ? (d.pricePerSqm ?? null) : null,
    hasGrain: d.hasGrain,
  };
}

export const createMaterial = formAction(async (fd: FormData) => {
  await prisma.material.create({ data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
});
export const updateMaterial = formAction(async (id: string, fd: FormData) => {
  await prisma.material.update({ where: { id }, data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
});
export const deactivateMaterial = formAction(async (id: string) => {
  await prisma.material.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/materiale');
});

export const createEdgeBand = formAction(async (fd: FormData) => {
  await prisma.edgeBand.create({ data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
});
export const updateEdgeBand = formAction(async (id: string, fd: FormData) => {
  await prisma.edgeBand.update({ where: { id }, data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
});
export const deactivateEdgeBand = formAction(async (id: string) => {
  await prisma.edgeBand.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/canturi');
});

function hardwareData(fd: FormData) {
  const d = hardwareSchema.parse(formDataToObject(fd));
  return {
    name: d.name, category: d.category, pricePerUnit: d.pricePerUnit,
    nominalLengthMm: d.nominalLengthMm ?? null, loadClassKg: d.loadClassKg ?? null,
    boxHeightMm: d.boxHeightMm ?? null,
  };
}

export const createHardware = formAction(async (fd: FormData) => {
  await prisma.hardwareItem.create({ data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
  revalidatePath('/setari');
});

/** Operatorul marchează din editorul de corp dacă decorul materialului are direcție (fibră) —
 *  se salvează în catalog, deci data viitoare e deja știut. */
export async function setMaterialHasGrain(
  materialId: string,
  hasGrain: boolean,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await prisma.material.update({ where: { id: materialId }, data: { hasGrain } });
    revalidatePath('/cataloage/materiale');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Nu s-a putut salva direcția decorului' };
  }
}

/** Creare rapidă din editorul de corp (combobox-ul de feronerie): doar denumire + preț. */
export async function quickCreateHardware(
  category: string,
  name: string,
  pricePerUnit: number,
): Promise<{ id?: string; error?: string }> {
  try {
    const d = hardwareSchema.parse({ name, category, pricePerUnit });
    const row = await prisma.hardwareItem.create({
      data: { name: d.name, category: d.category, pricePerUnit: d.pricePerUnit, active: true },
    });
    revalidatePath('/cataloage/feronerie');
    return { id: row.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Nu s-a putut crea produsul' };
  }
}
export const updateHardware = formAction(async (id: string, fd: FormData) => {
  await prisma.hardwareItem.update({ where: { id }, data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
  revalidatePath('/setari');
});
export const deactivateHardware = formAction(async (id: string) => {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (
    settings &&
    (id === settings.defaultHingeId ||
      id === settings.defaultHandleId ||
      id === settings.defaultLegId ||
      id === settings.defaultRailId ||
      id === settings.defaultShelfSupportId ||
      id === settings.defaultPlinthClipId ||
      id === settings.defaultAventosId)
  ) {
    throw new Error('Feroneria este setată ca implicită în Setări — schimbă întâi setarea, apoi dezactiveaz-o.');
  }
  await prisma.hardwareItem.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/feronerie');
  revalidatePath('/setari');
});

export const createCuttingRate = formAction(async (fd: FormData) => {
  await prisma.cuttingRate.create({ data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
});
export const updateCuttingRate = formAction(async (id: string, fd: FormData) => {
  await prisma.cuttingRate.update({ where: { id }, data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
});
export const deleteCuttingRate = formAction(async (id: string) => {
  await prisma.cuttingRate.delete({ where: { id } });
  revalidatePath('/cataloage/debitare');
});

export const updateSettings = formAction(async (fd: FormData) => {
  const d = settingsSchema.parse(formDataToObject(fd));
  await prisma.appSettings.update({
    where: { id: 1 },
    data: {
      laborPct: d.laborPct, sheetYieldFactor: d.sheetYieldFactor,
      cutKerfMm: d.cutKerfMm, cutTrimMm: d.cutTrimMm,
      eurToRon: d.eurToRon,
      profilJPerFront: d.profilJPerFront, golaPricePerMl: d.golaPricePerMl,
      blatCutPricePerPiece: d.blatCutPricePerPiece,
      defaultHingeId: d.defaultHingeId ?? null, defaultHandleId: d.defaultHandleId ?? null,
      defaultLegId: d.defaultLegId ?? null, defaultRailId: d.defaultRailId ?? null,
      defaultShelfSupportId: d.defaultShelfSupportId ?? null,
      defaultPlinthClipId: d.defaultPlinthClipId ?? null,
      defaultAventosId: d.defaultAventosId ?? null,
    },
  });
  revalidatePath('/setari');
});

export const updateConstruction = formAction(async (fd: FormData) => {
  const obj = formDataToObject(fd);
  const construction: Record<string, number | number[]> = {};
  for (const key of Object.keys(DEFAULT_CONSTRUCTION)) {
    if (key === 'slideNominalsMm') {
      const raw = obj[key];
      if (raw !== undefined) {
        if (raw === '') throw new Error('Lista de lungimi nominale nu poate fi goală');
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
      if (!Number.isFinite(n) || n < 0) throw new Error(`Valoare invalidă pentru ${key}: ${raw}`);
      construction[key] = n;
    }
  }
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { constructionJson: JSON.stringify({ ...DEFAULT_CONSTRUCTION, ...construction }) },
  });
  revalidatePath('/setari');
});

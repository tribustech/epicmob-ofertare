'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { COST_SCOPES, QUOTE_BUCKETS } from './constants';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const bool = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const updateCompanySettings = formAction(async (fd: FormData) => {
  await requireUser();
  const d = z.object({
    vatPayer: bool,
    vatDefaultPct: z.coerce.number().min(0).max(100),
    overEstimatePct: z.coerce.number().min(0).max(100),
    companyName: optText, companyCui: optText, companyAddress: optText,
  }).parse(formDataToObject(fd));
  await prisma.appSettings.update({
    where: { id: 1 },
    data: {
      vatPayer: d.vatPayer, vatDefaultPct: d.vatDefaultPct, overEstimatePct: d.overEstimatePct,
      companyName: d.companyName ?? null, companyCui: d.companyCui ?? null, companyAddress: d.companyAddress ?? null,
    },
  });
  revalidatePath('/setari');
});

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Numele lipsește'),
  scope: z.enum(COST_SCOPES),
  quoteBucket: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.enum(QUOTE_BUCKETS).optional()),
});

export const createCostCategory = formAction(async (fd: FormData) => {
  await requireUser();
  const d = categorySchema.parse(formDataToObject(fd));
  if (await prisma.costCategory.findUnique({ where: { name_scope: { name: d.name, scope: d.scope } } })) {
    throw new Error(`Există deja categoria „${d.name}" la ${d.scope === 'DIRECT' ? 'directe' : 'indirecte'}.`);
  }
  const max = await prisma.costCategory.aggregate({ _max: { sortOrder: true } });
  await prisma.costCategory.create({ data: { name: d.name, scope: d.scope, quoteBucket: d.quoteBucket ?? null, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidatePath('/setari');
});

export const updateCostCategory = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = categorySchema.parse(formDataToObject(fd));
  await prisma.costCategory.update({ where: { id }, data: { name: d.name, scope: d.scope, quoteBucket: d.quoteBucket ?? null } });
  revalidatePath('/setari');
});

export const setCostCategoryActive = formAction(async (id: string, active: boolean) => {
  await requireUser();
  await prisma.costCategory.update({ where: { id }, data: { active } });
  revalidatePath('/setari');
});

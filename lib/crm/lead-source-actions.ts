'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';

function revalidate() {
  revalidatePath('/setari');
  revalidatePath('/leaduri');
}

export const createLeadSource = formAction(async (fd: FormData) => {
  await requireUser();
  const { name } = z.object({ name: z.string().trim().min(1, 'Numele lipsește') }).parse(formDataToObject(fd));
  if (await prisma.leadSource.findUnique({ where: { name } })) throw new Error(`Sursa „${name}" există deja.`);
  const max = await prisma.leadSource.aggregate({ _max: { sortOrder: true } });
  await prisma.leadSource.create({ data: { name, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidate();
});

/** Redenumirea actualizează și clienții care au sursa veche (sursa e text pe client). */
export const renameLeadSource = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const { name } = z.object({ name: z.string().trim().min(1, 'Numele lipsește') }).parse(formDataToObject(fd));
  const src = await prisma.leadSource.findUniqueOrThrow({ where: { id } });
  if (src.name === name) return;
  if (await prisma.leadSource.findUnique({ where: { name } })) throw new Error(`Sursa „${name}" există deja.`);
  await prisma.$transaction([
    prisma.leadSource.update({ where: { id }, data: { name } }),
    prisma.client.updateMany({ where: { source: src.name }, data: { source: name } }),
  ]);
  revalidate();
  revalidatePath('/clienti');
});

export const setLeadSourceActive = formAction(async (id: string, active: boolean) => {
  await requireUser();
  await prisma.leadSource.update({ where: { id }, data: { active } });
  revalidate();
});

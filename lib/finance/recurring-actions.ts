'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { parseDateInput } from '@/lib/crm/dates';
import { FREQUENCIES } from './constants';
import { money, round2 } from './money';
import { generateExpectedDocuments } from './recurring-generate';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optDate = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());
const bool = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const D = (n: number) => new Prisma.Decimal(round2(n).toFixed(2));

const schema = z.object({
  name: z.string().trim().min(1, 'Numele lipsește'),
  counterparty: optText,
  amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')),
  categoryId: z.string().min(1, 'Alege categoria'),
  frequency: z.enum(FREQUENCIES),
  dayOfMonth: z.coerce.number().int().min(1).max(31),
  startsAt: optDate,
  endsAt: optDate,
  active: bool.optional(),
});

function revalidate() {
  revalidatePath('/finante/recurente');
  revalidatePath('/finante/cheltuieli');
  revalidatePath('/');
}

export const createRecurring = formAction(async (fd: FormData) => {
  await requireUser();
  const d = schema.parse(formDataToObject(fd));
  await prisma.recurringExpense.create({
    data: {
      name: d.name, counterparty: d.counterparty ?? null, amount: D(d.amount), categoryId: d.categoryId, frequency: d.frequency, dayOfMonth: d.dayOfMonth,
      startsAt: parseDateInput(d.startsAt) ?? new Date(), endsAt: parseDateInput(d.endsAt),
    },
  });
  await generateExpectedDocuments();
  revalidate();
});

export const updateRecurring = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = schema.parse(formDataToObject(fd));
  await prisma.recurringExpense.update({
    where: { id },
    data: {
      name: d.name, counterparty: d.counterparty ?? null, amount: D(d.amount), categoryId: d.categoryId, frequency: d.frequency, dayOfMonth: d.dayOfMonth,
      startsAt: parseDateInput(d.startsAt) ?? undefined, endsAt: parseDateInput(d.endsAt), active: d.active ?? true,
    },
  });
  // documentele așteptate neconfirmate ale șablonului iau suma și numele noi
  await prisma.document.updateMany({ where: { recurringId: id, expected: true }, data: { amount: D(d.amount), counterparty: d.counterparty ?? d.name, note: d.name, categoryId: d.categoryId } });
  await generateExpectedDocuments();
  revalidate();
});

/** Dezactivarea șterge documentele așteptate neplătite (cele confirmate rămân). */
export const setRecurringActive = formAction(async (id: string, active: boolean) => {
  await requireUser();
  await prisma.recurringExpense.update({ where: { id }, data: { active } });
  if (!active) await prisma.document.deleteMany({ where: { recurringId: id, expected: true, movements: { none: {} } } });
  revalidate();
});

/** „Nu a fost luna asta": șterge un document așteptat neplătit (ex. chiria a fost amânată). */
export const dismissExpected = formAction(async (documentId: string) => {
  await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, include: { movements: true } });
  if (!doc.expected || doc.movements.length > 0) throw new Error('Documentul nu mai e „așteptat".');
  await prisma.document.delete({ where: { id: documentId } });
  revalidate();
});

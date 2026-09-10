'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { parseDateInput } from '@/lib/crm/dates';
import { logEvent } from '@/lib/crm/events';
import { money, round2 } from './money';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optDate = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());
const D = (n: number) => new Prisma.Decimal(round2(n).toFixed(2));

async function revalidateProjectMoney(projectId: string, accountId?: string) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  revalidatePath(`/proiecte/${projectId}`);
  revalidatePath('/proiecte');
  revalidatePath('/finante');
  revalidatePath('/');
  if (p?.clientId) revalidatePath(`/clienti/${p.clientId}`);
  if (accountId) revalidatePath(`/finante/conturi/${accountId}`);
}

/** „Adaugă încasare" pe proiect: Movement IN cu projectId + tip (avans/rată/final). */
export const addReceipt = formAction(async (projectId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({
    accountId: z.string().min(1, 'Alege contul în care au intrat banii'),
    amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')),
    date: optDate,
    // text liber (Avans / Rată / Final sunt doar sugestii)
    incomeType: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().max(60, 'Tipul e prea lung').optional()),
    note: optText,
  }).parse(formDataToObject(fd));
  const m = await prisma.movement.create({
    data: { accountId: d.accountId, type: 'IN', amount: D(d.amount), date: parseDateInput(d.date) ?? new Date(), projectId, incomeType: d.incomeType ?? null, note: d.note ?? null, createdById: me.id },
  });
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  await logEvent({ type: 'RECEIPT', projectId, clientId: p?.clientId, userId: me.id, payload: { movementId: m.id, amount: d.amount, incomeType: d.incomeType ?? null } });
  await revalidateProjectMoney(projectId, d.accountId);
});

export const deleteReceipt = formAction(async (movementId: string) => {
  await requireUser();
  const m = await prisma.movement.findUniqueOrThrow({ where: { id: movementId } });
  if (m.type !== 'IN' || !m.projectId) throw new Error('Mișcarea nu e o încasare pe proiect.');
  await prisma.movement.delete({ where: { id: movementId } });
  await revalidateProjectMoney(m.projectId, m.accountId);
});

/** Modificare de contract după acceptare („a mai vrut 2 corpuri: +1.800"). Suma poate fi negativă. */
export const addContractChange = formAction(async (projectId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ amount: money.pipe(z.number().refine((n) => n !== 0, 'Suma nu poate fi 0')), description: z.string().trim().min(1, 'Descrie modificarea'), date: optDate })
    .parse(formDataToObject(fd));
  const c = await prisma.contractChange.create({ data: { projectId, amount: D(d.amount), description: d.description, date: parseDateInput(d.date) ?? new Date(), createdById: me.id } });
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  await logEvent({ type: 'CONTRACT_CHANGE', projectId, clientId: p?.clientId, userId: me.id, payload: { changeId: c.id, amount: d.amount, description: d.description } });
  await revalidateProjectMoney(projectId);
});

export const deleteContractChange = formAction(async (id: string) => {
  await requireUser();
  const c = await prisma.contractChange.delete({ where: { id } });
  await revalidateProjectMoney(c.projectId);
});

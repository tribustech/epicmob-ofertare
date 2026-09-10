'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { parseDateInput } from '@/lib/crm/dates';
import { money, round2 } from './money';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optDate = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());
const D = (n: number) => new Prisma.Decimal(round2(n).toFixed(2));

function revalidateLoans(accountIds: string[]) {
  revalidatePath('/finante/imprumuturi');
  revalidatePath('/finante');
  revalidatePath('/');
  for (const id of accountIds) revalidatePath(`/finante/conturi/${id}`);
}

/** „Împrumut primit": Loan + Movement IN în contul în care au intrat banii. */
export const createLoan = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = z.object({
    lenderName: z.string().trim().min(1, 'De la cine?'),
    principal: money.pipe(z.number().positive('Suma trebuie să fie > 0')),
    accountId: z.string().min(1, 'Alege contul în care au intrat banii'),
    receivedAt: optDate, dueAt: optDate, note: optText,
  }).parse(formDataToObject(fd));
  const receivedAt = parseDateInput(d.receivedAt) ?? new Date();
  await prisma.loan.create({
    data: {
      lenderName: d.lenderName, principal: D(d.principal), receivedAt, dueAt: parseDateInput(d.dueAt), note: d.note ?? null, createdById: me.id,
      movements: { create: { accountId: d.accountId, type: 'IN', amount: D(d.principal), date: receivedAt, note: `Împrumut de la ${d.lenderName}`, createdById: me.id } },
    },
  });
  revalidateLoans([d.accountId]);
});

/** „Returnare": Movement OUT legat de împrumut; nu poate depăși restul. */
export const repayLoan = formAction(async (loanId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ accountId: z.string().min(1, 'Alege contul'), amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')), date: optDate })
    .parse(formDataToObject(fd));
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, include: { movements: true } });
  const returned = loan.movements.filter((m) => m.type === 'OUT').reduce((s, m) => s + m.amount.toNumber(), 0);
  const remaining = round2(loan.principal.toNumber() - returned);
  if (d.amount > remaining + 0.005) throw new Error(`Mai sunt de returnat doar ${remaining.toFixed(2)} lei.`);
  await prisma.movement.create({
    data: { accountId: d.accountId, type: 'OUT', amount: D(d.amount), date: parseDateInput(d.date) ?? new Date(), loanId, note: `Returnare către ${loan.lenderName}`, createdById: me.id },
  });
  revalidateLoans([d.accountId]);
});

export const updateLoan = formAction(async (loanId: string, fd: FormData) => {
  await requireUser();
  const d = z.object({ lenderName: z.string().trim().min(1, 'De la cine?'), dueAt: optDate, note: optText }).parse(formDataToObject(fd));
  await prisma.loan.update({ where: { id: loanId }, data: { lenderName: d.lenderName, dueAt: parseDateInput(d.dueAt), note: d.note ?? null } });
  revalidateLoans([]);
});

/** Șterge împrumutul cu toate mișcările lui (primire + returnări). */
export const deleteLoan = formAction(async (loanId: string) => {
  await requireUser();
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id: loanId }, include: { movements: true } });
  await prisma.$transaction([prisma.movement.deleteMany({ where: { loanId } }), prisma.loan.delete({ where: { id: loanId } })]);
  revalidateLoans(loan.movements.map((m) => m.accountId));
});

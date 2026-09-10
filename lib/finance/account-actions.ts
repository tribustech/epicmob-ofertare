'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { parseDateInput } from '@/lib/crm/dates';
import { ACCOUNT_KINDS } from './constants';
import { adjustmentAmount, balanceOf, round2 } from './balance';
import { money } from './money';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const bool = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());
const dateField = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

function revalidateFinante(accountIds: string[] = []) {
  revalidatePath('/finante');
  revalidatePath('/finante/ajustari');
  revalidatePath('/');
  for (const id of accountIds) revalidatePath(`/finante/conturi/${id}`);
}

function dateOrToday(v: string | undefined): Date {
  return parseDateInput(v) ?? new Date();
}

export const createAccount = formAction(async (fd: FormData) => {
  await requireUser();
  const d = z.object({ name: z.string().trim().min(1, 'Numele lipsește'), kind: z.enum(ACCOUNT_KINDS), personal: bool }).parse(formDataToObject(fd));
  const max = await prisma.account.aggregate({ _max: { sortOrder: true } });
  await prisma.account.create({ data: { name: d.name, kind: d.kind, personal: d.personal, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  revalidateFinante();
});

export const updateAccount = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = z.object({ name: z.string().trim().min(1, 'Numele lipsește'), kind: z.enum(ACCOUNT_KINDS), personal: bool, active: bool }).parse(formDataToObject(fd));
  await prisma.account.update({ where: { id }, data: { name: d.name, kind: d.kind, personal: d.personal, active: d.active } });
  revalidateFinante([id]);
});

/** Transfer între conturi: două mișcări legate prin transferPairId, în aceeași tranzacție. */
export const transfer = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ fromAccountId: z.string().min(1, 'Alege contul sursă'), toAccountId: z.string().min(1, 'Alege contul destinație'), amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')), date: dateField, note: optText })
    .parse(formDataToObject(fd));
  if (d.fromAccountId === d.toAccountId) throw new Error('Alege două conturi diferite.');
  const date = dateOrToday(d.date);
  const pair = randomUUID();
  const amount = new Prisma.Decimal(round2(d.amount).toFixed(2));
  await prisma.$transaction([
    prisma.movement.create({ data: { accountId: d.fromAccountId, type: 'TRANSFER_OUT', amount, date, note: d.note ?? null, transferPairId: pair, createdById: me.id } }),
    prisma.movement.create({ data: { accountId: d.toAccountId, type: 'TRANSFER_IN', amount, date, note: d.note ?? null, transferPairId: pair, createdById: me.id } }),
  ]);
  revalidateFinante([d.fromAccountId, d.toAccountId]);
});

/** Ajustare: introduci soldul numărat; aplicația calculează diferența și o înregistrează cu motiv. */
export const adjust = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ accountId: z.string().min(1, 'Alege contul'), countedBalance: money, date: dateField, reason: z.string().trim().min(3, 'Motivul e obligatoriu') })
    .parse(formDataToObject(fd));
  const rows = await prisma.movement.findMany({ where: { accountId: d.accountId }, select: { type: true, amount: true } });
  const computed = balanceOf(rows.map((r) => ({ type: r.type, amount: r.amount.toNumber() })));
  const diff = adjustmentAmount(d.countedBalance, computed);
  if (diff === 0) throw new Error('Soldul numărat e egal cu cel calculat — nimic de ajustat.');
  await prisma.movement.create({
    data: { accountId: d.accountId, type: 'ADJUSTMENT', amount: new Prisma.Decimal(diff.toFixed(2)), date: dateOrToday(d.date), adjustmentReason: d.reason, createdById: me.id },
  });
  revalidateFinante([d.accountId]);
});

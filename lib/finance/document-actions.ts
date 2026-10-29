'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { requireUser } from '@/lib/auth/current-user';
import { parseDateInput } from '@/lib/crm/dates';
import { money, optMoney } from './money';
import { remainingToPay, validateAllocations } from './documents';
import { assertDirectCategories, D, headerSchema, insertExpense, optDate, optText, parseAllocations, vatFields } from './expense-write';

function revalidateExpenses(projectIds: string[] = [], accountIds: string[] = []) {
  revalidatePath('/finante/cheltuieli');
  revalidatePath('/finante');
  revalidatePath('/');
  for (const id of projectIds) revalidatePath(`/proiecte/${id}`);
  for (const id of accountIds) revalidatePath(`/finante/conturi/${id}`);
}

/**
 * „Adaugă cheltuială": documentul + alocările pe proiecte + (opțional) plata, într-o tranzacție.
 * Rămâne pe pagina cheltuielilor cu documentul deschis; `redirectTo` poate fi pagina proiectului.
 */
export const createExpense = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const { doc, projectIds, accountIds } = await insertExpense(fd, me.id);
  revalidateExpenses(projectIds, accountIds);
  const redirectTo = typeof fd.get('redirectTo') === 'string' ? (fd.get('redirectTo') as string) : '';
  redirect(redirectTo && redirectTo.startsWith('/') ? redirectTo : `/finante/cheltuieli?doc=${doc.id}`);
});

export const updateExpense = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = headerSchema.parse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
  const [doc, settings] = await Promise.all([
    prisma.document.findUniqueOrThrow({ where: { id }, include: { allocations: true, movements: true } }),
    prisma.appSettings.findUniqueOrThrow({ where: { id: 1 }, select: { vatPayer: true } }),
  ]);
  const allocated = doc.allocations.reduce((s, a) => s + a.amount.toNumber(), 0);
  const paid = doc.movements.reduce((s, m) => s + m.amount.toNumber(), 0);
  if (d.amount + 0.005 < allocated) throw new Error(`Suma nu poate fi sub totalul alocat (${allocated.toFixed(2)} lei). Ajustează întâi alocările.`);
  if (d.amount + 0.005 < paid) throw new Error(`Suma nu poate fi sub totalul plătit (${paid.toFixed(2)} lei).`);
  await prisma.document.update({
    where: { id },
    data: {
      kind: d.kind, counterparty: d.counterparty, number: d.number ?? null, issuedAt: parseDateInput(d.issuedAt) ?? doc.issuedAt,
      dueAt: parseDateInput(d.dueAt), amount: D(d.amount), ...vatFields(d, settings.vatPayer), categoryId: d.categoryId ?? null, note: d.note ?? null,
    },
  });
  revalidateExpenses(doc.allocations.map((a) => a.projectId));
});

/** Înlocuiește lista de alocări a unui document. */
export const setAllocations = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({ where: { id }, include: { allocations: true } });
  const allocs = parseAllocations(fd);
  const err = validateAllocations(doc.amount.toNumber(), allocs);
  if (err) throw new Error(err);
  if (allocs.some((a) => Number.isNaN(a.amount))) throw new Error('O sumă alocată nu e un număr.');
  await assertDirectCategories(allocs);
  await prisma.$transaction([
    prisma.documentAllocation.deleteMany({ where: { documentId: id } }),
    ...allocs.map((a) => prisma.documentAllocation.create({ data: { documentId: id, projectId: a.projectId, amount: D(a.amount), categoryId: a.categoryId } })),
  ]);
  revalidateExpenses([...doc.allocations.map((a) => a.projectId), ...allocs.map((a) => a.projectId)]);
});

export const addPayment = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ accountId: z.string().min(1, 'Alege contul'), date: optDate, amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')) })
    .parse({ accountId: fd.get('accountId'), date: fd.get('date'), amount: fd.get('amount') });
  const doc = await prisma.document.findUniqueOrThrow({ where: { id }, include: { movements: true, allocations: { select: { projectId: true } } } });
  const paid = doc.movements.reduce((s, m) => s + m.amount.toNumber(), 0);
  const remaining = remainingToPay(doc.amount.toNumber(), paid);
  if (d.amount > remaining + 0.005) throw new Error(`Mai sunt de plătit doar ${remaining.toFixed(2)} lei.`);
  await prisma.movement.create({
    data: { accountId: d.accountId, type: doc.direction === 'INCOME' ? 'IN' : 'OUT', amount: D(d.amount), date: parseDateInput(d.date) ?? new Date(), documentId: id, createdById: me.id },
  });
  if (doc.expected) await prisma.document.update({ where: { id }, data: { expected: false } });
  revalidateExpenses(doc.allocations.map((a) => a.projectId), [d.accountId]);
});

export const deletePayment = formAction(async (movementId: string) => {
  await requireUser();
  const m = await prisma.movement.delete({ where: { id: movementId }, include: { document: { select: { allocations: { select: { projectId: true } } } } } });
  revalidateExpenses(m.document?.allocations.map((a) => a.projectId) ?? [], [m.accountId]);
});

/** Șterge documentul cu alocările și plățile lui (banii se întorc în conturi). */
export const deleteExpense = formAction(async (id: string) => {
  await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({ where: { id }, include: { movements: true, allocations: true, replacedBy: true } });
  if (doc.replacedBy) throw new Error('Proforma a fost înlocuită de o factură — șterge întâi factura.');
  await prisma.$transaction([
    prisma.movement.deleteMany({ where: { documentId: id } }),
    prisma.document.delete({ where: { id } }),
  ]);
  revalidateExpenses(doc.allocations.map((a) => a.projectId), doc.movements.map((m) => m.accountId));
  redirect('/finante/cheltuieli');
});

/**
 * „Înlocuiește cu factură": factura finală preia alocările și plățile proformei; proforma rămâne
 * în istoric ca înlocuită (nu mai apare în liste / neplătite).
 */
export const replaceProforma = formAction(async (proformaId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ number: optText, issuedAt: optDate, amount: optMoney, dueAt: optDate }).parse({ number: fd.get('number'), issuedAt: fd.get('issuedAt'), amount: fd.get('amount'), dueAt: fd.get('dueAt') });
  const pro = await prisma.document.findUniqueOrThrow({ where: { id: proformaId }, include: { allocations: true, movements: true, replacedBy: true } });
  if (pro.kind !== 'PROFORMA') throw new Error('Doar o proformă poate fi înlocuită cu factură.');
  if (pro.replacedBy) throw new Error('Proforma e deja înlocuită.');
  const amount = d.amount ?? pro.amount.toNumber();
  const allocated = pro.allocations.reduce((s, a) => s + a.amount.toNumber(), 0);
  if (amount + 0.005 < allocated) throw new Error(`Suma facturii nu poate fi sub totalul alocat (${allocated.toFixed(2)} lei).`);

  const inv = await prisma.$transaction(async (tx) => {
    const inv = await tx.document.create({
      data: {
        direction: pro.direction, kind: 'FACTURA', counterparty: pro.counterparty, counterpartyClientId: pro.counterpartyClientId,
        number: d.number ?? null, issuedAt: parseDateInput(d.issuedAt) ?? new Date(), dueAt: parseDateInput(d.dueAt),
        amount: D(amount), vatPct: pro.vatPct, vatIncluded: pro.vatIncluded, categoryId: pro.categoryId, note: pro.note,
        replacesDocumentId: pro.id, createdById: me.id,
      },
    });
    await tx.documentAllocation.updateMany({ where: { documentId: pro.id }, data: { documentId: inv.id } });
    await tx.movement.updateMany({ where: { documentId: pro.id }, data: { documentId: inv.id } });
    return inv;
  });
  revalidateExpenses(pro.allocations.map((a) => a.projectId), pro.movements.map((m) => m.accountId));
  redirect(`/finante/cheltuieli?doc=${inv.id}`);
});

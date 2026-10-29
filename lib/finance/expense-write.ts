/**
 * Scrierea unei cheltuieli (document + alocări + plată), comună formularului „Adaugă cheltuială" și
 * validării bonurilor venite prin bot. Fără 'use server': funcțiile primesc userul deja verificat.
 */
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { parseDateInput } from '@/lib/crm/dates';
import { logEvent } from '@/lib/crm/events';
import { DOCUMENT_KINDS } from './constants';
import { money, optMoney, parseMoneyInput, round2 } from './money';
import { validateAllocations } from './documents';

export const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
export const optDate = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());
export const D = (n: number) => new Prisma.Decimal(round2(n).toFixed(2));

export const headerSchema = z.object({
  kind: z.enum(DOCUMENT_KINDS),
  counterparty: z.string().trim().min(1, 'Furnizorul lipsește'),
  number: optText,
  issuedAt: optDate,
  dueAt: optDate,
  amount: money.pipe(z.number().positive('Suma trebuie să fie > 0')),
  categoryId: optText,
  note: optText,
  vatMode: z.enum(['INCLUS', 'ADAUGAT', 'FARA']).optional(),
  vatPct: optMoney,
});

/** Rândurile de alocare vin ca alloc.N.projectId / alloc.N.amount / alloc.N.categoryId. */
export function parseAllocations(fd: FormData): { projectId: string; amount: number; categoryId: string }[] {
  const rows = new Map<string, { projectId?: string; amount?: number; categoryId?: string }>();
  for (const [k, v] of fd.entries()) {
    const m = /^alloc\.(\d+)\.(projectId|amount|categoryId)$/.exec(k);
    if (!m || typeof v !== 'string') continue;
    const row = rows.get(m[1]) ?? {};
    if (m[2] === 'amount') row.amount = v.trim() ? parseMoneyInput(v) : 0;
    else if (m[2] === 'projectId') row.projectId = v;
    else row.categoryId = v;
    rows.set(m[1], row);
  }
  return [...rows.values()]
    .filter((r) => r.projectId || (r.amount ?? 0) > 0)
    .map((r) => ({ projectId: r.projectId ?? '', amount: Number.isFinite(r.amount) ? (r.amount as number) : NaN, categoryId: r.categoryId ?? '' }));
}

export function vatFields(d: z.infer<typeof headerSchema>, vatPayer: boolean): { vatPct: number | null; vatIncluded: boolean } {
  if (!vatPayer || !d.vatMode || d.vatMode === 'FARA') return { vatPct: null, vatIncluded: true };
  return { vatPct: d.vatPct ?? 21, vatIncluded: d.vatMode === 'INCLUS' };
}

export async function assertDirectCategories(allocs: { categoryId: string }[]) {
  const ids = [...new Set(allocs.map((a) => a.categoryId))];
  if (ids.some((id) => !id)) throw new Error('Alege categoria pe fiecare rând de alocare.');
  const cats = await prisma.costCategory.findMany({ where: { id: { in: ids } }, select: { id: true, scope: true, name: true } });
  const bad = cats.find((c) => c.scope !== 'DIRECT');
  if (bad) throw new Error(`Categoria „${bad.name}" e indirectă — pe proiect se alocă doar categorii directe.`);
}

/**
 * Documentul + alocările pe proiecte + (opțional) plata, într-o tranzacție. `withinTx` rulează în
 * aceeași tranzacție (ex. validarea unui bon din bot leagă pozele și marchează trimiterea aprobată).
 */
export async function insertExpense(
  fd: FormData,
  userId: string,
  withinTx?: (tx: Prisma.TransactionClient, documentId: string) => Promise<void>,
) {
  const d = headerSchema.parse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
  const allocs = parseAllocations(fd);
  const err = validateAllocations(d.amount, allocs);
  if (err) throw new Error(err);
  if (allocs.some((a) => Number.isNaN(a.amount))) throw new Error('O sumă alocată nu e un număr.');
  await assertDirectCategories(allocs);

  const pay = z.object({ payMode: z.enum(['PAID', 'UNPAID']).default('UNPAID'), accountId: optText, payDate: optDate, payAmount: optMoney })
    .parse({ payMode: fd.get('payMode') ?? undefined, accountId: fd.get('accountId'), payDate: fd.get('payDate'), payAmount: fd.get('payAmount') });
  if (pay.payMode === 'PAID' && !pay.accountId) throw new Error('Alege contul din care ai plătit.');
  const payAmount = pay.payMode === 'PAID' ? round2(pay.payAmount ?? d.amount) : 0;
  if (pay.payMode === 'PAID' && (payAmount <= 0 || payAmount > d.amount + 0.005)) throw new Error('Suma plătită trebuie să fie între 0 și suma documentului.');

  const settings = await prisma.appSettings.findUniqueOrThrow({ where: { id: 1 }, select: { vatPayer: true } });
  const issuedAt = parseDateInput(d.issuedAt) ?? new Date();

  const doc = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        direction: 'EXPENSE', kind: d.kind, counterparty: d.counterparty, number: d.number ?? null,
        issuedAt, dueAt: parseDateInput(d.dueAt), amount: D(d.amount), ...vatFields(d, settings.vatPayer),
        categoryId: d.categoryId ?? null, note: d.note ?? null, createdById: userId,
        allocations: { create: allocs.map((a) => ({ projectId: a.projectId, amount: D(a.amount), categoryId: a.categoryId })) },
      },
    });
    if (pay.payMode === 'PAID') {
      await tx.movement.create({
        data: { accountId: pay.accountId!, type: 'OUT', amount: D(payAmount), date: parseDateInput(pay.payDate) ?? new Date(), documentId: doc.id, createdById: userId },
      });
    }
    if (withinTx) await withinTx(tx, doc.id);
    return doc;
  });
  for (const a of allocs) {
    await logEvent({ type: 'DOCUMENT_ADDED', projectId: a.projectId, userId, payload: { documentId: doc.id, counterparty: d.counterparty, amount: a.amount } });
  }
  return { doc, projectIds: allocs.map((a) => a.projectId), accountIds: pay.payMode === 'PAID' && pay.accountId ? [pay.accountId] : [] };
}


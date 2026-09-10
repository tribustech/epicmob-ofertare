import { prisma } from '@/lib/db';
import { parseMonthKey } from './month';
import { paymentStatus, remainingToPay, unallocated } from './documents';
import { loadAccountOptions } from './account-queries';
import type { PaymentStatus } from './constants';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

export interface ExpenseFilters {
  luna?: string | null;       // 'YYYY-MM' | 'toate'
  status?: PaymentStatus | '';
  categoryId?: string;
  projectId?: string;
  nealocate?: boolean;
}

/** Lista documentelor de cheltuială, cu plătit/status/alocări derivate. Proformele înlocuite sunt ascunse. */
export async function loadExpenses(f: ExpenseFilters) {
  const month = f.luna && f.luna !== 'toate' ? parseMonthKey(f.luna) : null;
  const rows = await prisma.document.findMany({
    where: {
      direction: 'EXPENSE',
      replacedBy: null,
      ...(month ? { issuedAt: { gte: month.start, lt: month.end } } : {}),
      ...(f.categoryId ? { OR: [{ categoryId: f.categoryId }, { allocations: { some: { categoryId: f.categoryId } } }] } : {}),
      ...(f.projectId ? { allocations: { some: { projectId: f.projectId } } } : {}),
      ...(f.nealocate ? { allocations: { none: {} } } : {}),
    },
    orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      category: { select: { name: true } },
      allocations: { include: { project: { select: { id: true, name: true } } } },
      movements: { select: { amount: true } },
      _count: { select: { attachments: true } },
    },
  });
  const mapped = rows.map((d) => {
    const amount = dec(d.amount);
    const paid = d.movements.reduce((s, m) => s + dec(m.amount), 0);
    const allocs = d.allocations.map((a) => ({ projectId: a.project.id, projectName: a.project.name, amount: dec(a.amount) }));
    return {
      id: d.id, kind: d.kind, counterparty: d.counterparty, number: d.number, issuedAt: d.issuedAt, dueAt: d.dueAt,
      amount, paid, remaining: remainingToPay(amount, paid), status: paymentStatus(amount, paid),
      category: d.category?.name ?? null, expected: d.expected,
      allocations: allocs, unallocated: unallocated(amount, allocs), attachments: d._count.attachments,
    };
  });
  return f.status ? mapped.filter((d) => d.status === f.status) : mapped;
}

/** Un document complet, pentru panoul lateral. */
export async function loadDocument(id: string) {
  const d = await prisma.document.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      allocations: { include: { project: { select: { id: true, name: true } }, category: { select: { id: true, name: true } } } },
      movements: { include: { account: { select: { id: true, name: true } }, createdBy: { select: { name: true } } }, orderBy: { date: 'desc' } },
      attachments: true,
      replacesDocument: { select: { id: true, kind: true, number: true, counterparty: true } },
      replacedBy: { select: { id: true, kind: true, number: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!d) return null;
  const amount = dec(d.amount);
  const payments = d.movements.map((m) => ({ id: m.id, date: m.date, amount: dec(m.amount), account: m.account, user: m.createdBy?.name ?? null }));
  const paid = payments.reduce((s, m) => s + m.amount, 0);
  const allocations = d.allocations.map((a) => ({ id: a.id, projectId: a.project.id, projectName: a.project.name, categoryId: a.category.id, categoryName: a.category.name, amount: dec(a.amount), note: a.note }));
  return {
    id: d.id, direction: d.direction, kind: d.kind, counterparty: d.counterparty, number: d.number, issuedAt: d.issuedAt, dueAt: d.dueAt,
    amount, vatPct: d.vatPct, vatIncluded: d.vatIncluded, note: d.note, expected: d.expected,
    categoryId: d.category?.id ?? null, categoryName: d.category?.name ?? null,
    paid, remaining: remainingToPay(amount, paid), status: paymentStatus(amount, paid),
    allocations, unallocated: unallocated(amount, allocations), payments, attachments: d.attachments,
    replacesDocument: d.replacesDocument, replacedBy: d.replacedBy, createdBy: d.createdBy?.name ?? null, createdAt: d.createdAt,
  };
}

/** Opțiunile formularului de cheltuială: categorii active (directe/indirecte), proiecte active, conturi, TVA. */
export async function loadExpenseFormOptions() {
  const [categories, projects, accounts, settings] = await Promise.all([
    prisma.costCategory.findMany({ where: { active: true }, orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }] }),
    prisma.project.findMany({
      where: { status: { notIn: ['INCHIS', 'PIERDUT'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, client: { select: { name: true } } },
    }),
    loadAccountOptions(),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { vatPayer: true, vatDefaultPct: true } }),
  ]);
  return {
    categories: categories.map((c) => ({ value: c.id, label: c.name, scope: c.scope as 'DIRECT' | 'INDIRECT' })),
    projects: projects.map((p) => ({ value: p.id, label: p.client ? `${p.name} · ${p.client.name}` : p.name })),
    accounts: accounts.map((a) => ({ value: a.value, label: a.label, balance: a.balance })),
    vatPayer: settings?.vatPayer ?? false,
    vatDefaultPct: settings?.vatDefaultPct ?? 21,
  };
}

export type ExpenseFormOptions = Awaited<ReturnType<typeof loadExpenseFormOptions>>;

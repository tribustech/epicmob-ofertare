import { prisma } from '@/lib/db';
import { balanceOf } from './balance';
import { parseMonthKey } from './month';

const dec = (d: { toNumber(): number }) => d.toNumber();

/** Soldurile tuturor conturilor (Σ mișcări), ca Map accountId → sold. */
export async function loadBalances(): Promise<Map<string, number>> {
  const rows = await prisma.movement.findMany({ select: { accountId: true, type: true, amount: true } });
  const byAccount = new Map<string, { type: string; amount: number }[]>();
  for (const r of rows) byAccount.set(r.accountId, [...(byAccount.get(r.accountId) ?? []), { type: r.type, amount: dec(r.amount) }]);
  const out = new Map<string, number>();
  for (const [id, ms] of byAccount) out.set(id, balanceOf(ms));
  return out;
}

export type MovementRow = Awaited<ReturnType<typeof loadMovements>>[number];

/** Mișcările unui cont (opțional pe lună), cu ce le explică: document, împrumut, proiect, contra-cont, utilizator. */
export async function loadMovements(accountId: string, monthKey?: string | null) {
  const month = parseMonthKey(monthKey);
  const rows = await prisma.movement.findMany({
    where: { accountId, ...(month ? { date: { gte: month.start, lt: month.end } } : {}) },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      document: { select: { id: true, counterparty: true, kind: true, number: true, direction: true } },
      loan: { select: { id: true, lenderName: true } },
      project: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  const pairIds = rows.map((r) => r.transferPairId).filter((x): x is string => !!x);
  const pairs = pairIds.length
    ? await prisma.movement.findMany({
        where: { transferPairId: { in: pairIds }, accountId: { not: accountId } },
        select: { transferPairId: true, account: { select: { id: true, name: true } } },
      })
    : [];
  const counter = new Map(pairs.map((p) => [p.transferPairId!, p.account]));
  return rows.map((r) => ({
    id: r.id, type: r.type, amount: dec(r.amount), date: r.date, note: r.note,
    incomeType: r.incomeType, adjustmentReason: r.adjustmentReason,
    document: r.document, loan: r.loan, project: r.project,
    counterAccount: r.transferPairId ? counter.get(r.transferPairId) ?? null : null,
    user: r.createdBy?.name ?? null,
  }));
}

export async function loadAccountsOverview() {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }] }),
    loadBalances(),
  ]);
  const withRecent = await Promise.all(
    accounts.map(async (a) => ({
      ...a,
      balance: balances.get(a.id) ?? 0,
      recent: (await loadMovements(a.id)).slice(0, 5),
    })),
  );
  return withRecent;
}

export async function loadAccountOptions() {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    loadBalances(),
  ]);
  return accounts.map((a) => ({ value: a.id, label: a.name, balance: balances.get(a.id) ?? 0 }));
}

export async function loadAdjustments() {
  const rows = await prisma.movement.findMany({
    where: { type: 'ADJUSTMENT' },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: { account: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id, date: r.date, account: r.account.name, amount: dec(r.amount), reason: r.adjustmentReason ?? '', user: r.createdBy?.name ?? null,
  }));
}

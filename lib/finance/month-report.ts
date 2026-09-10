import { prisma } from '@/lib/db';
import { monthKey, parseMonthKey } from './month';
import { round2 } from './money';
import { loadProjectsMoney } from './project-money';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

/** Cifrele unei luni (§5.3): venit recunoscut la Montat, directe, contribuție, fixe, net; cash-flow separat. */
export interface MonthFigures {
  key: string;
  revenue: number;       // Σ preț contract al proiectelor cu mountedAt în lună
  direct: number;        // Σ alocări ale acelor proiecte (indiferent de data facturii)
  contribution: number;
  fixed: number;         // partea indirectă a documentelor EXPENSE cu issuedAt în lună (inclusiv așteptate)
  net: number;
  cashIn: number;        // Σ IN (fără transferuri/ajustări)
  cashOut: number;       // Σ OUT
  mountedCount: number;
}

async function fixedCostsForMonth(start: Date, end: Date) {
  const docs = await prisma.document.findMany({
    where: { direction: 'EXPENSE', replacedBy: null, issuedAt: { gte: start, lt: end } },
    select: { amount: true, categoryId: true, category: { select: { name: true } }, allocations: { select: { amount: true } } },
  });
  const byCategory = new Map<string, number>();
  let total = 0;
  for (const d of docs) {
    const indirect = round2(dec(d.amount) - d.allocations.reduce((s, a) => s + dec(a.amount), 0));
    if (indirect <= 0) continue;
    total += indirect;
    const name = d.category?.name ?? 'Fără categorie';
    byCategory.set(name, (byCategory.get(name) ?? 0) + indirect);
  }
  return { total: round2(total), byCategory: [...byCategory.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount) };
}

export async function loadMonthFigures(key: string): Promise<MonthFigures & { projects: { id: string; name: string; client: string | null; mountedAt: Date | null; contract: number; direct: number; contribution: number; contributionPct: number | null }[]; fixedByCategory: { category: string; amount: number }[] }> {
  const m = parseMonthKey(key) ?? parseMonthKey(monthKey())!;
  const [mounted, fixed, cash] = await Promise.all([
    prisma.project.findMany({ where: { mountedAt: { gte: m.start, lt: m.end } }, select: { id: true, name: true, mountedAt: true, client: { select: { name: true } } }, orderBy: { mountedAt: 'asc' } }),
    fixedCostsForMonth(m.start, m.end),
    prisma.movement.groupBy({ by: ['type'], where: { date: { gte: m.start, lt: m.end }, type: { in: ['IN', 'OUT'] } }, _sum: { amount: true } }),
  ]);
  const money = await loadProjectsMoney(mounted.map((p) => p.id));
  const projects = mounted.map((p) => {
    const x = money.get(p.id)!;
    return { id: p.id, name: p.name, client: p.client?.name ?? null, mountedAt: p.mountedAt, contract: x.contract, direct: x.spent, contribution: x.contribution, contributionPct: x.contributionPct };
  });
  const revenue = round2(projects.reduce((s, p) => s + p.contract, 0));
  const direct = round2(projects.reduce((s, p) => s + p.direct, 0));
  const contribution = round2(revenue - direct);
  const cashIn = dec(cash.find((c) => c.type === 'IN')?._sum.amount);
  const cashOut = dec(cash.find((c) => c.type === 'OUT')?._sum.amount);
  return {
    key: m.key, revenue, direct, contribution, fixed: fixed.total, net: round2(contribution - fixed.total),
    cashIn: round2(cashIn), cashOut: round2(cashOut), mountedCount: projects.length,
    projects, fixedByCategory: fixed.byCategory,
  };
}

/** Ultimele N luni (cronologic), pentru graficul contribuție vs fixe cu linia net. */
export async function loadMonthSeries(n = 12, upTo = new Date()): Promise<MonthFigures[]> {
  const keys = Array.from({ length: n }, (_, i) => monthKey(new Date(upTo.getFullYear(), upTo.getMonth() - (n - 1 - i), 1)));
  const rows = await Promise.all(keys.map(async (k) => {
    const f = await loadMonthFigures(k);
    return { key: f.key, revenue: f.revenue, direct: f.direct, contribution: f.contribution, fixed: f.fixed, net: f.net, cashIn: f.cashIn, cashOut: f.cashOut, mountedCount: f.mountedCount };
  }));
  return rows;
}

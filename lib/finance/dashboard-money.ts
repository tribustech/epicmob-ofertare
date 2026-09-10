import { prisma } from '@/lib/db';
import { PROJECT_TAB_STATUSES } from '@/lib/crm/project-queries';
import { loadBalances } from './account-queries';
import { personalDebt } from './balance';
import { remainingToPay } from './documents';
import { loadLoans } from './loans';
import { round2 } from './money';
import { loadProjectsMoney } from './project-money';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);
const DAY_MS = 86_400_000;

/** Banda de bani de pe Dashboard (§5.5 + cardul „Datorii" care combină facturi, împrumuturi și conturi personale pe minus). */
export async function loadDashboardMoney() {
  const [accounts, balances, unpaidDocs, loans] = await Promise.all([
    prisma.account.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    loadBalances(),
    prisma.document.findMany({
      where: { direction: 'EXPENSE', replacedBy: null },
      select: { id: true, counterparty: true, kind: true, dueAt: true, amount: true, expected: true, movements: { select: { amount: true } } },
    }),
    loadLoans(),
  ]);

  const firmAccounts = accounts.filter((a) => !a.personal).map((a) => ({ id: a.id, name: a.name, balance: balances.get(a.id) ?? 0 }));
  const personal = accounts.filter((a) => a.personal).map((a) => ({ id: a.id, name: a.name, balance: balances.get(a.id) ?? 0, debt: personalDebt(balances.get(a.id) ?? 0) }));
  const accountsTotal = round2(firmAccounts.reduce((s, a) => s + a.balance, 0));

  const unpaid = unpaidDocs
    .map((d) => ({ id: d.id, counterparty: d.counterparty, kind: d.kind, dueAt: d.dueAt, expected: d.expected, remaining: remainingToPay(dec(d.amount), d.movements.reduce((s, m) => s + dec(m.amount), 0)) }))
    .filter((d) => d.remaining > 0.005)
    .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  const unpaidTotal = round2(unpaid.reduce((s, d) => s + d.remaining, 0));

  const in30 = Date.now() + 30 * DAY_MS;
  const openLoans = loans.filter((l) => l.remaining > 0.005);
  const loansTotal = round2(openLoans.reduce((s, l) => s + l.remaining, 0));
  const loansDue30 = round2(openLoans.filter((l) => l.dueAt && l.dueAt.getTime() <= in30).reduce((s, l) => s + l.remaining, 0));
  const personalDebtTotal = round2(personal.reduce((s, a) => s + a.debt, 0));

  // de încasat: proiectele active cu contract − încasat > 0
  const activeProjects = await prisma.project.findMany({ where: { status: { in: PROJECT_TAB_STATUSES.active.concat('MONTAT') } }, select: { id: true, name: true } });
  const money = await loadProjectsMoney(activeProjects.map((p) => p.id));
  const receivables = activeProjects
    .map((p) => ({ id: p.id, name: p.name, remaining: money.get(p.id)?.receivable ?? 0 }))
    .filter((p) => p.remaining > 0.005)
    .sort((a, b) => b.remaining - a.remaining);
  const receivableTotal = round2(receivables.reduce((s, p) => s + p.remaining, 0));

  return {
    accounts: firmAccounts, accountsTotal, personal,
    available: round2(accountsTotal - unpaidTotal - loansDue30),
    unpaid, unpaidTotal, loans: openLoans, loansTotal, loansDue30, personalDebtTotal,
    debtsTotal: round2(unpaidTotal + loansTotal + personalDebtTotal),
    receivables, receivableTotal,
  };
}

export type DashboardMoney = Awaited<ReturnType<typeof loadDashboardMoney>>;

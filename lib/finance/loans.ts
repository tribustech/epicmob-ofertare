import { prisma } from '@/lib/db';
import { round2 } from './money';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

/** Împrumuturile cu returnat/rămas (rămas = principal − Σ returnări). */
export async function loadLoans() {
  const loans = await prisma.loan.findMany({
    orderBy: [{ receivedAt: 'desc' }],
    include: { movements: { include: { account: { select: { id: true, name: true } } }, orderBy: { date: 'desc' } }, createdBy: { select: { name: true } } },
  });
  return loans.map((l) => {
    const returned = l.movements.filter((m) => m.type === 'OUT').reduce((s, m) => s + dec(m.amount), 0);
    const principal = dec(l.principal);
    return {
      id: l.id, lenderName: l.lenderName, principal, receivedAt: l.receivedAt, dueAt: l.dueAt, note: l.note,
      returned: round2(returned), remaining: round2(Math.max(0, principal - returned)),
      receivedInto: l.movements.find((m) => m.type === 'IN')?.account.name ?? null,
      repayments: l.movements.filter((m) => m.type === 'OUT').map((m) => ({ id: m.id, date: m.date, amount: dec(m.amount), account: m.account.name })),
      user: l.createdBy?.name ?? null,
    };
  });
}

export type LoanRow = Awaited<ReturnType<typeof loadLoans>>[number];

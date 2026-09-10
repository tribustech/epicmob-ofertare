import { prisma } from '@/lib/db';
import { round2 } from './money';
import { paymentStatus, projectShareOfUnpaid, remainingToPay } from './documents';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

/** Cifrele de bani ale unui proiect (§5.2): contract, încasat, cheltuit, contribuție, de încasat, de plătit furnizori. */
export interface ProjectMoney {
  acceptedQuotes: number;   // Σ acceptedPrice
  contractChanges: number;  // Σ ContractChange
  contract: number;         // preț contract = oferte acceptate + modificări
  received: number;         // Σ încasări (Movement IN pe proiect)
  spent: number;            // Σ alocări
  contribution: number;     // contract − cheltuit
  contributionPct: number | null;
  receivable: number;       // contract − încasat
  unpaidShare: number;      // Σ (doc − plătit) × (alocare / doc)
}

export function summarize(args: { acceptedQuotes: number; contractChanges: number; received: number; spent: number; unpaidShare: number }): ProjectMoney {
  const contract = round2(args.acceptedQuotes + args.contractChanges);
  const contribution = round2(contract - args.spent);
  return {
    ...args, contract, contribution,
    contributionPct: contract > 0 ? round2((contribution / contract) * 100) : null,
    receivable: round2(contract - args.received),
    unpaidShare: round2(args.unpaidShare),
  };
}

/** Banii mai multor proiecte deodată (liste, dashboard). */
export async function loadProjectsMoney(projectIds: string[]): Promise<Map<string, ProjectMoney>> {
  const out = new Map<string, ProjectMoney>();
  if (projectIds.length === 0) return out;
  const [quotes, changes, receipts, allocs] = await Promise.all([
    prisma.quote.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds }, status: 'ACCEPTATA' }, _sum: { acceptedPrice: true } }),
    prisma.contractChange.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _sum: { amount: true } }),
    prisma.movement.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds }, type: 'IN' }, _sum: { amount: true } }),
    prisma.documentAllocation.findMany({
      where: { projectId: { in: projectIds }, document: { replacedBy: null } },
      select: { projectId: true, amount: true, document: { select: { amount: true, movements: { select: { amount: true } } } } },
    }),
  ]);
  const q = new Map(quotes.map((r) => [r.projectId!, dec(r._sum.acceptedPrice)]));
  const c = new Map(changes.map((r) => [r.projectId, dec(r._sum.amount)]));
  const r = new Map(receipts.map((x) => [x.projectId!, dec(x._sum.amount)]));
  const spent = new Map<string, number>(); const unpaid = new Map<string, number>();
  for (const a of allocs) {
    const amount = dec(a.amount);
    spent.set(a.projectId, (spent.get(a.projectId) ?? 0) + amount);
    const docAmount = dec(a.document.amount);
    const paid = a.document.movements.reduce((s, m) => s + dec(m.amount), 0);
    unpaid.set(a.projectId, (unpaid.get(a.projectId) ?? 0) + projectShareOfUnpaid({ amount: docAmount, paid }, amount));
  }
  for (const id of projectIds) {
    out.set(id, summarize({
      acceptedQuotes: q.get(id) ?? 0, contractChanges: c.get(id) ?? 0, received: r.get(id) ?? 0,
      spent: round2(spent.get(id) ?? 0), unpaidShare: unpaid.get(id) ?? 0,
    }));
  }
  return out;
}

export async function loadProjectMoney(projectId: string): Promise<ProjectMoney> {
  return (await loadProjectsMoney([projectId])).get(projectId)!;
}

/** Detaliile de bani ale unui proiect: încasări, alocări (cu documentul), modificări de contract, facturi neplătite. */
export async function loadProjectMoneyDetail(projectId: string) {
  const [money, receipts, allocations, changes] = await Promise.all([
    loadProjectMoney(projectId),
    prisma.movement.findMany({
      where: { projectId, type: 'IN' },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { account: { select: { id: true, name: true } }, document: { select: { id: true, kind: true, number: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.documentAllocation.findMany({
      where: { projectId, document: { replacedBy: null } },
      orderBy: { document: { issuedAt: 'desc' } },
      include: {
        category: { select: { name: true } },
        document: { select: { id: true, kind: true, number: true, counterparty: true, issuedAt: true, dueAt: true, amount: true, expected: true, movements: { select: { amount: true } }, _count: { select: { attachments: true } } } },
      },
    }),
    prisma.contractChange.findMany({ where: { projectId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], include: { createdBy: { select: { name: true } } } }),
  ]);
  const allocRows = allocations.map((a) => {
    const docAmount = dec(a.document.amount);
    const paid = a.document.movements.reduce((s, m) => s + dec(m.amount), 0);
    return {
      id: a.id, amount: dec(a.amount), category: a.category.name, note: a.note,
      document: {
        id: a.document.id, kind: a.document.kind, number: a.document.number, counterparty: a.document.counterparty, issuedAt: a.document.issuedAt, dueAt: a.document.dueAt,
        amount: docAmount, paid, status: paymentStatus(docAmount, paid), remaining: remainingToPay(docAmount, paid), expected: a.document.expected, attachments: a.document._count.attachments,
      },
      unpaidShare: projectShareOfUnpaid({ amount: docAmount, paid }, dec(a.amount)),
    };
  });
  return {
    money,
    receipts: receipts.map((m) => ({ id: m.id, date: m.date, amount: dec(m.amount), incomeType: m.incomeType, note: m.note, account: m.account, document: m.document, user: m.createdBy?.name ?? null })),
    allocations: allocRows,
    unpaidDocs: allocRows.filter((a) => a.document.remaining > 0.005),
    changes: changes.map((c) => ({ id: c.id, amount: dec(c.amount), description: c.description, date: c.date, user: c.createdBy?.name ?? null })),
  };
}

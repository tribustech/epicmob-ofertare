import { prisma } from '@/lib/db';
import { toDateInput } from '@/lib/crm/dates';
import type { ExpenseDefaults } from '@/components/finance/ExpenseForm';
import type { ExpenseFormOptions } from '@/lib/finance/document-queries';

export async function countPendingSubmissions(): Promise<number> {
  return prisma.submission.count({ where: { status: 'DE_VALIDAT' } });
}

/** Lista „De validat" (implicit) sau istoricul ultimelor procesate. */
export async function loadSubmissions(view: 'pending' | 'istoric') {
  const rows = await prisma.submission.findMany({
    where: view === 'pending' ? { status: 'DE_VALIDAT' } : { status: { in: ['APROBAT', 'RESPINS'] } },
    orderBy: { createdAt: view === 'pending' ? 'asc' : 'desc' },
    take: view === 'pending' ? undefined : 100,
    include: {
      sender: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      allocations: { include: { project: { select: { name: true, client: { select: { name: true } } } } } },
      _count: { select: { attachments: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id, status: s.status, createdAt: s.createdAt, sender: s.sender?.name ?? null, reviewedBy: s.reviewedBy?.name ?? null,
    kind: s.kind, counterparty: s.counterparty, number: s.number, issuedAt: s.issuedAt, amount: s.amount?.toNumber() ?? null,
    project: s.noProject ? 'stoc / general' : s.allocations.length ? s.allocations.map((a) => a.project.client?.name ?? a.project.name).join(', ') : null,
    paymentMethod: s.paymentMethod, text: s.text, rejectReason: s.rejectReason, documentId: s.documentId, attachments: s._count.attachments,
  }));
}

export async function loadSubmission(id: string) {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      sender: { select: { name: true } }, attachments: { orderBy: { createdAt: 'asc' } }, category: true,
      allocations: { include: { project: { select: { name: true, client: { select: { name: true } } } } } },
    },
  });
}

type Sub = NonNullable<Awaited<ReturnType<typeof loadSubmission>>>;

/** Precompletarea formularului de validare: ce a citit AI-ul + ce a ales colegul în bot. */
export function reviewDefaults(s: Sub, options: ExpenseFormOptions): ExpenseDefaults {
  const fmt = (d: { toFixed(n: number): string } | null) => (d ? d.toFixed(2).replace('.', ',') : '');
  const amount = fmt(s.amount);
  const direct = s.category?.scope === 'DIRECT' ? s.category.id : '';
  const indirect = s.category?.scope === 'INDIRECT' ? s.category.id : undefined;
  const kindOf = (k: string) => options.accounts.find((a) => a.kind === k)?.value;
  const accountId = s.paymentMethod === 'CASH' ? kindOf('CASH') : s.paymentMethod === 'CARD' ? kindOf('CARD') ?? kindOf('BANCA') : undefined;
  const note = [s.summary, s.text && `„${s.text}"`, s.sender && `trimis de ${s.sender.name}`].filter(Boolean).join(' · ');
  return {
    kind: s.kind ?? 'BON',
    issuedAt: s.issuedAt ? toDateInput(s.issuedAt) : toDateInput(s.createdAt),
    counterparty: s.counterparty ?? undefined,
    amount,
    number: s.number ?? undefined,
    categoryId: indirect,
    // proiectele închise între timp dispar din formular; Alesia vede împărțirea și în nota de sus
    allocations: s.allocations
      .filter((a) => options.projects.some((p) => p.value === a.projectId))
      .map((a) => ({ projectId: a.projectId, amount: fmt(a.amount), categoryId: direct })),
    payMode: s.paymentMethod === 'NEPLATIT' ? 'UNPAID' : 'PAID',
    accountId,
    note: note.slice(0, 300),
  };
}

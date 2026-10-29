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
      project: { select: { name: true, client: { select: { name: true } } } },
      _count: { select: { attachments: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id, status: s.status, createdAt: s.createdAt, sender: s.sender?.name ?? null, reviewedBy: s.reviewedBy?.name ?? null,
    kind: s.kind, counterparty: s.counterparty, number: s.number, issuedAt: s.issuedAt, amount: s.amount?.toNumber() ?? null,
    project: s.project ? (s.project.client ? `${s.project.name} · ${s.project.client.name}` : s.project.name) : s.noProject ? 'firmă' : null,
    paymentMethod: s.paymentMethod, text: s.text, rejectReason: s.rejectReason, documentId: s.documentId, attachments: s._count.attachments,
  }));
}

export async function loadSubmission(id: string) {
  return prisma.submission.findUnique({
    where: { id },
    include: { sender: { select: { name: true } }, attachments: { orderBy: { createdAt: 'asc' } }, category: true },
  });
}

type Sub = NonNullable<Awaited<ReturnType<typeof loadSubmission>>>;

/** Precompletarea formularului de validare: ce a citit AI-ul + ce a ales colegul în bot. */
export function reviewDefaults(s: Sub, options: ExpenseFormOptions): ExpenseDefaults {
  const amount = s.amount ? s.amount.toFixed(2).replace('.', ',') : '';
  const direct = s.category?.scope === 'DIRECT' ? s.category.id : undefined;
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
    projectId: s.projectId && options.projects.some((p) => p.value === s.projectId) ? s.projectId : undefined,
    allocCategoryId: direct,
    payMode: s.paymentMethod === 'NEPLATIT' ? 'UNPAID' : 'PAID',
    accountId,
    note: note.slice(0, 300),
  };
}

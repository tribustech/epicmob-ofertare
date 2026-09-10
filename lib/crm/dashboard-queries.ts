import { prisma } from '@/lib/db';
import { summarizeQuotePrices } from '@/lib/quote/price-summary';
import { contractOf, PROJECT_TAB_STATUSES } from './project-queries';

const DAY_MS = 86_400_000;

/** Proiectele active, după deadline (fără deadline la coadă). */
export async function loadActiveProjects(limit = 12) {
  const rows = await prisma.project.findMany({
    where: { status: { in: PROJECT_TAB_STATUSES.active } },
    orderBy: [{ deadlineAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: limit,
    include: { client: { select: { name: true } }, quotes: { select: { status: true, acceptedPrice: true } } },
  });
  return rows.map((p) => ({ id: p.id, name: p.name, status: p.status, deadlineAt: p.deadlineAt, client: p.client?.name ?? null, contract: contractOf(p.quotes) }));
}

/** Leaduri cu următoarea acțiune azi sau în trecut. */
export async function loadLeadsToContact() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return prisma.client.findMany({
    where: { stage: { in: ['LEAD', 'CALIFICAT'] }, nextActionAt: { lte: end } },
    orderBy: { nextActionAt: 'asc' },
    select: { id: true, name: true, phone: true, wants: true, nextActionAt: true, nextActionNote: true },
  });
}

/** Oferte TRIMISA fără răspuns de peste N zile (data trimiterii = ultimul eveniment QUOTE_SENT, altfel updatedAt). */
export async function loadStaleQuotes(days = 7) {
  const quotes = await prisma.quote.findMany({
    where: { status: 'TRIMISA', project: { status: { in: PROJECT_TAB_STATUSES.active } } },
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } } },
  });
  if (quotes.length === 0) return [];
  const sentEvents = await prisma.event.findMany({
    where: { type: 'QUOTE_SENT', projectId: { in: quotes.map((q) => q.projectId!).filter(Boolean) } },
    orderBy: { createdAt: 'desc' },
    select: { projectId: true, payloadJson: true, createdAt: true },
  });
  const sentAtByQuote = new Map<string, Date>();
  for (const e of sentEvents) {
    try {
      const { quoteId } = JSON.parse(e.payloadJson) as { quoteId?: string };
      if (quoteId && !sentAtByQuote.has(quoteId)) sentAtByQuote.set(quoteId, e.createdAt);
    } catch { /* payload corupt */ }
  }
  const cutoff = Date.now() - days * DAY_MS;
  const stale = quotes
    .map((q) => ({ ...q, sentAt: sentAtByQuote.get(q.id) ?? q.updatedAt }))
    .filter((q) => q.sentAt.getTime() <= cutoff)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const prices = await summarizeQuotePrices(stale.map((q) => q.id));
  return stale.map((q) => ({
    id: q.id, version: q.version, label: q.label, sentAt: q.sentAt,
    days: Math.round((Date.now() - q.sentAt.getTime()) / DAY_MS),
    project: q.project, sellPrice: prices.get(q.id)?.sellPrice ?? null,
  }));
}

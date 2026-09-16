import { prisma } from '@/lib/db';
import { summarizeQuotePrices } from '@/lib/quote/price-summary';
import { QUOTE_STATUSES, isWaitingStatus } from '@/lib/quote/status';
import { startOfToday } from './dates';
import { contractOf, PROJECT_TAB_STATUSES } from './project-queries';

const WAITING_STATUSES = QUOTE_STATUSES.filter(isWaitingStatus);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

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
  const rows = await prisma.client.findMany({
    where: { stage: { in: ['LEAD', 'CALIFICAT'] }, nextActionAt: { lte: end } },
    orderBy: { nextActionAt: 'asc' },
    select: {
      id: true, name: true, kind: true, phone: true, email: true, address: true, cui: true, source: true, wants: true,
      budgetEstimate: true, nextActionAt: true, nextActionNote: true,
    },
  });
  return rows.map((c) => ({ ...c, budgetEstimate: c.budgetEstimate ? c.budgetEstimate.toNumber() : null }));
}

/** Ofertele de relansat: au dată de revenire azi sau în trecut. Sortate cu cele mai vechi întâi. */
export async function loadQuotesToFollowUp() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const quotes = await prisma.quote.findMany({
    where: {
      followUpAt: { lte: end },
      status: { in: WAITING_STATUSES },
      project: { status: { in: PROJECT_TAB_STATUSES.active } },
    },
    orderBy: { followUpAt: 'asc' },
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } } },
  });
  const prices = await summarizeQuotePrices(quotes.map((q) => q.id));
  return quotes.map((q) => ({
    id: q.id, version: q.version, status: q.status, label: q.label,
    followUpAt: q.followUpAt!, followUpNote: q.followUpNote,
    lateDays: Math.max(0, Math.round((startOfToday().getTime() - startOfDay(q.followUpAt!).getTime()) / DAY_MS)),
    project: q.project, sellPrice: prices.get(q.id)?.sellPrice ?? null,
  }));
}

/** Oferte la client fără dată de revenire, mai vechi de N zile. Plasa de siguranță pentru
 *  ofertele pentru care n-ai apucat să stabilești când revii. */
export async function loadStaleQuotes(days = 7) {
  const cutoff = new Date(Date.now() - days * DAY_MS);
  const quotes = await prisma.quote.findMany({
    where: {
      status: { in: WAITING_STATUSES },
      followUpAt: null,
      project: { status: { in: PROJECT_TAB_STATUSES.active } },
    },
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } } },
  });
  // ofertele vechi n-au `sentAt` (coloană adăugată ulterior) — cad pe updatedAt, ca înainte
  const stale = quotes
    .map((q) => ({ ...q, sentAt: q.sentAt ?? q.updatedAt }))
    .filter((q) => q.sentAt <= cutoff)
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const prices = await summarizeQuotePrices(stale.map((q) => q.id));
  return stale.map((q) => ({
    id: q.id, version: q.version, status: q.status, label: q.label, sentAt: q.sentAt,
    days: Math.round((Date.now() - q.sentAt.getTime()) / DAY_MS),
    project: q.project, sellPrice: prices.get(q.id)?.sellPrice ?? null,
  }));
}

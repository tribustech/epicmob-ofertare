import { prisma } from '@/lib/db';
import { summarizeQuotePrices } from '@/lib/quote/price-summary';
import { loadProjectsMoney } from '@/lib/finance/project-money';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

export type ProjectTab = 'active' | 'montate' | 'inchise' | 'pierdute';

export const PROJECT_TAB_STATUSES: Record<ProjectTab, string[]> = {
  active: ['OFERTARE', 'ACCEPTAT', 'IN_PRODUCTIE'],
  montate: ['MONTAT'],
  inchise: ['INCHIS'],
  pierdute: ['PIERDUT'],
};

/** Preț contract = Σ acceptedPrice al ofertelor ACCEPTATA (modificările de contract vin în Bani). */
export function contractOf(quotes: { status: string; acceptedPrice: { toNumber(): number } | null }[]) {
  return quotes.reduce((s, q) => s + (q.status === 'ACCEPTATA' ? dec(q.acceptedPrice) : 0), 0);
}

export async function loadProjectsList(tab: ProjectTab) {
  const rows = await prisma.project.findMany({
    where: { status: { in: PROJECT_TAB_STATUSES[tab] } },
    orderBy: [{ deadlineAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: { client: { select: { id: true, name: true } }, quotes: { select: { status: true, acceptedPrice: true } } },
  });
  const money = await loadProjectsMoney(rows.map((p) => p.id));
  return rows.map((p) => {
    const m = money.get(p.id);
    return {
      id: p.id, name: p.name, status: p.status, deadlineAt: p.deadlineAt, client: p.client,
      quoteCount: p.quotes.length, contract: m?.contract ?? contractOf(p.quotes),
      received: m?.received ?? 0, spent: m?.spent ?? 0, contribution: m?.contribution ?? 0, contributionPct: m?.contributionPct ?? null,
    };
  });
}

export async function countProjectTabs() {
  const entries = await Promise.all(
    (Object.keys(PROJECT_TAB_STATUSES) as ProjectTab[]).map(async (t) => [t, await prisma.project.count({ where: { status: { in: PROJECT_TAB_STATUSES[t] } } })] as const),
  );
  return Object.fromEntries(entries) as Record<ProjectTab, number>;
}

export async function loadProjectDetail(id: string) {
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, phone: true, stage: true } },
      quotes: { orderBy: { version: 'asc' } },
      events: { orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { name: true } } } },
    },
  });
  if (!p) return null;
  const prices = await summarizeQuotePrices(p.quotes.map((q) => q.id));
  return {
    ...p,
    contract: contractOf(p.quotes),
    quotes: p.quotes.map((q) => ({
      id: q.id, version: q.version, label: q.label, status: q.status, name: q.name,
      acceptedPrice: q.acceptedPrice ? q.acceptedPrice.toNumber() : null, acceptedAt: q.acceptedAt,
      createdAt: q.createdAt, updatedAt: q.updatedAt,
      ...(prices.get(q.id) ?? { cabinetCount: 0, totalCost: null, sellPrice: null }),
    })),
  };
}

/** Pentru breadcrumb-ul editorului de ofertă: client › proiect › versiune. */
export async function loadQuoteContext(quoteId: string) {
  const q = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { version: true, label: true, project: { select: { id: true, name: true, client: { select: { id: true, name: true, phone: true, email: true } } } } },
  });
  return q ?? null;
}

/** Proiectele active (pentru „Mută oferta în alt proiect"). */
export async function loadProjectOptions(excludeId?: string) {
  const rows = await prisma.project.findMany({
    where: { status: { notIn: ['INCHIS', 'PIERDUT'] }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  return rows.map((p) => ({ value: p.id, label: p.client ? `${p.name} · ${p.client.name}` : p.name }));
}

export async function loadClientOptions() {
  const rows = await prisma.client.findMany({ where: { stage: { not: 'PIERDUT' } }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return rows.map((c) => ({ value: c.id, label: c.name }));
}

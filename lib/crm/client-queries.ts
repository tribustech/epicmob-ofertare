import { prisma } from '@/lib/db';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

/** Valoarea contractelor unui client = Σ acceptedPrice al ofertelor ACCEPTATA din proiectele lui. */
function contractValue(projects: { quotes: { status: string; acceptedPrice: { toNumber(): number } | null }[] }[]) {
  return projects.reduce(
    (s, p) => s + p.quotes.reduce((q, x) => q + (x.status === 'ACCEPTATA' ? dec(x.acceptedPrice) : 0), 0),
    0,
  );
}

const quoteSelect = { select: { status: true, acceptedPrice: true } } as const;

export type LeadTab = 'activi' | 'pierduti' | 'remarketing';

export async function loadLeads(tab: LeadTab, source?: string) {
  const where =
    tab === 'pierduti' ? { stage: 'PIERDUT' as const }
    : tab === 'remarketing' ? { remarketing: true }
    : { stage: { in: ['LEAD', 'CALIFICAT'] } };
  const rows = await prisma.client.findMany({
    where: { ...where, ...(source ? { source } : {}) },
    orderBy: [{ nextActionAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
  return rows.map((c) => ({ ...c, budgetEstimate: c.budgetEstimate ? c.budgetEstimate.toNumber() : null }));
}

export async function countLeadTabs() {
  const [activi, pierduti, remarketing] = await Promise.all([
    prisma.client.count({ where: { stage: { in: ['LEAD', 'CALIFICAT'] } } }),
    prisma.client.count({ where: { stage: 'PIERDUT' } }),
    prisma.client.count({ where: { remarketing: true } }),
  ]);
  return { activi, pierduti, remarketing };
}

export async function loadLeadSources() {
  return prisma.leadSource.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
}

export async function loadClientsList(q?: string) {
  const search = q?.trim();
  const rows = await prisma.client.findMany({
    where: {
      stage: { in: ['CLIENT', 'CALIFICAT'] },
      ...(search
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      projects: { select: { quotes: quoteSelect } },
      events: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  return rows.map((c) => ({
    id: c.id, name: c.name, kind: c.kind, phone: c.phone, stage: c.stage,
    projectCount: c.projects.length,
    contractValue: contractValue(c.projects),
    lastActivity: c.events[0]?.createdAt ?? c.updatedAt,
  }));
}

export async function loadClientDetail(id: string) {
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: [{ deadlineAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }], include: { quotes: quoteSelect } },
      events: { orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { name: true } }, project: { select: { name: true } } } },
    },
  });
  if (!c) return null;
  return {
    ...c,
    budgetEstimate: c.budgetEstimate ? c.budgetEstimate.toNumber() : null,
    projects: c.projects.map((p) => ({ ...p, contractValue: contractValue([p]) })),
    contractValue: contractValue(c.projects),
  };
}

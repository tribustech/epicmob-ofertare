/**
 * CRM C1 — migrare idempotentă a datelor (npm run db:migrate-crm):
 * 1. Seed LeadSource (Instagram, Facebook, Recomandare, Site, Telefon, Altul).
 * 2. `Quote.clientName` distinct (trim, case-insensitive) → `Client` (stage CLIENT dacă are ofertă
 *    ACCEPTATA, altfel CALIFICAT); `clientContact` → phone sau email după formă.
 * 3. Fiecare `Quote` fără `projectId` → `Project` CRM cu același nume, clientul găsit (sau null),
 *    status ACCEPTAT / OFERTARE; `version = 1`.
 * 4. Ofertele ACCEPTATA fără `acceptedPrice` → preț înghețat calculat din snapshot.
 * A doua rulare nu creează nimic. Rulare pe producție: după `prisma migrate deploy`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { legHeightByCabinet, loadQuote, toQuoteInput, tryComputeQuote } from '../lib/quote/load';
import type { SnapshotData } from '../lib/quote/compute';

const LEAD_SOURCES = ['Instagram', 'Facebook', 'Recomandare', 'Site', 'Telefon', 'Altul'];

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function splitContact(contact: string | null): { phone?: string; email?: string } {
  const c = contact?.trim();
  if (!c) return {};
  if (c.includes('@')) return { email: c };
  if ((c.match(/\d/g) ?? []).length >= 6) return { phone: c };
  return {};
}

async function seedLeadSources() {
  for (const [i, name] of LEAD_SOURCES.entries()) {
    await prisma.leadSource.upsert({ where: { name }, update: {}, create: { name, sortOrder: i } });
  }
}

async function migrateClients(quotes: { clientName: string | null; clientContact: string | null; status: string; createdAt: Date }[]) {
  const existing = new Map((await prisma.client.findMany()).map((c) => [normName(c.name), c.id]));
  const groups = new Map<string, typeof quotes>();
  for (const q of quotes) {
    const name = q.clientName?.trim();
    if (!name) continue;
    const key = normName(name);
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  let created = 0;
  for (const [key, group] of groups) {
    if (existing.has(key)) continue;
    const first = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const contact = group.map((q) => q.clientContact).find((c) => c?.trim()) ?? null;
    const client = await prisma.client.create({
      data: {
        name: first.clientName!.trim(),
        stage: group.some((q) => q.status === 'ACCEPTATA') ? 'CLIENT' : 'CALIFICAT',
        source: 'Altul',
        firstContactAt: first.createdAt,
        ...splitContact(contact),
      },
    });
    existing.set(key, client.id);
    created++;
  }
  return { clientIdByName: existing, created };
}

async function migrateProjects(
  quotes: { id: string; name: string; clientName: string | null; status: string; projectId: string | null; createdAt: Date; updatedAt: Date }[],
  clientIdByName: Map<string, string>,
) {
  let created = 0;
  for (const q of quotes) {
    if (q.projectId) continue;
    const accepted = q.status === 'ACCEPTATA';
    const clientId = q.clientName?.trim() ? clientIdByName.get(normName(q.clientName)) ?? null : null;
    const project = await prisma.project.create({
      data: {
        name: q.name,
        clientId,
        status: accepted ? 'ACCEPTAT' : 'OFERTARE',
        acceptedAt: accepted ? q.updatedAt : null,
        createdAt: q.createdAt,
      },
    });
    await prisma.quote.update({ where: { id: q.id }, data: { projectId: project.id, version: 1 } });
    created++;
  }
  return created;
}

async function freezeAcceptedPrices(quotes: { id: string; name: string; status: string; acceptedPrice: Prisma.Decimal | null; acceptedAt: Date | null; snapshotJson: string | null; updatedAt: Date }[]) {
  let frozen = 0;
  const missing: string[] = [];
  for (const q of quotes) {
    if (q.status !== 'ACCEPTATA' || q.acceptedPrice !== null) continue;
    let price: number | null = null;
    try {
      const loaded = await loadQuote(q.id);
      const snapshot = q.snapshotJson ? (JSON.parse(q.snapshotJson) as SnapshotData) : null;
      if (loaded && snapshot) {
        const { quote } = tryComputeQuote(
          toQuoteInput(loaded.quote, loaded.cabinets, legHeightByCabinet(loaded.assemblies, loaded.cabinets), loaded.assemblies),
          snapshot,
        );
        price = quote?.costs.sellPrice ?? null;
      }
    } catch {
      price = null;
    }
    if (price === null) { missing.push(q.name); continue; }
    await prisma.quote.update({
      where: { id: q.id },
      data: { acceptedPrice: new Prisma.Decimal(price.toFixed(2)), acceptedAt: q.acceptedAt ?? q.updatedAt },
    });
    frozen++;
  }
  return { frozen, missing };
}

async function main() {
  await seedLeadSources();
  const quotes = await prisma.quote.findMany({ orderBy: { createdAt: 'asc' } });
  const { clientIdByName, created: clientsCreated } = await migrateClients(quotes);
  const projectsCreated = await migrateProjects(quotes, clientIdByName);
  const { frozen, missing } = await freezeAcceptedPrices(quotes);

  console.log(`Oferte: ${quotes.length}`);
  console.log(`Clienți creați: ${clientsCreated}`);
  console.log(`Proiecte create: ${projectsCreated}`);
  console.log(`Prețuri înghețate: ${frozen}`);
  if (missing.length) console.log(`Oferte ACCEPTATA fără preț calculabil: ${missing.join(', ')}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());

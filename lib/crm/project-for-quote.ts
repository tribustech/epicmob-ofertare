import { prisma } from '@/lib/db';

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Garantează că o ofertă are un proiect CRM (folosit de fluxurile care creează oferte fără proiect:
 * Schiță → Ofertă). Clientul se caută după nume normalizat; dacă nu există, se creează CALIFICAT.
 * Întoarce id-ul proiectului.
 */
export async function ensureProjectForQuote(quoteId: string, userId: string | null = null): Promise<string> {
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
  if (quote.projectId) return quote.projectId;

  let clientId: string | null = null;
  const clientName = quote.clientName?.trim();
  if (clientName) {
    const candidates = await prisma.client.findMany({ where: { name: { equals: clientName, mode: 'insensitive' } } });
    const found = candidates.find((c) => normName(c.name) === normName(clientName)) ?? candidates[0];
    clientId = found
      ? found.id
      : (await prisma.client.create({ data: { name: clientName, stage: 'CALIFICAT', source: 'Altul', createdById: userId } })).id;
  }

  const project = await prisma.project.create({
    data: { name: quote.name, clientId, status: quote.status === 'ACCEPTATA' ? 'ACCEPTAT' : 'OFERTARE', createdById: userId },
  });
  await prisma.quote.update({ where: { id: quoteId }, data: { projectId: project.id, version: 1 } });
  return project.id;
}

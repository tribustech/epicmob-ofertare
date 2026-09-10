import { prisma } from '@/lib/db';
import { dueDateFor, periodKeysDue } from './recurring';

/**
 * Generează documentele „așteptate" lipsă pentru toate șabloanele active, până la luna curentă.
 * Idempotent pe (recurringId, periodKey). Se apelează lazy (Dashboard, Finanțe), nu din cron.
 */
export async function generateExpectedDocuments(today = new Date()): Promise<number> {
  const templates = await prisma.recurringExpense.findMany({ where: { active: true }, include: { documents: { select: { periodKey: true } } } });
  let created = 0;
  for (const t of templates) {
    const have = new Set(t.documents.map((d) => d.periodKey));
    for (const key of periodKeysDue(t, today)) {
      if (have.has(key)) continue;
      const dueAt = dueDateFor(key, t.dayOfMonth);
      await prisma.document.create({
        data: {
          direction: 'EXPENSE', kind: 'ALTUL', counterparty: t.counterparty ?? t.name, issuedAt: dueAt, dueAt,
          amount: t.amount, categoryId: t.categoryId, recurringId: t.id, periodKey: key, expected: true, note: t.name,
        },
      });
      created++;
    }
  }
  return created;
}

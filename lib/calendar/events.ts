// lib/calendar/events.ts
// Agregă cele 4 surse de evenimente pentru intervalul vizibil al unei luni. Fără UI.
import { prisma } from '@/lib/db';
import { fmtLei } from '@/lib/format';
import { paymentStatus, remainingToPay } from '@/lib/finance/documents';
import { gridRange } from './grid';
import type { CalendarItem } from './types';

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export async function loadCalendarMonth(key: string, today = new Date()): Promise<CalendarItem[]> {
  const { start, end } = gridRange(key);
  const inRange = { gte: start, lt: end };
  // restanța se calculează față de `today` (implicit azi), pe zile locale
  const todayStart = dayOf(today).getTime();

  const [projects, clients, docs, loans, manual] = await Promise.all([
    prisma.project.findMany({
      where: { deadlineAt: inRange, status: { notIn: ['INCHIS', 'PIERDUT'] } },
      select: { id: true, name: true, deadlineAt: true, client: { select: { name: true } } },
    }),
    prisma.client.findMany({
      where: { nextActionAt: inRange, stage: { not: 'PIERDUT' } },
      select: { id: true, name: true, nextActionAt: true, nextActionNote: true },
    }),
    prisma.document.findMany({
      where: { dueAt: inRange },
      select: { id: true, direction: true, counterparty: true, number: true, dueAt: true, amount: true, expected: true, movements: { select: { amount: true } } },
    }),
    prisma.loan.findMany({
      where: { dueAt: inRange },
      select: { id: true, lenderName: true, principal: true, dueAt: true, movements: { select: { type: true, amount: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { date: inRange },
      select: { id: true, title: true, date: true, time: true, note: true, projectId: true, project: { select: { name: true } } },
    }),
  ]);

  const overdue = (d: Date) => dayOf(d).getTime() < todayStart;
  const items: CalendarItem[] = [];

  for (const p of projects) {
    items.push({
      id: `DEADLINE:${p.id}`, kind: 'DEADLINE', date: dayOf(p.deadlineAt!), time: null,
      title: p.name, subtitle: p.client?.name ?? null, href: `/proiecte/${p.id}`, overdue: overdue(p.deadlineAt!),
    });
  }
  for (const c of clients) {
    items.push({
      id: `ACTIUNE:${c.id}`, kind: 'ACTIUNE', date: dayOf(c.nextActionAt!), time: null,
      title: c.name, subtitle: c.nextActionNote ?? null, href: `/clienti/${c.id}`, overdue: overdue(c.nextActionAt!),
    });
  }
  for (const d of docs) {
    const amount = dec(d.amount);
    const paid = d.movements.reduce((s, m) => s + dec(m.amount), 0);
    if (paymentStatus(amount, paid) === 'PLATIT') continue;
    const rest = remainingToPay(amount, paid);
    const who = d.direction === 'INCOME' ? `De încasat · ${d.counterparty}` : d.counterparty;
    items.push({
      id: `BANI:doc:${d.id}`, kind: 'BANI', date: dayOf(d.dueAt!), time: null,
      title: `${who}${d.number ? ` ${d.number}` : ''}`,
      subtitle: `${fmtLei(rest)}${d.expected ? ' · așteptată' : ''}`,
      href: `/finante/cheltuieli?doc=${d.id}`, overdue: overdue(d.dueAt!),
    });
  }
  for (const l of loans) {
    const returned = l.movements.filter((m) => m.type === 'OUT').reduce((s, m) => s + dec(m.amount), 0);
    const remaining = Math.max(0, dec(l.principal) - returned);
    if (remaining <= 0.005) continue;
    items.push({
      id: `BANI:loan:${l.id}`, kind: 'BANI', date: dayOf(l.dueAt!), time: null,
      title: `Împrumut · ${l.lenderName}`, subtitle: `rest ${fmtLei(remaining)}`,
      href: '/finante/imprumuturi', overdue: overdue(l.dueAt!),
    });
  }
  for (const m of manual) {
    items.push({
      id: `MANUAL:${m.id}`, kind: 'MANUAL', date: dayOf(m.date), time: m.time ?? null,
      title: m.title, subtitle: m.project?.name ?? m.note ?? null, href: null, overdue: false,
      manual: { title: m.title, time: m.time ?? null, note: m.note ?? null, projectId: m.projectId ?? null, projectName: m.project?.name ?? null },
    });
  }
  return items;
}

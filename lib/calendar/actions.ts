'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { logEvent } from '@/lib/crm/events';
import { parseDateInput, toDateInput } from '@/lib/crm/dates';
import { isValidTime } from './grid';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());

const eventSchema = z.object({
  title: z.string().trim().min(1, 'Titlul lipsește'),
  date: z.string().trim().min(1, 'Ziua lipsește'),
  time: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().refine(isValidTime, 'Ora trebuie să fie HH:MM').optional()),
  projectId: optText,
  note: optText,
});

function revalidate(projectId: string | null, clientId: string | null) {
  revalidatePath('/calendar');
  if (projectId) revalidatePath(`/proiecte/${projectId}`);
  if (clientId) revalidatePath(`/clienti/${clientId}`);
}

/** Rezolvă proiectul (și clientul lui) din formular; proiect inexistent → eroare. */
async function resolveProject(projectId: string | undefined) {
  if (!projectId) return { projectId: null, clientId: null };
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, clientId: true } });
  if (!p) throw new Error('Proiectul ales nu mai există.');
  return { projectId: p.id, clientId: p.clientId };
}

export const createCalendarEvent = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = eventSchema.parse(formDataToObject(fd));
  const date = parseDateInput(d.date);
  if (!date) throw new Error('Ziua nu e validă.');
  const link = await resolveProject(d.projectId);
  const ev = await prisma.calendarEvent.create({
    data: { title: d.title, date, time: d.time ?? null, note: d.note ?? null, ...link, createdById: me.id },
  });
  if (link.projectId || link.clientId) {
    await logEvent({
      type: 'CALENDAR_EVENT', projectId: link.projectId, clientId: link.clientId, userId: me.id,
      payload: { eventId: ev.id, title: d.title, date: toDateInput(date), time: d.time ?? null },
    });
  }
  revalidate(link.projectId, link.clientId);
});

export const updateCalendarEvent = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = eventSchema.parse(formDataToObject(fd));
  const date = parseDateInput(d.date);
  if (!date) throw new Error('Ziua nu e validă.');
  const before = await prisma.calendarEvent.findUniqueOrThrow({ where: { id } });
  const link = await resolveProject(d.projectId);
  await prisma.calendarEvent.update({
    where: { id },
    data: { title: d.title, date, time: d.time ?? null, note: d.note ?? null, ...link },
  });
  revalidate(before.projectId, before.clientId);
  revalidate(link.projectId, link.clientId);
});

export const deleteCalendarEvent = formAction(async (id: string) => {
  await requireUser();
  const before = await prisma.calendarEvent.findUniqueOrThrow({ where: { id } });
  await prisma.calendarEvent.delete({ where: { id } });
  revalidate(before.projectId, before.clientId);
});

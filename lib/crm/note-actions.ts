'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { requireUser } from '@/lib/auth/current-user';

const noteSchema = z.object({
  body: z.string().trim().min(1, 'Scrie ceva în notiță'),
  pinned: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

/** Paginile pe care apare notița: clientul și proiectul (dacă e pe proiect, și clientul proiectului). */
async function revalidateNote(note: { clientId: string | null; projectId: string | null }) {
  revalidatePath('/');
  if (note.projectId) {
    revalidatePath(`/proiecte/${note.projectId}`);
    const p = await prisma.project.findUnique({ where: { id: note.projectId }, select: { clientId: true } });
    if (p?.clientId) revalidatePath(`/clienti/${p.clientId}`);
  }
  if (note.clientId) {
    revalidatePath(`/clienti/${note.clientId}`);
    const projects = await prisma.project.findMany({ where: { clientId: note.clientId }, select: { id: true } });
    for (const p of projects) revalidatePath(`/proiecte/${p.id}`);
  }
}

/** Notiță pe client SAU pe proiect (exact unul). */
export const createNote = formAction(async (target: { clientId?: string; projectId?: string }, fd: FormData) => {
  const me = await requireUser();
  if (!!target.clientId === !!target.projectId) throw new Error('Notița trebuie să fie pe client sau pe proiect.');
  const d = noteSchema.parse({ body: fd.get('body'), pinned: fd.get('pinned') });
  const note = await prisma.note.create({
    data: { clientId: target.clientId ?? null, projectId: target.projectId ?? null, body: d.body, pinned: d.pinned, createdById: me.id },
  });
  await revalidateNote(note);
});

export const toggleNotePin = formAction(async (id: string) => {
  await requireUser();
  const note = await prisma.note.findUniqueOrThrow({ where: { id } });
  await prisma.note.update({ where: { id }, data: { pinned: !note.pinned } });
  await revalidateNote(note);
});

export const deleteNote = formAction(async (id: string) => {
  await requireUser();
  const note = await prisma.note.delete({ where: { id } });
  await revalidateNote(note);
});

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { logEvent } from './events';
import { parseDateInput } from './dates';
import {
  markLostSchema, newLeadSchema, newProjectSchema, nextActionSchema, remarketingSchema, updateClientSchema,
} from './client-schemas';

const money = (n: number | undefined) => (n == null ? null : new Prisma.Decimal(n.toFixed(2)));

function revalidateClient(id: string) {
  revalidatePath('/leaduri');
  revalidatePath('/clienti');
  revalidatePath(`/clienti/${id}`);
}

/** Lead nou = Client cu stage LEAD. Telefon dublat → avertisment în mesaj, dar nu blochează (se creează). */
export const createLead = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = newLeadSchema.parse(formDataToObject(fd));
  const client = await prisma.client.create({
    data: {
      name: d.name, kind: d.kind, phone: d.phone ?? null, email: d.email ?? null, address: d.address ?? null, cui: d.cui ?? null,
      source: d.source ?? null, wants: d.wants ?? null, budgetEstimate: money(d.budgetEstimate),
      nextActionAt: parseDateInput(d.nextActionAt), nextActionNote: d.nextActionNote ?? null,
      stage: 'LEAD', createdById: me.id,
    },
  });
  await logEvent({ type: 'CLIENT_CREATED', clientId: client.id, userId: me.id, payload: { source: d.source ?? null } });
  revalidateClient(client.id);
  redirect(`/clienti/${client.id}`);
});

export const updateClient = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = updateClientSchema.parse(formDataToObject(fd));
  await prisma.client.update({
    where: { id },
    data: {
      name: d.name, kind: d.kind, phone: d.phone ?? null, email: d.email ?? null, address: d.address ?? null, cui: d.cui ?? null,
      source: d.source ?? null, wants: d.wants ?? null, budgetEstimate: money(d.budgetEstimate),
    },
  });
  await logEvent({ type: 'CLIENT_UPDATED', clientId: id, userId: me.id });
  revalidateClient(id);
});

export const setNextAction = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = nextActionSchema.parse(formDataToObject(fd));
  const nextActionAt = parseDateInput(d.nextActionAt);
  await prisma.client.update({ where: { id }, data: { nextActionAt, nextActionNote: nextActionAt ? d.nextActionNote ?? null : null } });
  await logEvent({
    type: 'NEXT_ACTION', clientId: id, userId: me.id,
    payload: { at: nextActionAt?.toISOString() ?? null, note: nextActionAt ? d.nextActionNote ?? null : null },
  });
  revalidateClient(id);
});

async function setStage(id: string, to: string, userId: string, extra: Prisma.ClientUpdateInput = {}, payload: Record<string, unknown> = {}) {
  const before = await prisma.client.findUniqueOrThrow({ where: { id }, select: { stage: true } });
  if (before.stage === to) return;
  await prisma.client.update({ where: { id }, data: { stage: to, ...extra } });
  await logEvent({ type: 'CLIENT_STAGE', clientId: id, userId, payload: { from: before.stage, to, ...payload } });
}

export const markLost = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = markLostSchema.parse(formDataToObject(fd));
  await setStage(id, 'PIERDUT', me.id,
    { lostReason: d.lostReason, lostNote: d.lostNote ?? null, nextActionAt: null, nextActionNote: null },
    { reason: d.lostReason, note: d.lostNote ?? null });
  revalidateClient(id);
});

/** PIERDUT → înapoi la LEAD (a revenit clientul). */
export const reactivateClient = formAction(async (id: string) => {
  const me = await requireUser();
  await setStage(id, 'LEAD', me.id, { lostReason: null, lostNote: null });
  revalidateClient(id);
});

export const setRemarketing = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = remarketingSchema.parse(formDataToObject(fd));
  await prisma.client.update({ where: { id }, data: { remarketing: d.remarketing, remarketingNote: d.remarketing ? d.remarketingNote ?? null : null } });
  await logEvent({ type: 'REMARKETING', clientId: id, userId: me.id, payload: { on: d.remarketing, note: d.remarketing ? d.remarketingNote ?? null : null } });
  revalidateClient(id);
});

/** „Creează proiect" pe client: LEAD → CALIFICAT; proiectul pornește în OFERTARE. */
export const createProjectForClient = formAction(async (clientId: string, fd: FormData) => {
  const me = await requireUser();
  const d = newProjectSchema.parse(formDataToObject(fd));
  const project = await prisma.project.create({
    data: { clientId, name: d.name, description: d.description ?? null, deadlineAt: parseDateInput(d.deadlineAt), createdById: me.id },
  });
  await logEvent({ type: 'PROJECT_CREATED', clientId, projectId: project.id, userId: me.id, payload: { name: d.name } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { stage: true } });
  if (client.stage === 'LEAD') await setStage(clientId, 'CALIFICAT', me.id);
  revalidateClient(clientId);
  revalidatePath('/proiecte');
});

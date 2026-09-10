'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { formDataToObject } from '@/lib/catalog/schemas';
import { requireUser } from '@/lib/auth/current-user';
import { buildSnapshot } from '@/lib/quote/snapshot';
import { isFrozenStatus } from '@/lib/quote/basis';
import { computeSellPrice } from '@/lib/quote/price-summary';
import type { SnapshotData } from '@/lib/quote/compute';
import { logEvent } from './events';
import { parseDateInput } from './dates';
import { LOST_REASONS, PROJECT_STATUSES } from './constants';

const optText = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().trim().optional());
const optNum = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().nonnegative().optional());

function revalidateProject(id: string, clientId?: string | null) {
  revalidatePath('/proiecte');
  revalidatePath(`/proiecte/${id}`);
  if (clientId) revalidatePath(`/clienti/${clientId}`);
  revalidatePath('/clienti');
}

export const createProject = formAction(async (fd: FormData) => {
  const me = await requireUser();
  const d = z.object({
    clientId: z.string().min(1, 'Alege clientul'),
    name: z.string().trim().min(1, 'Numele proiectului lipsește'),
    description: optText,
    deadlineAt: optText,
  }).parse(formDataToObject(fd));
  const project = await prisma.project.create({
    data: { clientId: d.clientId, name: d.name, description: d.description ?? null, deadlineAt: parseDateInput(d.deadlineAt), createdById: me.id },
  });
  await logEvent({ type: 'PROJECT_CREATED', clientId: d.clientId, projectId: project.id, userId: me.id, payload: { name: d.name } });
  const client = await prisma.client.findUniqueOrThrow({ where: { id: d.clientId }, select: { stage: true } });
  if (client.stage === 'LEAD') {
    await prisma.client.update({ where: { id: d.clientId }, data: { stage: 'CALIFICAT' } });
    await logEvent({ type: 'CLIENT_STAGE', clientId: d.clientId, userId: me.id, payload: { from: 'LEAD', to: 'CALIFICAT' } });
  }
  revalidateProject(project.id, d.clientId);
  redirect(`/proiecte/${project.id}`);
});

export const updateProjectDetails = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ name: z.string().trim().min(1, 'Numele lipsește'), description: optText, deadlineAt: optText }).parse(formDataToObject(fd));
  const before = await prisma.project.findUniqueOrThrow({ where: { id } });
  const deadlineAt = parseDateInput(d.deadlineAt);
  await prisma.project.update({ where: { id }, data: { name: d.name, description: d.description ?? null, deadlineAt } });
  if ((before.deadlineAt?.getTime() ?? null) !== (deadlineAt?.getTime() ?? null)) {
    await logEvent({
      type: 'DEADLINE_CHANGED', projectId: id, clientId: before.clientId, userId: me.id,
      payload: { from: before.deadlineAt?.toISOString() ?? null, to: deadlineAt?.toISOString() ?? null },
    });
  }
  revalidateProject(id, before.clientId);
});

async function changeStatus(id: string, to: string, userId: string, extra: Prisma.ProjectUpdateInput = {}, payload: Record<string, unknown> = {}) {
  const before = await prisma.project.findUniqueOrThrow({ where: { id } });
  if (before.status === to) return before;
  const stamps: Prisma.ProjectUpdateInput = {};
  if (to === 'ACCEPTAT' && !before.acceptedAt) stamps.acceptedAt = new Date();
  if (to === 'MONTAT') stamps.mountedAt = new Date();
  if (to === 'INCHIS') stamps.closedAt = new Date();
  await prisma.project.update({ where: { id }, data: { status: to, ...stamps, ...extra } });
  await logEvent({ type: 'PROJECT_STATUS', projectId: id, clientId: before.clientId, userId, payload: { from: before.status, to, ...payload } });
  return before;
}

/** „Trece la…": următoarea stare; la MONTAT se pot completa orele lucrate. */
export const advanceProject = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ to: z.enum(PROJECT_STATUSES), hoursWorked: optNum }).parse(formDataToObject(fd));
  const before = await changeStatus(id, d.to, me.id, d.to === 'MONTAT' && d.hoursWorked != null ? { hoursWorked: d.hoursWorked } : {});
  revalidateProject(id, before.clientId);
});

export const markProjectLost = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ lostReason: z.enum(LOST_REASONS), lostNote: optText }).parse(formDataToObject(fd));
  const before = await changeStatus(id, 'PIERDUT', me.id, { lostReason: d.lostReason, lostNote: d.lostNote ?? null }, { reason: d.lostReason, note: d.lostNote ?? null });
  revalidateProject(id, before.clientId);
});

export const setHoursWorked = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const d = z.object({ hoursWorked: optNum }).parse(formDataToObject(fd));
  const p = await prisma.project.update({ where: { id }, data: { hoursWorked: d.hoursWorked ?? null } });
  revalidateProject(id, p.clientId);
});

/** Ofertă nouă pe proiect: versiunea următoare, cu setările implicite din Setări. */
export const createQuoteForProject = formAction(async (projectId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ label: optText }).parse(formDataToObject(fd));
  const [project, settings, last] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { client: { select: { name: true, phone: true, email: true } } } }),
    prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } }),
    prisma.quote.aggregate({ where: { projectId }, _max: { version: true } }),
  ]);
  const version = (last._max.version ?? 0) + 1;
  const quote = await prisma.quote.create({
    data: {
      projectId, version, label: d.label ?? null, name: project.name,
      clientName: project.client?.name ?? null, clientContact: project.client?.phone ?? project.client?.email ?? null,
      laborPct: settings.laborPct, yieldFactor: settings.sheetYieldFactor,
    },
  });
  await logEvent({ type: 'QUOTE_CREATED', projectId, clientId: project.clientId, userId: me.id, payload: { quoteId: quote.id, version } });
  revalidateProject(projectId, project.clientId);
  redirect(`/oferte/${quote.id}`);
});

/**
 * Acceptă oferta: îngheață snapshot-ul (dacă nu e deja) și prețul, trece celelalte oferte TRIMISA
 * pe RESPINSA, proiectul pe ACCEPTAT (dacă era OFERTARE) și clientul pe CLIENT.
 */
export const acceptQuote = formAction(async (quoteId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ deadlineAt: optText }).parse(formDataToObject(fd));
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { project: true } });
  if (!quote.project) throw new Error('Oferta nu e legată de un proiect.');
  if (quote.status === 'ACCEPTATA') throw new Error('Oferta e deja acceptată.');

  const snapshot: SnapshotData =
    isFrozenStatus(quote.status) && quote.snapshotJson ? (JSON.parse(quote.snapshotJson) as SnapshotData) : await buildSnapshot();
  const price = await computeSellPrice(quoteId, snapshot);
  if (price == null) throw new Error('Oferta nu se poate calcula (corpuri incomplete sau prețuri lipsă). Verifică oferta înainte de acceptare.');

  const now = new Date();
  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'ACCEPTATA', snapshotJson: JSON.stringify(snapshot), acceptedPrice: new Prisma.Decimal(price.toFixed(2)), acceptedAt: now },
  });
  const rejected = await prisma.quote.updateMany({ where: { projectId: quote.projectId!, status: 'TRIMISA', id: { not: quoteId } }, data: { status: 'RESPINSA' } });
  await logEvent({
    type: 'QUOTE_ACCEPTED', projectId: quote.projectId, clientId: quote.project.clientId, userId: me.id,
    payload: { quoteId, version: quote.version, price, rejected: rejected.count },
  });

  const deadlineAt = parseDateInput(d.deadlineAt);
  if (deadlineAt && !quote.project.deadlineAt) {
    await prisma.project.update({ where: { id: quote.projectId! }, data: { deadlineAt } });
    await logEvent({ type: 'DEADLINE_CHANGED', projectId: quote.projectId, clientId: quote.project.clientId, userId: me.id, payload: { from: null, to: deadlineAt.toISOString() } });
  }
  if (quote.project.status === 'OFERTARE') await changeStatus(quote.projectId!, 'ACCEPTAT', me.id);

  if (quote.project.clientId) {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: quote.project.clientId }, select: { stage: true } });
    if (client.stage !== 'CLIENT') {
      await prisma.client.update({ where: { id: quote.project.clientId }, data: { stage: 'CLIENT' } });
      await logEvent({ type: 'CLIENT_STAGE', clientId: quote.project.clientId, userId: me.id, payload: { from: client.stage, to: 'CLIENT' } });
    }
  }
  revalidateProject(quote.projectId!, quote.project.clientId);
  revalidatePath(`/oferte/${quoteId}`);
});

/** Mută o ofertă în alt proiect (grupare manuală după migrare). Primește versiunea următoare acolo. */
export const moveQuoteToProject = formAction(async (quoteId: string, fd: FormData) => {
  const me = await requireUser();
  const d = z.object({ projectId: z.string().min(1, 'Alege proiectul') }).parse(formDataToObject(fd));
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { project: { select: { clientId: true } } } });
  if (quote.projectId === d.projectId) throw new Error('Oferta e deja în acest proiect.');
  const [target, last] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: d.projectId } }),
    prisma.quote.aggregate({ where: { projectId: d.projectId }, _max: { version: true } }),
  ]);
  await prisma.quote.update({ where: { id: quoteId }, data: { projectId: d.projectId, version: (last._max.version ?? 0) + 1 } });
  await logEvent({ type: 'QUOTE_MOVED', projectId: d.projectId, clientId: target.clientId, userId: me.id, payload: { quoteId, from: quote.projectId } });
  if (quote.projectId) revalidateProject(quote.projectId, quote.project?.clientId);
  revalidateProject(d.projectId, target.clientId);
  revalidatePath(`/oferte/${quoteId}`);
  redirect(`/proiecte/${d.projectId}`);
});

/**
 * Bot cheltuieli — nucleul, independent de canal. Adaptorul (Telegram acum, WhatsApp mai târziu)
 * traduce mesajele în apelurile de aici și dă un `ChatOut` prin care răspundem.
 *
 * Fluxul: poză/PDF/text → Submission PRIMIT → AI citește → colegul alege proiectul → alege plata →
 * DE_VALIDAT → în aplicație cineva (Alesia) aprobă (devine Document) sau respinge.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFileBytes, putFile, submissionFileKey } from '@/lib/storage/s3';
import { extractReceipt } from './extract';
import {
  PAYMENT_METHOD_LABELS, describeReceipt, encodeAction, normalizeReceipt, projectChoices,
  type BotAction, type ReceiptFields,
} from './receipt';
import type { Keyboard } from './telegram-api';

export type Channel = 'TELEGRAM' | 'WHATSAPP';

export interface ChatOut {
  send(chatId: string, text: string, kb?: Keyboard): Promise<string>;
  edit(chatId: string, messageId: string, text: string, kb?: Keyboard): Promise<void>;
}

/** Proiectele pe care se fac cheltuieli acum (nu ofertele în lucru). */
const SPENDING_STATUSES = ['ACCEPTAT', 'IN_PRODUCTIE', 'MONTAT'];

async function activeProjects() {
  const rows = await prisma.project.findMany({
    where: { status: { in: SPENDING_STATUSES }, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, client: { select: { name: true } } },
  });
  return rows.map((p) => ({ id: p.id, label: p.client ? `${p.name} · ${p.client.name}` : p.name }));
}

export async function findLinkedUser(channel: Channel, externalId: string) {
  const link = await prisma.chatLink.findUnique({ where: { channel_externalId: { channel, externalId } }, include: { user: true } });
  return link && link.user.active ? link.user : null;
}

export async function linkChat(channel: Channel, externalId: string, chatId: string, displayName: string | null, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;
  await prisma.chatLink.upsert({
    where: { channel_externalId: { channel, externalId } },
    create: { channel, externalId, chatId, displayName, userId },
    update: { chatId, displayName, userId },
  });
  return user;
}

/**
 * Creează trimiterea sau, pentru un album (mai multe poze trimise odată), o refolosește.
 * `created` = acest apel a creat-o și deci el pornește citirea.
 */
export async function openSubmission(input: { channel: Channel; chatId: string; senderId: string; text: string | null; mediaGroupId: string | null }) {
  const data = { channel: input.channel, chatId: input.chatId, senderId: input.senderId, text: input.text, mediaGroupId: input.mediaGroupId };
  if (!input.mediaGroupId) return { submission: await prisma.submission.create({ data }), created: true };
  try {
    return { submission: await prisma.submission.create({ data }), created: true };
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
    const submission = await prisma.submission.findUniqueOrThrow({
      where: { channel_chatId_mediaGroupId: { channel: input.channel, chatId: input.chatId, mediaGroupId: input.mediaGroupId } },
    });
    // caption-ul vine de obicei doar pe una din pozele albumului
    if (input.text && !submission.text) await prisma.submission.update({ where: { id: submission.id }, data: { text: input.text } });
    return { submission, created: false };
  }
}

export async function addFile(submissionId: string, bytes: Uint8Array, mime: string) {
  const n = await prisma.attachment.count({ where: { submissionId } });
  const { key, url } = await putFile(submissionFileKey(submissionId, n + 1, mime), bytes, mime);
  return prisma.attachment.create({ data: { key, url, mime, sizeBytes: bytes.byteLength, submissionId } });
}

const fieldsOf = (s: { kind: string | null; counterparty: string | null; issuedAt: Date | null; amount: Prisma.Decimal | null; number: string | null; summary: string | null }) => ({
  kind: (s.kind ?? 'ALTUL') as ReceiptFields['kind'],
  counterparty: s.counterparty, issuedAt: s.issuedAt, amount: s.amount ? s.amount.toNumber() : null, number: s.number, summary: s.summary,
});

/** Citește documentul cu AI-ul și trimite colegului pasul „pe ce proiect?". */
export async function readAndAskProject(submissionId: string, out: ChatOut) {
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId }, include: { attachments: true, sender: true } });
  const [projects, categories] = await Promise.all([
    activeProjects(),
    prisma.costCategory.findMany({ where: { active: true }, select: { id: true, name: true, scope: true } }),
  ]);

  let fields: ReceiptFields | null = null;
  let extractError: string | null = null;
  let raw: unknown = null;
  try {
    const files = await Promise.all(sub.attachments.map(async (a) => ({ mimeType: a.mime, bytes: await getFileBytes(a.key) })));
    const r = await extractReceipt({ files, text: sub.text, senderName: sub.sender?.name ?? null, projects, categories, today: new Date() });
    raw = r;
    fields = normalizeReceipt(r, { projectIds: projects.map((p) => p.id), categories });
  } catch (e) {
    extractError = e instanceof Error ? e.message : 'Citirea a eșuat.';
  }

  const updated = await prisma.submission.update({
    where: { id: sub.id },
    data: fields
      ? {
          extracted: raw as Prisma.InputJsonValue, extractError: null, kind: fields.kind, counterparty: fields.counterparty, number: fields.number,
          issuedAt: fields.issuedAt, amount: fields.amount, vatPct: fields.vatPct, summary: fields.summary, projectId: fields.projectId,
          categoryId: fields.categoryId, paymentMethod: fields.paymentMethod, step: 'PROIECT',
        }
      : { extractError, step: 'PROIECT' },
  });

  const intro = fields
    ? `Am citit:\n${describeReceipt(fieldsOf(updated))}`
    : `Nu am reușit să citesc ${sub.attachments.length ? 'documentul' : 'mesajul'}, dar îl trimit la validare așa cum e. Alesia completează datele.`;
  const choices = projectChoices(projects, updated.projectId);
  const kb: Keyboard = [
    ...choices.map((p) => [{ label: `${p.suggested ? '⭐ ' : ''}${truncate(p.label, 40)}`, data: encodeAction({ kind: 'project', submissionId: sub.id, projectId: p.id, noProject: false }) }]),
    [
      { label: '🏢 Firmă (fără proiect)', data: encodeAction({ kind: 'project', submissionId: sub.id, projectId: null, noProject: true }) },
      { label: '❓ Nu știu', data: encodeAction({ kind: 'project', submissionId: sub.id, projectId: null, noProject: false }) },
    ],
    [{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: sub.id }) }],
  ];
  const messageId = await out.send(sub.chatId, `${intro}\n\nPe ce proiect?`, kb);
  await prisma.submission.update({ where: { id: sub.id }, data: { botMessageId: messageId } });
}

/** Butoanele din bot. Doar cel care a trimis bonul le poate apăsa. Întoarce textul pentru „toast". */
export async function handleAction(action: BotAction, actorUserId: string, out: ChatOut): Promise<string> {
  const sub = await prisma.submission.findUnique({ where: { id: action.submissionId }, include: { project: { include: { client: true } } } });
  if (!sub || sub.senderId !== actorUserId) return 'Nu poți modifica trimiterea asta.';
  if (sub.status !== 'PRIMIT') return 'Trimiterea a fost deja procesată.';
  const msgId = sub.botMessageId;

  if (action.kind === 'cancel') {
    await prisma.submission.update({ where: { id: sub.id }, data: { status: 'ANULAT', step: 'GATA' } });
    if (msgId) await out.edit(sub.chatId, msgId, `✖ Anulat.\n${describeReceipt(fieldsOf(sub))}`);
    return 'Anulat';
  }

  if (action.kind === 'project') {
    const updated = await prisma.submission.update({
      where: { id: sub.id },
      data: { projectId: action.projectId, noProject: action.noProject, step: 'PLATA' },
      include: { project: { include: { client: true } } },
    });
    const kb: Keyboard = [
      [
        { label: '💵 Cash', data: encodeAction({ kind: 'payment', submissionId: sub.id, method: 'CASH' }) },
        { label: '💳 Card firmă', data: encodeAction({ kind: 'payment', submissionId: sub.id, method: 'CARD' }) },
      ],
      [{ label: '🧾 Neplătit / transfer', data: encodeAction({ kind: 'payment', submissionId: sub.id, method: 'NEPLATIT' }) }],
      [{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: sub.id }) }],
    ];
    const hint = updated.paymentMethod ? `\n(pe document pare ${PAYMENT_METHOD_LABELS[updated.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS].toLowerCase()})` : '';
    if (msgId) await out.edit(sub.chatId, msgId, `${describeReceipt(fieldsOf(updated))}\nProiect: ${projectLabel(updated)}\n\nCum s-a plătit?${hint}`, kb);
    return 'Proiect salvat';
  }

  const updated = await prisma.submission.update({
    where: { id: sub.id },
    data: { paymentMethod: action.method, status: 'DE_VALIDAT', step: 'GATA' },
    include: { project: { include: { client: true } } },
  });
  if (msgId) {
    await out.edit(sub.chatId, msgId,
      `✅ Trimis la validare\n${describeReceipt(fieldsOf(updated))}\nProiect: ${projectLabel(updated)} · Plată: ${PAYMENT_METHOD_LABELS[action.method]}`);
  }
  return 'Trimis la validare';
}

function projectLabel(s: { noProject: boolean; project: { name: string; client: { name: string } | null } | null }) {
  if (s.project) return s.project.client ? `${s.project.name} · ${s.project.client.name}` : s.project.name;
  return s.noProject ? 'firmă (fără proiect)' : 'nu știu — decide Alesia';
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

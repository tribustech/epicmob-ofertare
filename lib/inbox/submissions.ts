/**
 * Bot cheltuieli — nucleul, independent de canal. Adaptorul (Telegram acum, WhatsApp mai târziu)
 * traduce mesajele în apelurile de aici și dă un `ChatOut` prin care răspundem.
 *
 * Fluxul: poză/PDF/text → Submission PRIMIT → AI citește → colegul alege proiectul (unul, mai multe
 * cu împărțire, stoc / general sau „nu știu") → alege plata → DE_VALIDAT → în aplicație cineva
 * (Alesia) aprobă (devine Document) sau respinge.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getFileBytes, putFile, submissionFileKey } from '@/lib/storage/s3';
import { extractReceipt } from './extract';
import { splitEqual } from '@/lib/finance/documents';
import {
  PAYMENT_METHOD_LABELS, describeReceipt, encodeAction, normalizeReceipt, parseAmountsText, projectChoices,
  type BotAction, type ReceiptFields, type SplitMode,
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

const STOCK_CATEGORY = 'Stoc atelier';
/** O trimitere care așteaptă sume scrise de coleg nu mai e „în așteptare" după atâta timp. */
const AWAIT_AMOUNTS_MS = 30 * 60 * 1000;

const withAllocs = { allocations: { include: { project: { include: { client: true } } } } } as const;
type SubWithAllocs = Prisma.SubmissionGetPayload<{ include: typeof withAllocs }>;

const loadSub = (id: string) => prisma.submission.findUnique({ where: { id }, include: withAllocs });

const fmtMoney = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const projectName = (p: { name: string; client: { name: string } | null }) => (p.client ? `${p.name} · ${p.client.name}` : p.name);

/** „Bucătărie · Popescu 300,00 · Dressing · Ionescu 934,50 + stoc 120,00", „stoc / general" etc. */
export function allocationText(s: SubWithAllocs): string {
  if (s.noProject) return 'stoc / general atelier';
  if (!s.allocations.length) return 'nu știu — decide Alesia';
  if (s.allocations.length === 1 && (s.allocations[0].amount == null || (s.amount && s.allocations[0].amount.equals(s.amount)))) {
    return projectName(s.allocations[0].project);
  }
  if (s.splitMode === 'ALESIA') return `${s.allocations.map((a) => projectName(a.project)).join(', ')} — împarte Alesia`;
  const parts = s.allocations.map((a) => `${projectName(a.project)} ${a.amount ? fmtMoney(a.amount.toNumber()) : '?'}`);
  const allocated = s.allocations.reduce((t, a) => t + (a.amount?.toNumber() ?? 0), 0);
  const rest = s.amount ? s.amount.toNumber() - allocated : 0;
  return parts.join(' · ') + (rest > 0.005 ? ` + stoc ${fmtMoney(rest)}` : '');
}

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

  await prisma.submission.update({
    where: { id: sub.id },
    data: fields
      ? {
          extracted: raw as Prisma.InputJsonValue, extractError: null, kind: fields.kind, counterparty: fields.counterparty, number: fields.number,
          issuedAt: fields.issuedAt, amount: fields.amount, vatPct: fields.vatPct, summary: fields.summary, projectId: fields.projectId,
          categoryId: fields.categoryId, paymentMethod: fields.paymentMethod, items: fields.items as Prisma.InputJsonValue,
          splitMode: fields.split ? 'PROPUS' : null, step: 'PROIECT',
          allocations: fields.split ? { create: fields.split.map((r) => ({ projectId: r.projectId, amount: r.amount })) } : undefined,
        }
      : { extractError, step: 'PROIECT' },
  });

  const updated = (await loadSub(sub.id))!;
  const intro = fields
    ? `Am citit:\n${describeReceipt(fieldsOf(updated))}`
    : `Nu am reușit să citesc ${sub.attachments.length ? 'documentul' : 'mesajul'}, dar îl trimit la validare așa cum e. Alesia completează datele.`;
  const proposal = updated.splitMode === 'PROPUS' ? `\n\nAm înțeles așa: ${allocationText(updated)}` : '';
  const messageId = await out.send(sub.chatId, `${intro}${proposal}\n\n${updated.splitMode === 'PROPUS' ? 'E corect? Sau alege altfel:' : 'Pe ce proiect?'}`, await projectKeyboard(updated, projects));
  await prisma.submission.update({ where: { id: sub.id }, data: { botMessageId: messageId } });
}

/** Tastatura pasului „pe ce proiect?" — un proiect dintr-un tap, sau bifat mai multe în modul MULTI. */
async function projectKeyboard(s: SubWithAllocs, projects?: { id: string; label: string }[]): Promise<Keyboard> {
  const list = projects ?? (await activeProjects());
  const multi = s.step === 'MULTI';
  const selected = multi ? s.allocations.map((a) => a.projectId) : [];
  const id = s.id;
  const rows: Keyboard = [];
  if (!multi && s.splitMode === 'PROPUS') rows.push([{ label: '✅ Da, așa', data: encodeAction({ kind: 'accept', submissionId: id }) }]);
  for (const p of projectChoices(list, s.projectId, selected, multi ? 8 : 5)) {
    const mark = p.selected ? '✅ ' : multi ? '◻️ ' : p.suggested ? '⭐ ' : '';
    rows.push([{ label: `${mark}${truncate(p.label, 40)}`, data: encodeAction({ kind: 'project', submissionId: id, projectId: p.id }) }]);
  }
  if (multi) {
    if (selected.length) rows.push([{ label: `➡️ Gata (${selected.length} ${selected.length === 1 ? 'proiect' : 'proiecte'})`, data: encodeAction({ kind: 'done', submissionId: id }) }]);
  } else {
    rows.push([{ label: '✂️ Împart pe mai multe proiecte', data: encodeAction({ kind: 'multi', submissionId: id }) }]);
    rows.push([
      { label: '📦 Stoc / general atelier', data: encodeAction({ kind: 'stock', submissionId: id }) },
      { label: '❓ Nu știu', data: encodeAction({ kind: 'unknown', submissionId: id }) },
    ]);
  }
  rows.push([{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: id }) }]);
  return rows;
}

const paymentKeyboard = (id: string): Keyboard => [
  [
    { label: '💵 Cash', data: encodeAction({ kind: 'payment', submissionId: id, method: 'CASH' }) },
    { label: '💳 Card firmă', data: encodeAction({ kind: 'payment', submissionId: id, method: 'CARD' }) },
  ],
  [{ label: '🧾 Neplătit / transfer', data: encodeAction({ kind: 'payment', submissionId: id, method: 'NEPLATIT' }) }],
  [{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: id }) }],
];

function paymentPrompt(s: SubWithAllocs) {
  const hint = s.paymentMethod ? `\n(pe document pare ${PAYMENT_METHOD_LABELS[s.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS].toLowerCase()})` : '';
  return `${describeReceipt(fieldsOf(s))}\nProiect: ${allocationText(s)}\n\nCum s-a plătit?${hint}`;
}

async function goToPayment(id: string, out: ChatOut) {
  const s = await prisma.submission.update({ where: { id }, data: { step: 'PLATA' }, include: withAllocs });
  if (s.botMessageId) await out.edit(s.chatId, s.botMessageId, paymentPrompt(s), paymentKeyboard(s.id));
}

/** Butoanele din bot. Doar cel care a trimis bonul le poate apăsa. Întoarce textul pentru „toast". */
export async function handleAction(action: BotAction, actorUserId: string, out: ChatOut): Promise<string> {
  const sub = await loadSub(action.submissionId);
  if (!sub || sub.senderId !== actorUserId) return 'Nu poți modifica trimiterea asta.';
  if (sub.status !== 'PRIMIT') return 'Trimiterea a fost deja procesată.';
  const msgId = sub.botMessageId;
  const edit = async (text: string, kb?: Keyboard) => { if (msgId) await out.edit(sub.chatId, msgId, text, kb); };
  const clearAllocs = prisma.submissionAllocation.deleteMany({ where: { submissionId: sub.id } });

  switch (action.kind) {
    case 'cancel':
      await prisma.submission.update({ where: { id: sub.id }, data: { status: 'ANULAT', step: 'GATA' } });
      await edit(`✖ Anulat.\n${describeReceipt(fieldsOf(sub))}`);
      return 'Anulat';

    case 'accept':
      await goToPayment(sub.id, out);
      return 'Împărțire salvată';

    case 'project': {
      if (sub.step === 'MULTI') {
        const has = sub.allocations.some((a) => a.projectId === action.projectId);
        await (has
          ? prisma.submissionAllocation.deleteMany({ where: { submissionId: sub.id, projectId: action.projectId } })
          : prisma.submissionAllocation.create({ data: { submissionId: sub.id, projectId: action.projectId } }));
        const s = (await loadSub(sub.id))!;
        await edit(`${describeReceipt(fieldsOf(s))}\n\nBifează proiectele, apoi apasă Gata:`, await projectKeyboard(s));
        return has ? 'Debifat' : 'Bifat';
      }
      await prisma.$transaction([
        clearAllocs,
        prisma.submission.update({
          where: { id: sub.id },
          data: { noProject: false, splitMode: null, allocations: { create: { projectId: action.projectId, amount: sub.amount } } },
        }),
      ]);
      await goToPayment(sub.id, out);
      return 'Proiect salvat';
    }

    case 'multi': {
      // pornim de la propunere / proiectul sugerat, fără sume
      const start = sub.allocations.length ? sub.allocations.map((a) => a.projectId) : sub.projectId ? [sub.projectId] : [];
      await prisma.$transaction([
        clearAllocs,
        prisma.submission.update({
          where: { id: sub.id },
          data: { step: 'MULTI', noProject: false, splitMode: null, allocations: { create: start.map((projectId) => ({ projectId })) } },
        }),
      ]);
      const s = (await loadSub(sub.id))!;
      await edit(`${describeReceipt(fieldsOf(s))}\n\nBifează proiectele, apoi apasă Gata:`, await projectKeyboard(s));
      return 'Alege proiectele';
    }

    case 'done': {
      if (sub.allocations.length === 0) return 'Bifează cel puțin un proiect.';
      if (sub.allocations.length === 1) {
        await prisma.submissionAllocation.updateMany({ where: { submissionId: sub.id }, data: { amount: sub.amount } });
        await goToPayment(sub.id, out);
        return 'Proiect salvat';
      }
      await prisma.submission.update({ where: { id: sub.id }, data: { step: 'IMPARTIRE' } });
      const kb: Keyboard = [
        ...(sub.amount ? [[{ label: '⚖️ Egal', data: encodeAction({ kind: 'split', submissionId: sub.id, mode: 'EGAL' }) }]] : []),
        [{ label: '✍️ Scriu sumele', data: encodeAction({ kind: 'split', submissionId: sub.id, mode: 'SUME' }) }],
        [{ label: '👩‍💼 Las-o pe Alesia', data: encodeAction({ kind: 'split', submissionId: sub.id, mode: 'ALESIA' }) }],
        [{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: sub.id }) }],
      ];
      await edit(`${describeReceipt(fieldsOf(sub))}\nProiecte: ${sub.allocations.map((a) => projectName(a.project)).join(', ')}\n\nCum împart suma?`, kb);
      return 'Cum împart?';
    }

    case 'split':
      return applySplitMode(sub, action.mode, out);

    case 'stock': {
      // ce e deja indirect rămâne (ex. Combustibil); o categorie de proiect (ex. Feronerie) devine „Stoc atelier"
      const current = sub.categoryId ? await prisma.costCategory.findUnique({ where: { id: sub.categoryId } }) : null;
      const stock = current?.scope === 'INDIRECT' ? current : await prisma.costCategory.findFirst({ where: { name: STOCK_CATEGORY, scope: 'INDIRECT' } });
      await prisma.$transaction([
        clearAllocs,
        prisma.submission.update({ where: { id: sub.id }, data: { noProject: true, splitMode: null, categoryId: stock?.id ?? sub.categoryId } }),
      ]);
      await goToPayment(sub.id, out);
      return 'Stoc / general';
    }

    case 'unknown':
      await prisma.$transaction([
        clearAllocs,
        prisma.submission.update({ where: { id: sub.id }, data: { noProject: false, splitMode: null } }),
      ]);
      await goToPayment(sub.id, out);
      return 'Decide Alesia';

    case 'payment': {
      const updated = await prisma.submission.update({
        where: { id: sub.id },
        data: { paymentMethod: action.method, status: 'DE_VALIDAT', step: 'GATA' },
        include: withAllocs,
      });
      await edit(`✅ Trimis la validare\n${describeReceipt(fieldsOf(updated))}\nProiect: ${allocationText(updated)} · Plată: ${PAYMENT_METHOD_LABELS[action.method]}`);
      return 'Trimis la validare';
    }
  }
}

async function applySplitMode(sub: SubWithAllocs, mode: SplitMode, out: ChatOut): Promise<string> {
  if (mode === 'EGAL') {
    if (!sub.amount) return 'Nu știu totalul — alege altă variantă.';
    const parts = splitEqual(sub.amount.toNumber(), sub.allocations.length);
    await prisma.$transaction([
      ...sub.allocations.map((a, i) => prisma.submissionAllocation.update({ where: { id: a.id }, data: { amount: parts[i] } })),
      prisma.submission.update({ where: { id: sub.id }, data: { splitMode: 'EGAL' } }),
    ]);
    await goToPayment(sub.id, out);
    return 'Împărțit egal';
  }
  if (mode === 'ALESIA') {
    await prisma.$transaction([
      prisma.submissionAllocation.updateMany({ where: { submissionId: sub.id }, data: { amount: null } }),
      prisma.submission.update({ where: { id: sub.id }, data: { splitMode: 'ALESIA' } }),
    ]);
    await goToPayment(sub.id, out);
    return 'Împarte Alesia';
  }
  await prisma.submission.update({ where: { id: sub.id }, data: { step: 'SUME', splitMode: 'SUME' } });
  const names = sub.allocations.map((a) => a.project.client?.name ?? a.project.name);
  const example = names.length >= 2 ? `${names[0]} 300, rest ${names[1]}` : `${names[0]} 300`;
  if (sub.botMessageId) {
    await out.edit(sub.chatId, sub.botMessageId,
      `${describeReceipt(fieldsOf(sub))}\n\nScrie-mi sumele într-un mesaj, ex.:\n${example}\n(poți pune și „stoc 120" pentru ce rămâne în atelier)`,
      [[{ label: '✖ Anulează', data: encodeAction({ kind: 'cancel', submissionId: sub.id }) }]]);
  }
  return 'Scrie sumele';
}

/** Dacă colegul are un bon care așteaptă sume scrise, mesajul lui text e pentru el, nu un bon nou. */
export async function findAwaitingAmounts(channel: Channel, chatId: string, senderId: string) {
  return prisma.submission.findFirst({
    where: { channel, chatId, senderId, status: 'PRIMIT', step: 'SUME', updatedAt: { gte: new Date(Date.now() - AWAIT_AMOUNTS_MS) } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });
}

export async function handleAmountsText(submissionId: string, text: string, out: ChatOut) {
  const sub = (await loadSub(submissionId))!;
  const projects = sub.allocations.map((a) => ({ id: a.projectId, label: projectName(a.project) }));
  const parsed = parseAmountsText(text, projects, sub.amount?.toNumber() ?? null);
  if (!parsed.ok) {
    await out.send(sub.chatId, `${parsed.error}\nÎncearcă din nou, ex.: ${projects[0]?.label.split(' · ').pop()} 300, rest …`);
    return;
  }
  await prisma.$transaction([
    prisma.submissionAllocation.deleteMany({ where: { submissionId: sub.id } }),
    prisma.submission.update({ where: { id: sub.id }, data: { step: 'PLATA', allocations: { create: parsed.rows.map((r) => ({ projectId: r.projectId, amount: r.amount })) } } }),
  ]);
  const s = (await loadSub(sub.id))!;
  // mesajul vechi cu butoane a rămas deasupra răspunsului; îl închidem și continuăm într-unul nou
  if (s.botMessageId) await out.edit(s.chatId, s.botMessageId, `${describeReceipt(fieldsOf(s))}\nProiect: ${allocationText(s)}`);
  const messageId = await out.send(s.chatId, paymentPrompt(s), paymentKeyboard(s.id));
  await prisma.submission.update({ where: { id: s.id }, data: { botMessageId: messageId } });
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

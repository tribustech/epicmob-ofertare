/**
 * Adaptorul Telegram: transformă un update de webhook în apeluri către nucleul din submissions.ts.
 * Rulează după ce webhook-ul a răspuns deja 200 (vezi app/api/telegram/route.ts).
 */
import { verifyLinkCode } from './link-code';
import { decodeAction } from './receipt';
import { addFile, findLinkedUser, handleAction, linkChat, openSubmission, readAndAskProject, type ChatOut } from './submissions';
import { answerCallback, downloadFile, editMessage, sendMessage } from './telegram-api';

interface TgUser { id: number; first_name?: string; last_name?: string; username?: string }
interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: { file_id: string; file_size?: number; width: number; height: number }[];
  document?: { file_id: string; mime_type?: string; file_name?: string; file_size?: number };
}
export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number } } };
}

const out: ChatOut = { send: sendMessage, edit: editMessage };

/** Cât așteaptă primul mesaj dintr-un album după restul pozelor, înainte de citire. */
const ALBUM_WAIT_MS = 2500;
const MAX_BYTES = 20 * 1024 * 1024;

const HELP = [
  'Trimite-mi poza bonului / facturii (sau PDF-ul). Mai multe pagini → trimite-le ca album.',
  'Scrie în descrierea pozei pentru ce e, ex. „feronerie Popescu, am dat cash".',
  'Plată cash fără bon? Scrie doar text: „250 lei motorină, montaj Popescu".',
  'Eu citesc datele, tu alegi proiectul și plata, apoi Alesia validează în aplicație.',
].join('\n');

const nameOf = (u?: TgUser) => (u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || null : null);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg?.from || msg.chat.type !== 'private') return;
  const chatId = String(msg.chat.id);
  const externalId = String(msg.from.id);

  const start = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(msg.text ?? '');
  if (start) {
    const userId = verifyLinkCode(start[1]);
    if (userId) {
      const user = await linkChat('TELEGRAM', externalId, chatId, nameOf(msg.from), userId);
      if (user) {
        await sendMessage(chatId, `Salut, ${user.name}! Contul e conectat.\n\n${HELP}`);
        return;
      }
    }
    const linked = await findLinkedUser('TELEGRAM', externalId);
    await sendMessage(chatId, linked ? HELP : NOT_LINKED);
    return;
  }

  const user = await findLinkedUser('TELEGRAM', externalId);
  if (!user) {
    await sendMessage(chatId, NOT_LINKED);
    return;
  }
  if (msg.text?.startsWith('/')) {
    await sendMessage(chatId, HELP);
    return;
  }

  const file = pickFile(msg);
  if (file === 'unsupported') {
    await sendMessage(chatId, 'Pot citi doar poze și PDF-uri.');
    return;
  }
  const text = (msg.caption ?? msg.text ?? '').trim() || null;
  if (!file && !text) return; // sticker, locație etc.
  if (file && file.size && file.size > MAX_BYTES) {
    await sendMessage(chatId, 'Fișierul e prea mare (max 20MB). Trimite o poză în loc de fișier.');
    return;
  }

  const { submission, created } = await openSubmission({ channel: 'TELEGRAM', chatId, senderId: user.id, text, mediaGroupId: msg.media_group_id ?? null });
  try {
    if (file) await addFile(submission.id, await downloadFile(file.fileId), file.mime);
  } catch (e) {
    console.error('[telegram] upload', e);
    await sendMessage(chatId, 'Nu am putut salva fișierul. Încearcă din nou peste un minut.');
    return;
  }
  if (!created) return; // restul albumului: citirea o face primul mesaj
  if (msg.media_group_id) await sleep(ALBUM_WAIT_MS);
  await readAndAskProject(submission.id, out);
}

const NOT_LINKED = 'Nu te cunosc încă. În aplicația EpicMob deschide Setări → „Conectează Telegram" și apasă link-ul de acolo.';

function pickFile(msg: TgMessage): { fileId: string; mime: string; size?: number } | 'unsupported' | null {
  if (msg.photo?.length) {
    const biggest = msg.photo[msg.photo.length - 1];
    return { fileId: biggest.file_id, mime: 'image/jpeg', size: biggest.file_size };
  }
  if (msg.document) {
    const mime = msg.document.mime_type ?? '';
    if (mime === 'application/pdf' || mime.startsWith('image/')) return { fileId: msg.document.file_id, mime, size: msg.document.file_size };
    return 'unsupported';
  }
  return null;
}

async function handleCallback(cq: NonNullable<TgUpdate['callback_query']>) {
  const action = decodeAction(cq.data);
  const user = await findLinkedUser('TELEGRAM', String(cq.from.id));
  if (!action || !user) {
    await answerCallback(cq.id, 'Buton expirat.');
    return;
  }
  const toast = await handleAction(action, user.id, out);
  await answerCallback(cq.id, toast);
}

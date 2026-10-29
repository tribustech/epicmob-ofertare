/** Apeluri minimale către Telegram Bot API (fără bibliotecă). Tokenul vine din TELEGRAM_BOT_TOKEN. */

export interface Button { label: string; data: string }
export type Keyboard = Button[][];

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN nu e setat.');
  return t;
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.status}`);
  return json.result as T;
}

const markup = (kb?: Keyboard) =>
  kb ? { reply_markup: { inline_keyboard: kb.map((row) => row.map((b) => ({ text: b.label, callback_data: b.data }))) } } : {};

export async function sendMessage(chatId: string, text: string, kb?: Keyboard): Promise<string> {
  const msg = await call<{ message_id: number }>('sendMessage', { chat_id: chatId, text, ...markup(kb) });
  return String(msg.message_id);
}

export async function editMessage(chatId: string, messageId: string, text: string, kb?: Keyboard): Promise<void> {
  try {
    await call('editMessageText', { chat_id: chatId, message_id: Number(messageId), text, ...markup(kb) });
  } catch (e) {
    // același text de două ori (dublu-click) nu e o eroare reală
    if (!(e instanceof Error && e.message.includes('message is not modified'))) throw e;
  }
}

export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await call('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

/** Descarcă un fișier trimis de user (limita Bot API: 20MB). */
export async function downloadFile(fileId: string): Promise<Uint8Array> {
  const f = await call<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!f.file_path) throw new Error('Telegram nu a dat calea fișierului.');
  const res = await fetch(`https://api.telegram.org/file/bot${token()}/${f.file_path}`);
  if (!res.ok) throw new Error(`Descărcarea fișierului a eșuat (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function setWebhook(url: string, secret: string): Promise<void> {
  await call('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: false });
}

export async function getMe(): Promise<{ username: string }> {
  return call('getMe', {});
}

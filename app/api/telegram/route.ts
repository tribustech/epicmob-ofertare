import { after, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { handleTelegramUpdate, type TgUpdate } from '@/lib/inbox/telegram-bot';

// citirea cu AI + upload-ul pot dura; răspundem imediat lui Telegram și lucrăm în `after`
export const maxDuration = 60;

function validSecret(header: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Webhook Telegram. Public (fără sesiune), protejat de secretul trimis de Telegram în header. */
export async function POST(req: Request) {
  if (!validSecret(req.headers.get('x-telegram-bot-api-secret-token'))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json()) as TgUpdate;
  after(async () => {
    try {
      await handleTelegramUpdate(update);
    } catch (e) {
      console.error('[telegram] update', update.update_id, e);
    }
  });
  return NextResponse.json({ ok: true });
}

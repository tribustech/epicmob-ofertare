/**
 * Înregistrează webhook-ul botului la Telegram — npm run bot:webhook -- https://ofertare.epicmob.ro
 * Rulează o singură dată (și la schimbarea domeniului). Cere TELEGRAM_BOT_TOKEN și TELEGRAM_WEBHOOK_SECRET.
 */
import { getMe, setWebhook } from '../lib/inbox/telegram-api';

async function main() {
  const base = process.argv[2]?.replace(/\/$/, '');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!base?.startsWith('https://') || !secret) {
    console.error('Utilizare: TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… npm run bot:webhook -- https://<domeniu>');
    process.exit(1);
  }
  await setWebhook(`${base}/api/telegram`, secret);
  const me = await getMe();
  console.log(`Webhook setat pe ${base}/api/telegram pentru @${me.username}. Pune TELEGRAM_BOT_USERNAME=${me.username}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });

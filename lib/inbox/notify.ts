/** Mesaj înapoi către colegul care a trimis bonul (după validare / respingere). Nu blochează aplicația dacă eșuează. */
import { sendMessage } from './telegram-api';

export async function notifySender(sub: { channel: string; chatId: string }, text: string): Promise<void> {
  try {
    if (sub.channel === 'TELEGRAM' && process.env.TELEGRAM_BOT_TOKEN) await sendMessage(sub.chatId, text);
    // WHATSAPP: adaptorul vine în pasul următor
  } catch (e) {
    console.error('[bot] notificare eșuată', e);
  }
}

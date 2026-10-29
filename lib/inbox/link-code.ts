/**
 * Codul cu care un coleg își leagă contul de chat de userul din aplicație: îl primește din Setări ca
 * link t.me/<bot>?start=<cod>. Codul e semnat (HMAC cu AUTH_SECRET) și expiră după 7 zile; încape în
 * cei 64 de caractere permiși de Telegram pentru parametrul /start.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_DAYS = 7;

function secret(): string {
  const s = process.env.AUTH_SECRET ?? '';
  if (s.length < 32) throw new Error('AUTH_SECRET lipsește sau e prea scurt.');
  return s;
}

const sign = (payload: string) => createHmac('sha256', secret()).update(`chat-link:${payload}`).digest('base64url').slice(0, 16);
const today = (now: Date) => Math.floor(now.getTime() / 86400000);

export function createLinkCode(userId: string, now = new Date()): string {
  const payload = `${userId}_${today(now).toString(36)}`;
  return `${payload}_${sign(payload)}`;
}

/** userId, sau null dacă e falsificat / expirat. */
export function verifyLinkCode(code: string | undefined | null, now = new Date()): string | null {
  if (!code) return null;
  const parts = code.trim().split('_');
  if (parts.length !== 3) return null;
  const [userId, day, mac] = parts;
  const expected = Buffer.from(sign(`${userId}_${day}`));
  const got = Buffer.from(mac);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const age = today(now) - parseInt(day, 36);
  if (!Number.isFinite(age) || age < 0 || age > TTL_DAYS) return null;
  return userId;
}

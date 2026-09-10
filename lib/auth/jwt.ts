/**
 * Sesiune = JWT HS256 semnat cu AUTH_SECRET, ținut într-un cookie httpOnly.
 * Doar `jose` (fără Node API), ca să meargă și în middleware (Edge).
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;
/** cookie-ul se re-emite dacă a trecut mai mult de atât de la emitere */
export const RENEW_AFTER_SEC = 24 * 60 * 60;

const MIN_SECRET_LENGTH = 32;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET lipsește sau e prea scurt (min. ${MIN_SECRET_LENGTH} caractere).`);
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  /** epoch seconds */
  issuedAt: number;
}

export async function signSession(userId: string, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + SESSION_MAX_AGE_SEC)
    .sign(getSecret());
}

/** null dacă tokenul lipsește, e expirat, are semnătură greșită sau nu are subiect */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.iat !== 'number') return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

export function shouldRenew(session: SessionPayload, nowSec = Math.floor(Date.now() / 1000)): boolean {
  return nowSec - session.issuedAt > RENEW_AFTER_SEC;
}

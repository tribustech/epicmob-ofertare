import { SESSION_MAX_AGE_SEC } from './jwt';

export const SESSION_COOKIE = 'epicmob_session';

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

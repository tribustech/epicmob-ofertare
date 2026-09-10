import { beforeAll, describe, expect, it, vi } from 'vitest';
import { safeNextPath } from '../next-path';

beforeAll(() => {
  vi.stubEnv('AUTH_SECRET', 'x'.repeat(40));
});

describe('jwt session', () => {
  it('sign + verify', async () => {
    const { signSession, verifySession } = await import('../jwt');
    const token = await signSession('user-1');
    const session = await verifySession(token);
    expect(session?.userId).toBe('user-1');
  });

  it('respinge token modificat, lipsă sau expirat', async () => {
    const { signSession, verifySession, SESSION_MAX_AGE_SEC } = await import('../jwt');
    const token = await signSession('user-1');
    expect(await verifySession(token.slice(0, -2) + 'zz')).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
    const old = await signSession('user-1', Math.floor(Date.now() / 1000) - SESSION_MAX_AGE_SEC - 60);
    expect(await verifySession(old)).toBeNull();
  });

  it('shouldRenew după o zi', async () => {
    const { shouldRenew, RENEW_AFTER_SEC } = await import('../jwt');
    const now = Math.floor(Date.now() / 1000);
    expect(shouldRenew({ userId: 'u', issuedAt: now - 60 }, now)).toBe(false);
    expect(shouldRenew({ userId: 'u', issuedAt: now - RENEW_AFTER_SEC - 1 }, now)).toBe(true);
  });

  it('secret prea scurt → eroare', async () => {
    vi.stubEnv('AUTH_SECRET', 'scurt');
    const { signSession } = await import('../jwt');
    await expect(signSession('u')).rejects.toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'x'.repeat(40));
  });
});

describe('safeNextPath', () => {
  it('doar căi interne', () => {
    expect(safeNextPath('/proiecte/abc?x=1')).toBe('/proiecte/abc?x=1');
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
  });
});

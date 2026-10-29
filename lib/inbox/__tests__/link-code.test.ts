import { beforeAll, describe, expect, it } from 'vitest';
import { createLinkCode, verifyLinkCode } from '../link-code';

beforeAll(() => { process.env.AUTH_SECRET = 'x'.repeat(40); });

describe('link-code', () => {
  const uid = 'clx9q2w3e4r5t6y7u8i9o0p1a';
  const now = new Date('2026-10-29T12:00:00Z');

  it('dus-întors și încape în parametrul /start (64, [A-Za-z0-9_-])', () => {
    const code = createLinkCode(uid, now);
    expect(code.length).toBeLessThanOrEqual(64);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyLinkCode(code, now)).toBe(uid);
  });

  it('expiră după 7 zile', () => {
    const code = createLinkCode(uid, now);
    expect(verifyLinkCode(code, new Date('2026-11-05T12:00:00Z'))).toBe(uid);
    expect(verifyLinkCode(code, new Date('2026-11-06T12:00:00Z'))).toBeNull();
  });

  it('respinge coduri modificate', () => {
    const code = createLinkCode(uid, now);
    const other = code.replace(uid, 'clx9q2w3e4r5t6y7u8i9o0p1b');
    expect(verifyLinkCode(other, now)).toBeNull();
    expect(verifyLinkCode('gunoi', now)).toBeNull();
    expect(verifyLinkCode(undefined, now)).toBeNull();
  });
});

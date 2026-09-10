import { describe, expect, it } from 'vitest';
import { hashPassword, normalizeEmail, verifyPassword } from '../password';

describe('password', () => {
  it('hash + verify', async () => {
    const hash = await hashPassword('parola123');
    expect(hash).not.toBe('parola123');
    expect(await verifyPassword('parola123', hash)).toBe(true);
    expect(await verifyPassword('parola124', hash)).toBe(false);
  });

  it('normalizeEmail: trim + lowercase', () => {
    expect(normalizeEmail('  Andrew@Test.RO ')).toBe('andrew@test.ro');
  });
});

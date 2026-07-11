import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { formAction } from '../form-action';

describe('formAction', () => {
  it('succes → obiect gol', async () => {
    const fn = formAction(async (_x: number) => {});
    expect(await fn(1)).toEqual({});
  });

  it('Error → { error: mesaj }', async () => {
    const fn = formAction(async () => { throw new Error('Ceva n-a mers'); });
    expect(await fn()).toEqual({ error: 'Ceva n-a mers' });
  });

  it('ZodError → mesaje unite', async () => {
    const fn = formAction(async () => {
      z.object({ name: z.string().min(1, 'Numele lipsește') }).parse({ name: '' });
    });
    const r = await fn();
    expect(r.error).toContain('Numele lipsește');
  });

  it('NEXT_REDIRECT se propagă (nu e prins)', async () => {
    const redirectErr = Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT;push;/x;307;' });
    const fn = formAction(async () => { throw redirectErr; });
    await expect(fn()).rejects.toBe(redirectErr);
  });
});

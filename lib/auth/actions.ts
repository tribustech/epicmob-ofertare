'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { SESSION_COOKIE, sessionCookieOptions } from './cookie';
import { signSession } from './jwt';
import { safeNextPath } from './next-path';
import { normalizeEmail, verifyPassword } from './password';

const LOGIN_ERROR = 'Email sau parolă greșită.';
/** întârziere fixă la eșec — descurajează ghicirea, fără blocare de cont */
const FAIL_DELAY_MS = 500;

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

async function fail(): Promise<never> {
  await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
  throw new Error(LOGIN_ERROR);
}

export const login = formAction(async (fd: FormData) => {
  const parsed = loginSchema.safeParse({
    email: fd.get('email'), password: fd.get('password'), next: fd.get('next') ?? undefined,
  });
  if (!parsed.success) return fail();

  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(parsed.data.email) } });
  if (!user || !user.active) return fail();
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return fail();

  const token = await signSession(user.id);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  redirect(safeNextPath(parsed.data.next));
});

export const logout = formAction(async () => {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
});

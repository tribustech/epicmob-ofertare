'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { requireUser } from './current-user';
import { hashPassword, MIN_PASSWORD_LENGTH, normalizeEmail } from './password';
import { deactivateError } from './user-rules';

const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere`);

const newUserSchema = z.object({
  name: z.string().trim().min(1, 'Numele lipsește'),
  email: z.string().trim().email('Email invalid'),
  password: passwordSchema,
});

export const createUser = formAction(async (fd: FormData) => {
  await requireUser();
  const d = newUserSchema.parse({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
  const email = normalizeEmail(d.email);
  if (await prisma.user.findUnique({ where: { email } })) throw new Error(`Există deja un utilizator cu emailul ${email}.`);
  await prisma.user.create({ data: { name: d.name, email, passwordHash: await hashPassword(d.password) } });
  revalidatePath('/setari');
});

export const setUserActive = formAction(async (id: string, active: boolean) => {
  const me = await requireUser();
  const target = await prisma.user.findUniqueOrThrow({ where: { id }, select: { active: true } });
  if (!active) {
    const activeCount = await prisma.user.count({ where: { active: true } });
    const err = deactivateError({ targetId: id, currentUserId: me.id, activeCount, targetActive: target.active });
    if (err) throw new Error(err);
  }
  await prisma.user.update({ where: { id }, data: { active } });
  revalidatePath('/setari');
});

export const resetUserPassword = formAction(async (id: string, fd: FormData) => {
  await requireUser();
  const password = passwordSchema.parse(fd.get('password'));
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
  revalidatePath('/setari');
});

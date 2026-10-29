'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { requireUser } from '@/lib/auth/current-user';

/** Deconectează un cont de chat (doar pe al tău). */
export const unlinkChat = formAction(async (id: string) => {
  const me = await requireUser();
  await prisma.chatLink.deleteMany({ where: { id, userId: me.id } });
  revalidatePath('/setari');
});

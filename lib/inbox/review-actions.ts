'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { formAction } from '@/lib/forms/form-action';
import { requireUser } from '@/lib/auth/current-user';
import { fmtLei } from '@/lib/format';
import { insertExpense } from '@/lib/finance/expense-write';
import { notifySender } from './notify';

function revalidateInbox(projectIds: string[] = [], accountIds: string[] = []) {
  revalidatePath('/finante/de-validat');
  revalidatePath('/finante/cheltuieli');
  revalidatePath('/finante');
  revalidatePath('/');
  for (const id of projectIds) revalidatePath(`/proiecte/${id}`);
  for (const id of accountIds) revalidatePath(`/finante/conturi/${id}`);
}

/** Validarea unui bon din bot: devine cheltuială (același cod ca „Adaugă cheltuială"), cu pozele atașate. */
export const approveSubmission = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id } });
  if (sub.status !== 'DE_VALIDAT') throw new Error('Bonul a fost deja procesat.');

  const { doc, projectIds, accountIds } = await insertExpense(fd, me.id, async (tx, documentId) => {
    // condiția pe status oprește dubla validare (două taburi / doi colegi în același timp)
    const done = await tx.submission.updateMany({
      where: { id, status: 'DE_VALIDAT' },
      data: { status: 'APROBAT', documentId, reviewedById: me.id, reviewedAt: new Date() },
    });
    if (done.count !== 1) throw new Error('Bonul a fost deja procesat.');
    await tx.attachment.updateMany({ where: { submissionId: id }, data: { documentId } });
  });

  await notifySender(sub, `✅ ${me.name} a validat: ${doc.counterparty} · ${fmtLei(doc.amount.toNumber())}`);
  revalidateInbox(projectIds, accountIds);
  redirect('/finante/de-validat');
});

export const rejectSubmission = formAction(async (id: string, fd: FormData) => {
  const me = await requireUser();
  const reason = String(fd.get('reason') ?? '').trim();
  if (!reason) throw new Error('Scrie motivul, ca să-l vadă colegul.');
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id } });
  const done = await prisma.submission.updateMany({
    where: { id, status: 'DE_VALIDAT' },
    data: { status: 'RESPINS', rejectReason: reason, reviewedById: me.id, reviewedAt: new Date() },
  });
  if (done.count !== 1) throw new Error('Bonul a fost deja procesat.');
  const what = [sub.counterparty, sub.amount && fmtLei(sub.amount.toNumber())].filter(Boolean).join(' · ') || 'documentul trimis';
  await notifySender(sub, `↩️ ${me.name} a respins ${what}: ${reason}`);
  revalidateInbox();
  redirect('/finante/de-validat');
});

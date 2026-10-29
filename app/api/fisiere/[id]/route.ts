import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/current-user';
import { presignedUrl } from '@/lib/storage/s3';

/** Deschide un atașament (poză bon/factură): redirect la un URL presemnat, valabil 5 minute. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'neautentificat' }, { status: 401 });
  const { id } = await params;
  const att = await prisma.attachment.findUnique({ where: { id }, select: { key: true } });
  if (!att) return NextResponse.json({ error: 'nu există' }, { status: 404 });
  return NextResponse.redirect(await presignedUrl(att.key));
}

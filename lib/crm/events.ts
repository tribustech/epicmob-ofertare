import { prisma } from '@/lib/db';

/** Intrare automată în timeline, semnată de utilizatorul logat (null la migrări/scripturi). */
export async function logEvent(args: {
  type: string;
  clientId?: string | null;
  projectId?: string | null;
  userId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await prisma.event.create({
    data: {
      type: args.type,
      clientId: args.clientId ?? null,
      projectId: args.projectId ?? null,
      userId: args.userId ?? null,
      payloadJson: JSON.stringify(args.payload ?? {}),
    },
  });
}

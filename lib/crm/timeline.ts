import { prisma } from '@/lib/db';
import { eventText, parsePayload } from './event-text';

export type TimelineEntry =
  | { kind: 'note'; id: string; at: Date; user: string | null; body: string; pinned: boolean; source: { label: string; href?: string } | null }
  | { kind: 'event'; id: string; at: Date; user: string | null; label: string; detail: string | null; source: { label: string; href?: string } | null };

export type TimelineFilter = 'tot' | 'notite' | 'evenimente';

const noteInclude = { createdBy: { select: { name: true } }, project: { select: { id: true, name: true } } } as const;
const eventInclude = { user: { select: { name: true } }, project: { select: { id: true, name: true } } } as const;

/**
 * Fluxul unui client: notițele + evenimentele lui și ale tuturor proiectelor lui (cu eticheta proiectului).
 * Fluxul unui proiect: notițele + evenimentele proiectului și notițele clientului (cu eticheta „client").
 */
export async function loadTimeline(target: { clientId: string } | { projectId: string }): Promise<TimelineEntry[]> {
  const isClient = 'clientId' in target;
  let notes; let events;
  if (isClient) {
    [notes, events] = await Promise.all([
      prisma.note.findMany({ where: { OR: [{ clientId: target.clientId }, { project: { clientId: target.clientId } }] }, include: noteInclude, orderBy: { createdAt: 'desc' }, take: 300 }),
      prisma.event.findMany({ where: { OR: [{ clientId: target.clientId }, { project: { clientId: target.clientId } }] }, include: eventInclude, orderBy: { createdAt: 'desc' }, take: 300 }),
    ]);
  } else {
    const project = await prisma.project.findUnique({ where: { id: target.projectId }, select: { clientId: true } });
    [notes, events] = await Promise.all([
      prisma.note.findMany({
        where: { OR: [{ projectId: target.projectId }, ...(project?.clientId ? [{ clientId: project.clientId }] : [])] },
        include: noteInclude, orderBy: { createdAt: 'desc' }, take: 300,
      }),
      prisma.event.findMany({ where: { projectId: target.projectId }, include: eventInclude, orderBy: { createdAt: 'desc' }, take: 300 }),
    ]);
  }

  const source = (e: { project: { id: string; name: string } | null; clientId?: string | null }): TimelineEntry['source'] => {
    if (isClient) return e.project ? { label: e.project.name, href: `/proiecte/${e.project.id}` } : null;
    return e.project ? null : { label: 'client' };
  };

  const entries: TimelineEntry[] = [
    ...notes.map((n): TimelineEntry => ({ kind: 'note', id: n.id, at: n.createdAt, user: n.createdBy?.name ?? null, body: n.body, pinned: n.pinned, source: source(n) })),
    ...events.map((e): TimelineEntry => {
      const t = eventText(e.type, parsePayload(e.payloadJson));
      // evenimentele clientului (stage, next action) nu au proiect; pe pagina proiectului nu apar oricum
      return { kind: 'event', id: e.id, at: e.createdAt, user: e.user?.name ?? null, label: t.label, detail: t.detail, source: isClient ? source(e) : null };
    }),
  ];
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Notițele importante (pinuite) vizibile pe o pagină: pe client — ale lui și ale proiectelor; pe proiect — ale lui și ale clientului. */
export async function loadPinnedNotes(target: { clientId: string } | { projectId: string }) {
  const where = 'clientId' in target
    ? { pinned: true, OR: [{ clientId: target.clientId }, { project: { clientId: target.clientId } }] }
    : { pinned: true, OR: [{ projectId: target.projectId }, { client: { projects: { some: { id: target.projectId } } } }] };
  const notes = await prisma.note.findMany({ where, include: noteInclude, orderBy: { createdAt: 'desc' } });
  return notes.map((n) => ({
    id: n.id, body: n.body, at: n.createdAt, user: n.createdBy?.name ?? null,
    source: 'clientId' in target ? (n.project ? n.project.name : null) : (n.project ? null : 'client'),
  }));
}

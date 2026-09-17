import { prisma } from '@/lib/db';
import { PROJECT_TAB_STATUSES } from '@/lib/crm/project-queries';
import { monthKey, shiftMonth } from './month';
import { round2 } from './money';
import { loadProjectsMoney } from './project-money';

/**
 * Încasări: de unde au venit banii și ce mai e de încasat, plasat în timp.
 * Regula (stabilită cu Andrew, 14.09.2026): rest de încasat = preț contract − tot ce s-a încasat (avans + rate + final).
 * Data așteptată = deadline-ul promis al proiectului; proiect montat sau deadline trecut → întârziat.
 */

export const RECEIVABLE_BUCKETS = ['INTARZIAT', 'LUNA_ASTA', 'LUNA_VIITOARE', 'MAI_TARZIU', 'FARA_DATA'] as const;
export type ReceivableBucket = (typeof RECEIVABLE_BUCKETS)[number];
export const RECEIVABLE_BUCKET_LABELS: Record<ReceivableBucket, string> = {
  INTARZIAT: 'Întârziate', LUNA_ASTA: 'Luna asta', LUNA_VIITOARE: 'Luna viitoare', MAI_TARZIU: 'Mai târziu', FARA_DATA: 'Fără dată',
};

/** Tipul încasării e text liber („Avans", „AVANS", „Rată 2", „Blat + Contrablat") → avans | rate | final | altele. */
export function receiptKind(incomeType: string | null | undefined): 'advance' | 'installments' | 'final' | 'other' {
  const t = (incomeType ?? '').toLowerCase();
  if (t.startsWith('avans')) return 'advance';
  if (t.startsWith('rat')) return 'installments';
  if (t.startsWith('final')) return 'final';
  return 'other';
}

/** Sumele încasate pe tipuri, dintr-o listă de încasări. */
export function splitReceipts(receipts: { amount: number; incomeType: string | null }[]) {
  const out = { advance: 0, installments: 0, final: 0, other: 0 };
  for (const r of receipts) out[receiptKind(r.incomeType)] += r.amount;
  return { advance: round2(out.advance), installments: round2(out.installments), final: round2(out.final), other: round2(out.other) };
}

/** „așteptat până la 20.09.2026 · luna asta" / „întârziat" / „fără deadline" — textul de sub cardul „De încasat" al proiectului. */
export function expectedText(p: { status: string; deadlineAt: Date | null }, fmt: (d: Date) => string, now = new Date()): { text: string; late: boolean } {
  const b = bucketOf(p, now);
  if (b === 'INTARZIAT') return { text: p.status === 'MONTAT' ? 'întârziat · proiect montat' : `întârziat · deadline ${p.deadlineAt ? fmt(p.deadlineAt) : ''}`, late: true };
  if (b === 'FARA_DATA') return { text: 'fără deadline · dată necunoscută', late: false };
  return { text: `așteptat până la ${fmt(p.deadlineAt!)} · ${RECEIVABLE_BUCKET_LABELS[b].toLowerCase()}`, late: false };
}

export interface ReceivableRow {
  id: string; name: string; client: { id: string; name: string } | null; status: string; deadlineAt: Date | null;
  contract: number; received: number; advance: number; installments: number; final: number; remaining: number;
}

/** În ce grupă de timp cade restul de încasat al unui proiect. */
export function bucketOf(p: { status: string; deadlineAt: Date | null }, now = new Date()): ReceivableBucket {
  if (p.status === 'MONTAT' || p.status === 'INCHIS') return 'INTARZIAT';
  if (!p.deadlineAt) return 'FARA_DATA';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (p.deadlineAt.getTime() < today.getTime()) return 'INTARZIAT';
  const k = monthKey(p.deadlineAt);
  if (k === monthKey(now)) return 'LUNA_ASTA';
  if (k === shiftMonth(monthKey(now), 1)) return 'LUNA_VIITOARE';
  return 'MAI_TARZIU';
}

export interface ReceivableGroup { key: ReceivableBucket; label: string; total: number; rows: ReceivableRow[] }

/** Grupează proiectele cu rest > 0 pe buckete de timp; grupele goale sunt omise. */
export function groupReceivables(rows: ReceivableRow[], now = new Date()): { groups: ReceivableGroup[]; total: number } {
  const open = rows.filter((r) => r.remaining > 0.005);
  const groups = RECEIVABLE_BUCKETS.map((key) => {
    const inBucket = open.filter((r) => bucketOf(r, now) === key).sort((a, b) => (a.deadlineAt?.getTime() ?? Infinity) - (b.deadlineAt?.getTime() ?? Infinity));
    return { key, label: RECEIVABLE_BUCKET_LABELS[key], total: round2(inBucket.reduce((s, r) => s + r.remaining, 0)), rows: inBucket };
  }).filter((g) => g.rows.length > 0);
  return { groups, total: round2(open.reduce((s, r) => s + r.remaining, 0)) };
}

const dec = (d: { toNumber(): number } | null | undefined) => (d ? d.toNumber() : 0);

/** Proiectele active + montate: contract, încasat (pe tipuri), rest; plus lista încasărilor. */
export async function loadReceivables() {
  const projects = await prisma.project.findMany({
    where: { status: { in: PROJECT_TAB_STATUSES.active.concat('MONTAT') }, deletedAt: null },
    select: { id: true, name: true, status: true, deadlineAt: true, client: { select: { id: true, name: true } } },
  });
  const ids = projects.map((p) => p.id);
  const [money, receipts] = await Promise.all([
    loadProjectsMoney(ids),
    prisma.movement.findMany({
      where: { projectId: { in: ids }, type: 'IN' },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, date: true, amount: true, incomeType: true, note: true, projectId: true, account: { select: { id: true, name: true } } },
    }),
  ]);
  const rows: ReceivableRow[] = projects.map((p) => {
    const m = money.get(p.id)!;
    const t = splitReceipts(receipts.filter((r) => r.projectId === p.id).map((r) => ({ amount: dec(r.amount), incomeType: r.incomeType })));
    return {
      id: p.id, name: p.name, client: p.client, status: p.status, deadlineAt: p.deadlineAt,
      contract: m.contract, received: m.received, advance: t.advance, installments: t.installments, final: t.final,
      remaining: m.receivable,
    };
  });
  const byProject = new Map(rows.map((r) => [r.id, r]));
  return {
    rows,
    receipts: receipts.map((m) => ({
      id: m.id, date: m.date, amount: dec(m.amount), incomeType: m.incomeType, note: m.note, account: m.account,
      project: byProject.get(m.projectId!) ?? null,
    })),
    ...groupReceivables(rows),
  };
}

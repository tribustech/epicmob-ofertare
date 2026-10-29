/**
 * Bot cheltuieli — partea pură (fără DB/rețea): ce întoarce AI-ul după ce citește bonul, cum îl
 * normalizăm și cum arată mesajele/butoanele. Folosită de adaptorul Telegram (și, mai târziu, WhatsApp).
 */
import { z } from 'zod';
import { parseMoneyInput, round2 } from '@/lib/finance/money';

const nullableStr = z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().nullable().optional());
const nullableNum = z.preprocess((v) => {
  if (v == null || v === '') return null;
  const n = parseMoneyInput(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable().optional());

/** Răspunsul brut al AI-ului (tolerant: câmpurile lipsă devin null). */
export const receiptSchema = z.object({
  kind: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['FACTURA', 'BON', 'CHITANTA', 'ALTUL']).catch('ALTUL')).default('ALTUL'),
  counterparty: nullableStr,
  counterpartyCui: nullableStr,
  number: nullableStr,
  issuedAt: nullableStr, // YYYY-MM-DD
  total: nullableNum,
  currency: nullableStr,
  vatPct: nullableNum,
  paymentHint: z.preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['CASH', 'CARD', 'TRANSFER', 'NECUNOSCUT']).catch('NECUNOSCUT')).default('NECUNOSCUT'),
  summary: nullableStr,
  projectId: nullableStr,
  categoryName: nullableStr,
  notes: nullableStr,
});
export type Receipt = z.infer<typeof receiptSchema>;

export interface ReceiptFields {
  kind: 'FACTURA' | 'BON' | 'CHITANTA' | 'ALTUL';
  counterparty: string | null;
  number: string | null;
  issuedAt: Date | null;
  amount: number | null;
  vatPct: number | null;
  summary: string | null;
  projectId: string | null;
  categoryId: string | null;
  paymentMethod: 'CASH' | 'CARD' | 'NEPLATIT' | null;
}

/** „2026-10-14" sau „14.10.2026" → Date (la prânz UTC, ca să nu sară ziua). Datele absurde → null. */
export function parseReceiptDate(raw: string | null | undefined, now = new Date()): Date | null {
  if (!raw) return null;
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw.trim());
  const ro = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(raw.trim());
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (ro) [d, m, y] = [Number(ro[1]), Number(ro[2]), Number(ro[3].length === 2 ? `20${ro[3]}` : ro[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  // bonurile nu vin din viitor și nici de acum 3 ani — probabil citire greșită
  if (date.getTime() > now.getTime() + 2 * 86400000 || date.getTime() < now.getTime() - 2 * 365 * 86400000) return null;
  return date;
}

/** Leagă răspunsul AI-ului de datele din aplicație (proiecte/categorii existente). */
export function normalizeReceipt(
  r: Receipt,
  ctx: { projectIds: string[]; categories: { id: string; name: string; scope: string }[]; now?: Date },
): ReceiptFields {
  const projectId = r.projectId && ctx.projectIds.includes(r.projectId) ? r.projectId : null;
  const wantScope = projectId ? 'DIRECT' : null;
  const byName = (name: string) => ctx.categories.filter((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const matches = r.categoryName ? byName(r.categoryName) : [];
  const category = matches.find((c) => !wantScope || c.scope === wantScope) ?? matches[0] ?? null;
  const amount = r.total != null && r.total > 0 ? round2(r.total) : null;
  const vatPct = r.vatPct != null && r.vatPct >= 0 && r.vatPct <= 30 ? r.vatPct : null;
  return {
    kind: r.kind,
    counterparty: r.counterparty ?? null,
    number: r.number ?? null,
    issuedAt: parseReceiptDate(r.issuedAt, ctx.now),
    amount,
    vatPct,
    summary: r.summary ?? null,
    projectId,
    categoryId: category?.id ?? null,
    paymentMethod: r.paymentHint === 'CASH' ? 'CASH' : r.paymentHint === 'CARD' ? 'CARD' : null,
  };
}

// ───────────── butoane ─────────────

/**
 * callback_data Telegram are max 64 octeți: „<acțiune>|<submissionId>|<valoare>".
 * Acțiuni: p = proiect (id / „-" = firmă / „?" = nu știu), m = plată, x = anulează.
 */
export type BotAction =
  | { kind: 'project'; submissionId: string; projectId: string | null; noProject: boolean }
  | { kind: 'payment'; submissionId: string; method: 'CASH' | 'CARD' | 'NEPLATIT' }
  | { kind: 'cancel'; submissionId: string };

export function encodeAction(a: BotAction): string {
  if (a.kind === 'project') return `p|${a.submissionId}|${a.noProject ? '-' : a.projectId ?? '?'}`;
  if (a.kind === 'payment') return `m|${a.submissionId}|${a.method}`;
  return `x|${a.submissionId}`;
}

export function decodeAction(data: string | undefined | null): BotAction | null {
  if (!data) return null;
  const [k, id, v] = data.split('|');
  if (!id) return null;
  if (k === 'p' && v) return { kind: 'project', submissionId: id, projectId: v === '-' || v === '?' ? null : v, noProject: v === '-' };
  if (k === 'm' && (v === 'CASH' || v === 'CARD' || v === 'NEPLATIT')) return { kind: 'payment', submissionId: id, method: v };
  if (k === 'x') return { kind: 'cancel', submissionId: id };
  return null;
}

export const PAYMENT_METHOD_LABELS = { CASH: 'Cash', CARD: 'Card firmă', NEPLATIT: 'Neplătit / transfer' } as const;

/** Proiectul sugerat primul, apoi celelalte active, max `limit`. */
export function projectChoices(projects: { id: string; label: string }[], suggestedId: string | null, limit = 6) {
  const suggested = projects.find((p) => p.id === suggestedId);
  const rest = projects.filter((p) => p.id !== suggestedId);
  return (suggested ? [suggested, ...rest] : rest).slice(0, limit).map((p) => ({ ...p, suggested: p.id === suggestedId }));
}

const fmtMoney = (n: number) => new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDay = (d: Date) => new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(d);
const KIND = { FACTURA: 'Factură', BON: 'Bon', CHITANTA: 'Chitanță', ALTUL: 'Document' } as const;

/** Rezumatul afișat colegului după citire: „Bon · Dedeman · 14.10.2026 · 1.234,50 lei". */
export function describeReceipt(f: Pick<ReceiptFields, 'kind' | 'counterparty' | 'issuedAt' | 'amount' | 'number' | 'summary'>): string {
  const head = [KIND[f.kind], f.counterparty ?? 'furnizor necitit', f.issuedAt ? fmtDay(f.issuedAt) : null, f.amount != null ? `${fmtMoney(f.amount)} lei` : 'sumă necitită']
    .filter(Boolean).join(' · ');
  const lines = [head];
  if (f.number) lines.push(`Nr. ${f.number}`);
  if (f.summary) lines.push(f.summary);
  return lines.join('\n');
}

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
  // produsele de pe bon (pentru împărțire și pentru Alesia)
  items: z.array(z.object({ name: z.string(), total: nullableNum })).catch([]).default([]),
  // împărțirea cerută de coleg în text („balamale stoc, restul Popescu"); project = id sau „STOC"
  split: z.array(z.object({ project: z.string(), amount: nullableNum })).catch([]).default([]),
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
  items: { name: string; total: number | null }[];
  /** împărțirea propusă din textul colegului; restul până la total = stoc / general */
  split: SplitRow[] | null;
}

export interface SplitRow { projectId: string; amount: number | null }

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
    items: r.items.filter((i) => i.name.trim()).slice(0, 50).map((i) => ({ name: i.name.trim(), total: i.total ?? null })),
    split: normalizeSplit(r.split, ctx.projectIds, amount),
  };
}

/**
 * Împărțirea propusă de AI e folosită doar dacă e coerentă: proiecte existente, fără dubluri, sume
 * pozitive care nu depășesc totalul. Un singur proiect fără sumă = „tot pe proiectul ăsta".
 * Doar „STOC" (fără proiecte) nu e împărțire — e butonul de stoc.
 */
export function normalizeSplit(split: Receipt['split'], projectIds: string[], total: number | null): SplitRow[] | null {
  if (!split.length) return null;
  const rows: SplitRow[] = [];
  let stock = 0;
  for (const r of split) {
    if (r.project.toUpperCase() === 'STOC') { stock += r.amount ?? 0; continue; }
    if (!projectIds.includes(r.project) || rows.some((x) => x.projectId === r.project)) return null;
    if (r.amount != null && r.amount <= 0) return null;
    rows.push({ projectId: r.project, amount: r.amount != null ? round2(r.amount) : null });
  }
  if (!rows.length) return null;
  const missing = rows.filter((r) => r.amount == null);
  if (total != null) {
    const known = rows.reduce((t, r) => t + (r.amount ?? 0), 0);
    if (known + stock > total + 0.01) return null;
    // un singur rând fără sumă primește restul (după partea de stoc)
    if (missing.length === 1) missing[0].amount = round2(total - stock - known);
    if (missing.length === 1 && (missing[0].amount ?? 0) <= 0) return null;
  }
  return rows;
}

// ───────────── butoane ─────────────

export type SplitMode = 'EGAL' | 'SUME' | 'ALESIA';

/**
 * callback_data Telegram are max 64 octeți: „<acțiune>|<submissionId>|<valoare>".
 * p = apasă pe un proiect (alege-l / bifează-l în modul „mai multe"), k = trec la mai multe proiecte,
 * s = stoc / general, u = nu știu, d = gata cu bifatul, a = acceptă împărțirea propusă,
 * e = cum împart, m = plată, x = anulează.
 */
export type BotAction =
  | { kind: 'project'; submissionId: string; projectId: string }
  | { kind: 'multi'; submissionId: string }
  | { kind: 'stock'; submissionId: string }
  | { kind: 'unknown'; submissionId: string }
  | { kind: 'done'; submissionId: string }
  | { kind: 'accept'; submissionId: string }
  | { kind: 'split'; submissionId: string; mode: SplitMode }
  | { kind: 'payment'; submissionId: string; method: 'CASH' | 'CARD' | 'NEPLATIT' }
  | { kind: 'cancel'; submissionId: string };

const CODES = { project: 'p', multi: 'k', stock: 's', unknown: 'u', done: 'd', accept: 'a', split: 'e', payment: 'm', cancel: 'x' } as const;

export function encodeAction(a: BotAction): string {
  const value = a.kind === 'project' ? a.projectId : a.kind === 'split' ? a.mode : a.kind === 'payment' ? a.method : '';
  return [CODES[a.kind], a.submissionId, value].filter(Boolean).join('|');
}

export function decodeAction(data: string | undefined | null): BotAction | null {
  if (!data) return null;
  const [k, submissionId, v] = data.split('|');
  if (!submissionId) return null;
  switch (k) {
    case 'p': return v ? { kind: 'project', submissionId, projectId: v } : null;
    case 'k': return { kind: 'multi', submissionId };
    case 's': return { kind: 'stock', submissionId };
    case 'u': return { kind: 'unknown', submissionId };
    case 'd': return { kind: 'done', submissionId };
    case 'a': return { kind: 'accept', submissionId };
    case 'e': return v === 'EGAL' || v === 'SUME' || v === 'ALESIA' ? { kind: 'split', submissionId, mode: v } : null;
    case 'm': return v === 'CASH' || v === 'CARD' || v === 'NEPLATIT' ? { kind: 'payment', submissionId, method: v } : null;
    case 'x': return { kind: 'cancel', submissionId };
    default: return null;
  }
}

/**
 * Sumele scrise de coleg după „Scriu sumele": „Popescu 300, rest Ionescu", „300 popescu; 934,50 ionescu",
 * „stoc 120, rest Popescu". Fiecare bucată (despărțită prin virgulă / „;" / rând nou) are o sumă sau
 * „rest" și un cuvânt din numele proiectului. „stoc" = partea care rămâne nealocată.
 */
export function parseAmountsText(
  text: string,
  projects: { id: string; label: string }[],
  total: number | null,
): { ok: true; rows: SplitRow[] } | { ok: false; error: string } {
  const parts = text.split(/[;\n]|,(?!\d{1,2}\b)/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, error: 'Nu am găsit nicio sumă.' };
  const words = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const amounts = new Map<string, number | 'REST'>();
  let stock = 0;
  for (const part of parts) {
    const m = /(\d[\d.\s]*(?:,\d{1,2})?|\d+\.\d{1,2})/.exec(part);
    const isRest = /\brest(ul)?\b/i.test(part);
    if (!m && !isRest) return { ok: false, error: `Lipsește suma la „${part}".` };
    const amount = m ? parseMoneyInput(m[1]) : NaN;
    const name = words(part.replace(m?.[1] ?? '', ' ')).filter((w) => !['rest', 'restul', 'lei', 'ron', 'pentru', 'pe'].includes(w));
    if (name.includes('stoc') || name.includes('general') || name.includes('atelier')) {
      if (isRest || !Number.isFinite(amount)) return { ok: false, error: 'Pentru stoc scrie o sumă, ex. „stoc 120".' };
      stock += amount;
      continue;
    }
    const matches = projects.filter((p) => name.some((w) => words(p.label).includes(w)));
    if (matches.length !== 1) return { ok: false, error: matches.length ? `„${part}" se potrivește cu mai multe proiecte.` : `Nu știu ce proiect e „${part}".` };
    if (amounts.has(matches[0].id)) return { ok: false, error: `Proiectul „${matches[0].label}" apare de două ori.` };
    amounts.set(matches[0].id, isRest ? 'REST' : amount);
  }
  const rests = [...amounts.values()].filter((v) => v === 'REST').length;
  if (rests > 1) return { ok: false, error: 'Doar un proiect poate primi „restul".' };
  const known = [...amounts.values()].reduce<number>((t, v) => t + (v === 'REST' ? 0 : v), 0) + stock;
  if (rests === 1 && total == null) return { ok: false, error: 'Nu știu totalul bonului, deci scrie toate sumele.' };
  if (total != null && known > total + 0.01) return { ok: false, error: `Sumele (${known.toFixed(2)}) depășesc totalul bonului (${total.toFixed(2)}).` };
  const rows = [...amounts.entries()].map(([projectId, v]) => ({ projectId, amount: round2(v === 'REST' ? (total as number) - known : v) }));
  if (rows.some((r) => r.amount <= 0)) return { ok: false, error: 'Restul iese zero sau negativ.' };
  return { ok: true, rows };
}

export const PAYMENT_METHOD_LABELS = { CASH: 'Cash', CARD: 'Card firmă', NEPLATIT: 'Neplătit / transfer' } as const;

/** Proiectele bifate și cel sugerat primele, apoi celelalte active, max `limit` (bifatele apar mereu). */
export function projectChoices(projects: { id: string; label: string }[], suggestedId: string | null, selected: string[] = [], limit = 6) {
  const rank = (p: { id: string }) => (selected.includes(p.id) ? 0 : p.id === suggestedId ? 1 : 2);
  const sorted = [...projects].sort((a, b) => rank(a) - rank(b));
  return sorted.slice(0, Math.max(limit, selected.length)).map((p) => ({ ...p, suggested: p.id === suggestedId, selected: selected.includes(p.id) }));
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

import { prisma } from '@/lib/db';
import { isFrozenStatus } from '@/lib/quote/basis';
import { buildSnapshot } from '@/lib/quote/snapshot';
import type { SnapshotData } from '@/lib/quote/compute';
import { legHeightByCabinet, loadQuote, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { QUOTE_BUCKET_LABELS } from './constants';
import { round2 } from './money';

/** Estimatul din oferta acceptată, pe categoriile motorului (breakdown), plus adaosul (manopera %). */
export interface QuoteEstimate {
  boards: number; edging: number; cuttingService: number; hardware: number; freeLines: number;
  totalCost: number;   // fără manoperă
  sellPrice: number;
  markup: number;      // sellPrice − totalCost (manopera + profit din ofertă)
}

export interface CompareRow {
  key: string;             // bucket sau categoryId
  label: string;
  estimated: number | null; // null = nu se poate estima (categorie fără mapare)
  real: number;
  diff: number | null;
  ratio: number | null;     // real / estimat
  over: boolean;            // real > estimat × (1 + prag)
}

/** Grupează categoriile reale pe bucket-ul din ofertă și le pune lângă estimat (§5.2). Pur, testabil. */
export function compareEstimateToReal(
  estimate: QuoteEstimate | null,
  categories: { id: string; name: string; quoteBucket: string | null }[],
  realByCategory: Map<string, number>,
  thresholdPct: number,
): { rows: CompareRow[]; totalEstimated: number | null; totalReal: number; totalOver: boolean } {
  const rows: CompareRow[] = [];
  const buckets = ['boards', 'edging', 'cuttingService', 'hardware', 'freeLines'] as const;
  const over = (est: number | null, real: number) => est != null && est > 0 ? real > est * (1 + thresholdPct / 100) : est === 0 && real > 0;
  const mk = (key: string, label: string, est: number | null, real: number): CompareRow => ({
    key, label, estimated: est, real: round2(real),
    diff: est != null ? round2(real - est) : null,
    ratio: est != null && est > 0 ? round2(real / est) : null,
    over: over(est, real),
  });

  for (const b of buckets) {
    const cats = categories.filter((c) => c.quoteBucket === b);
    if (cats.length === 0 && (estimate?.[b] ?? 0) === 0) continue;
    const real = cats.reduce((s, c) => s + (realByCategory.get(c.id) ?? 0), 0);
    const label = cats.length > 0 ? cats.map((c) => c.name).join(' + ') : QUOTE_BUCKET_LABELS[b];
    rows.push(mk(b, label, estimate ? estimate[b] : null, real));
  }
  for (const c of categories.filter((c) => !c.quoteBucket)) {
    const real = realByCategory.get(c.id) ?? 0;
    if (real === 0) continue;
    rows.push(mk(c.id, c.name, null, real));
  }
  const totalReal = round2([...realByCategory.values()].reduce((s, v) => s + v, 0));
  const totalEstimated = estimate ? round2(estimate.totalCost) : null;
  return { rows, totalEstimated, totalReal, totalOver: over(totalEstimated, totalReal) };
}

/** Estimatul însumat al ofertelor acceptate ale unui proiect (din snapshot-ul înghețat). */
export async function loadProjectEstimate(projectId: string): Promise<QuoteEstimate | null> {
  const quotes = await prisma.quote.findMany({ where: { projectId, status: 'ACCEPTATA' }, select: { id: true, status: true, snapshotJson: true } });
  if (quotes.length === 0) return null;
  const total: QuoteEstimate = { boards: 0, edging: 0, cuttingService: 0, hardware: 0, freeLines: 0, totalCost: 0, sellPrice: 0, markup: 0 };
  let any = false;
  for (const q of quotes) {
    const loaded = await loadQuote(q.id);
    if (!loaded) continue;
    let snapshot: SnapshotData | null = null;
    try {
      snapshot = isFrozenStatus(q.status) && q.snapshotJson ? (JSON.parse(q.snapshotJson) as SnapshotData) : await buildSnapshot();
      const { quote } = tryComputeQuote(toQuoteInput(loaded.quote, loaded.cabinets, legHeightByCabinet(loaded.assemblies, loaded.cabinets), loaded.assemblies), snapshot);
      if (!quote) continue;
      const b = quote.costs.breakdown;
      total.boards += b.boards; total.edging += b.edging; total.cuttingService += b.cuttingService; total.hardware += b.hardware; total.freeLines += b.freeLines;
      total.totalCost += quote.costs.totalCost; total.sellPrice += quote.costs.sellPrice;
      any = true;
    } catch { /* ofertă necalculabilă → o sărim */ }
  }
  if (!any) return null;
  for (const k of Object.keys(total) as (keyof QuoteEstimate)[]) total[k] = round2(total[k]);
  total.markup = round2(total.sellPrice - total.totalCost);
  return total;
}

/** Tabelul Estimat vs Real al unui proiect. */
export async function loadEstimateVsReal(projectId: string) {
  const [estimate, categories, allocs, settings] = await Promise.all([
    loadProjectEstimate(projectId),
    prisma.costCategory.findMany({ where: { scope: 'DIRECT' }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, quoteBucket: true } }),
    prisma.documentAllocation.groupBy({ by: ['categoryId'], where: { projectId, document: { replacedBy: null } }, _sum: { amount: true } }),
    prisma.appSettings.findUnique({ where: { id: 1 }, select: { overEstimatePct: true } }),
  ]);
  const real = new Map(allocs.map((a) => [a.categoryId, a._sum.amount?.toNumber() ?? 0]));
  return { estimate, thresholdPct: settings?.overEstimatePct ?? 10, ...compareEstimateToReal(estimate, categories, real, settings?.overEstimatePct ?? 10) };
}

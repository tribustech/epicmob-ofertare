import { isFrozenStatus } from './basis';
import { buildSnapshot } from './snapshot';
import type { SnapshotData } from './compute';
import { legHeightByCabinet, loadQuote, toQuoteInput, tryComputeQuote } from './load';

export interface QuotePriceSummary {
  cabinetCount: number;
  totalCost: number | null;
  sellPrice: number | null;
}

/**
 * Prețurile (cost materiale / preț ofertă) pentru mai multe oferte, cum le afișa lista veche:
 * ofertele înghețate (TRIMISA/ACCEPTATA) folosesc snapshot-ul lor; ciornele folosesc snapshotul
 * live construit O SINGURĂ DATĂ. Orice eroare de calcul → prețuri null (afișate „—").
 */
export async function summarizeQuotePrices(ids: string[]): Promise<Map<string, QuotePriceSummary>> {
  const out = new Map<string, QuotePriceSummary>();
  if (ids.length === 0) return out;
  let liveSnapshot: SnapshotData | null = null;
  for (const id of ids) {
    const loaded = await loadQuote(id);
    if (!loaded) continue;
    const { quote, assemblies, cabinets } = loaded;
    let totalCost: number | null = null;
    let sellPrice: number | null = null;
    try {
      let snapshot: SnapshotData | null;
      if (isFrozenStatus(quote.status)) {
        snapshot = quote.snapshotJson ? (JSON.parse(quote.snapshotJson) as SnapshotData) : null;
      } else {
        liveSnapshot ??= await buildSnapshot();
        snapshot = liveSnapshot;
      }
      if (snapshot) {
        const { quote: computed } = tryComputeQuote(
          toQuoteInput(quote, cabinets, legHeightByCabinet(assemblies, cabinets), assemblies),
          snapshot,
        );
        if (computed) {
          totalCost = computed.costs.totalCost;
          sellPrice = computed.costs.sellPrice;
        }
      }
    } catch {
      // snapshot corupt sau altă eroare — prețurile rămân null
    }
    out.set(id, { cabinetCount: cabinets.length, totalCost, sellPrice });
  }
  return out;
}

/** Prețul de vânzare al unei oferte pe un snapshot dat (folosit la acceptare, ca să-l înghețăm). */
export async function computeSellPrice(quoteId: string, snapshot: SnapshotData): Promise<number | null> {
  const loaded = await loadQuote(quoteId);
  if (!loaded) return null;
  const { quote, assemblies, cabinets } = loaded;
  const { quote: computed } = tryComputeQuote(
    toQuoteInput(quote, cabinets, legHeightByCabinet(assemblies, cabinets), assemblies),
    snapshot,
  );
  return computed?.costs.sellPrice ?? null;
}

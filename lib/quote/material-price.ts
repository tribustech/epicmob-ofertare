import type { MaterialRow } from '@/lib/catalog/convert';

type PricedMaterial = Pick<MaterialRow, 'pricingMode' | 'pricePerSheet' | 'pricePerSqm'>;

/** Materialul nu are preț utilizabil — intră în calcul cu 0 și subevaluează oferta. */
export function materialHasNoPrice(m: PricedMaterial): boolean {
  const price = m.pricingMode === 'PER_SQM' ? m.pricePerSqm : m.pricePerSheet;
  return price == null || price <= 0;
}

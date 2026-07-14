export function materialHasNoPrice(m: {
  pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
}): boolean {
  const price = m.pricingMode === 'PER_SQM' ? m.pricePerSqm : m.pricePerSheet;
  return price == null || price === 0;
}

/** Constante Finanțe: tipuri de conturi, mișcări, documente, categorii. Valorile sunt String în DB. */

export const ACCOUNT_KINDS = ['BANCA', 'CASH', 'CARD', 'ALTUL'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = { BANCA: 'Bancă', CASH: 'Cash', CARD: 'Card', ALTUL: 'Altul' };

export const MOVEMENT_TYPES = ['IN', 'OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  IN: 'Intrare', OUT: 'Ieșire', TRANSFER_IN: 'Transfer primit', TRANSFER_OUT: 'Transfer trimis', ADJUSTMENT: 'Ajustare',
};

export const INCOME_TYPES = ['AVANS', 'RATA', 'FINAL'] as const;
export const INCOME_TYPE_LABELS: Record<(typeof INCOME_TYPES)[number], string> = { AVANS: 'Avans', RATA: 'Rată', FINAL: 'Final' };

export const DOCUMENT_KINDS = ['FACTURA', 'PROFORMA', 'BON', 'CHITANTA', 'ALTUL'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  FACTURA: 'Factură', PROFORMA: 'Proformă', BON: 'Bon', CHITANTA: 'Chitanță', ALTUL: 'Altul',
};

export const PAYMENT_STATUS_LABELS = { NEPLATIT: 'Neplătit', PARTIAL: 'Parțial', PLATIT: 'Plătit' } as const;
export type PaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;
export const PAYMENT_STATUS_PILL: Record<PaymentStatus, string> = {
  NEPLATIT: 'border border-red-200 bg-red-50 text-red-700',
  PARTIAL: 'border border-amber-200 bg-amber-50 text-amber-700',
  PLATIT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
};

export const COST_SCOPES = ['DIRECT', 'INDIRECT'] as const;
export const COST_SCOPE_LABELS: Record<(typeof COST_SCOPES)[number], string> = { DIRECT: 'Directă (pe proiect)', INDIRECT: 'Indirectă (firmă)' };

/** Categoriile din ofertă la care se mapează costurile reale (Estimat vs Real, §5.2). */
export const QUOTE_BUCKETS = ['boards', 'edging', 'cuttingService', 'hardware', 'freeLines'] as const;
export const QUOTE_BUCKET_LABELS: Record<(typeof QUOTE_BUCKETS)[number], string> = {
  boards: 'Plăci (materiale)', edging: 'Cant', cuttingService: 'Debitare', hardware: 'Feronerie', freeLines: 'Linii libere',
};

export const FREQUENCIES = ['LUNAR', 'TRIMESTRIAL', 'ANUAL'] as const;
export const FREQUENCY_LABELS: Record<(typeof FREQUENCIES)[number], string> = { LUNAR: 'Lunar', TRIMESTRIAL: 'Trimestrial', ANUAL: 'Anual' };

/** Categoriile implicite (seed). Numele e cheia de idempotență (unic pe scope). */
export const DEFAULT_COST_CATEGORIES: { name: string; scope: 'DIRECT' | 'INDIRECT'; quoteBucket?: string }[] = [
  { name: 'Plăci', scope: 'DIRECT', quoteBucket: 'boards' },
  { name: 'Cant', scope: 'DIRECT', quoteBucket: 'edging' },
  { name: 'Debitare', scope: 'DIRECT', quoteBucket: 'cuttingService' },
  { name: 'Feronerie', scope: 'DIRECT', quoteBucket: 'hardware' },
  { name: 'Fronturi furnizor', scope: 'DIRECT' },
  { name: 'Blat', scope: 'DIRECT' },
  { name: 'Transport', scope: 'DIRECT', quoteBucket: 'freeLines' },
  { name: 'Montaj extern', scope: 'DIRECT', quoteBucket: 'freeLines' },
  { name: 'Refaceri', scope: 'DIRECT' },
  { name: 'Altele', scope: 'DIRECT' },
  { name: 'Chirie', scope: 'INDIRECT' },
  { name: 'Utilități', scope: 'INDIRECT' },
  { name: 'Contabilitate', scope: 'INDIRECT' },
  { name: 'Salarii', scope: 'INDIRECT' },
  { name: 'Taxe stat', scope: 'INDIRECT' },
  { name: 'Combustibil', scope: 'INDIRECT' },
  { name: 'Unelte/consumabile', scope: 'INDIRECT' },
  { name: 'Marketing', scope: 'INDIRECT' },
  { name: 'Abonamente', scope: 'INDIRECT' },
  { name: 'Altele', scope: 'INDIRECT' },
];

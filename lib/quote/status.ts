/** Stările unei oferte, în ordinea ciclului de viață, plus etichete și culori.
 *  Un singur loc pentru tot ce ține de stare: pagina ofertei, antetul proiectului, dashboard. */
export type QuoteStatus =
  | 'DE_FACUT' | 'CIORNA' | 'TRIMISA' | 'IN_NEGOCIERE' | 'AMANATA' | 'ACCEPTATA' | 'RESPINSA';

export const QUOTE_STATUSES: QuoteStatus[] = [
  'DE_FACUT', 'CIORNA', 'TRIMISA', 'IN_NEGOCIERE', 'AMANATA', 'ACCEPTATA', 'RESPINSA',
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DE_FACUT: 'De făcut',
  CIORNA: 'Ciornă',
  TRIMISA: 'Trimisă',
  IN_NEGOCIERE: 'În negociere',
  AMANATA: 'Amânată',
  ACCEPTATA: 'Acceptată',
  RESPINSA: 'Respinsă',
};

export const QUOTE_STATUS_PILL: Record<QuoteStatus, string> = {
  DE_FACUT: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
  CIORNA: 'bg-muted text-muted-foreground ring-1 ring-border',
  TRIMISA: 'bg-accent-blue text-accent-blue-foreground ring-1 ring-accent-blue-border',
  IN_NEGOCIERE: 'bg-violet-100 text-violet-800 ring-1 ring-violet-300',
  AMANATA: 'bg-orange-100 text-orange-900 ring-1 ring-orange-300',
  ACCEPTATA: 'bg-emerald-600 text-white ring-1 ring-emerald-700',
  RESPINSA: 'bg-muted text-muted-foreground line-through ring-1 ring-border',
};

/** Prețul se îngheață când oferta pleacă la client și rămâne înghețat cât timp e la el. */
export function isFrozenStatus(status: string): boolean {
  return status === 'TRIMISA' || status === 'IN_NEGOCIERE' || status === 'AMANATA' || status === 'ACCEPTATA';
}

/** Stările în care aștepți răspuns de la client (intră în relansări). */
export function isWaitingStatus(status: string): boolean {
  return status === 'TRIMISA' || status === 'IN_NEGOCIERE' || status === 'AMANATA';
}

/** Stările pe care le poate alege utilizatorul din selector. Acceptarea se face doar din
 *  tabul Oferte, unde se îngheață prețul; o ofertă acceptată nu se mai schimbă din selector. */
export function selectableStatuses(current: string): QuoteStatus[] {
  if (current === 'ACCEPTATA') return ['ACCEPTATA'];
  return QUOTE_STATUSES.filter((s) => s !== 'ACCEPTATA');
}

export function isQuoteStatus(s: string): s is QuoteStatus {
  return (QUOTE_STATUSES as string[]).includes(s);
}

/** Calcule pure pe mișcări: soldul unui cont e Σ mișcărilor, niciodată editat direct. */

export interface MovementLike {
  type: string;
  amount: number;
}

/** Suma cu semn a unei mișcări din perspectiva contului: intrările +, ieșirile −, ajustarea își poartă semnul. */
export function signedAmount(m: MovementLike): number {
  switch (m.type) {
    case 'IN':
    case 'TRANSFER_IN':
      return Math.abs(m.amount);
    case 'OUT':
    case 'TRANSFER_OUT':
      return -Math.abs(m.amount);
    case 'ADJUSTMENT':
      return m.amount;
    default:
      return 0;
  }
}

export function balanceOf(movements: MovementLike[]): number {
  return round2(movements.reduce((s, m) => s + signedAmount(m), 0));
}

/** Ajustare = sold numărat − sold calculat (semnul dă direcția). 0 → nimic de ajustat. */
export function adjustmentAmount(countedBalance: number, computedBalance: number): number {
  return round2(countedBalance - computedBalance);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Sold cu semn pe conturile personale: negativ = firma datorează persoanei (afișat la Datorii). */
export function personalDebt(balance: number): number {
  return balance < 0 ? -balance : 0;
}

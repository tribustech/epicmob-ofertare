import { round2 } from './money';
import type { PaymentStatus } from './constants';

/** Starea plății, derivată din suma documentului și ce s-a plătit deja. */
export function paymentStatus(amount: number, paid: number): PaymentStatus {
  if (paid <= 0) return 'NEPLATIT';
  if (paid + 0.005 >= amount) return 'PLATIT';
  return 'PARTIAL';
}

export function remainingToPay(amount: number, paid: number): number {
  return Math.max(0, round2(amount - paid));
}

/** Partea nealocată pe proiecte = indirect (pe categoria implicită a documentului). */
export function unallocated(amount: number, allocations: { amount: number }[]): number {
  return round2(amount - allocations.reduce((s, a) => s + a.amount, 0));
}

/** Validează alocările: fiecare > 0, Σ ≤ suma documentului. Întoarce mesajul de eroare sau null. */
export function validateAllocations(amount: number, allocations: { amount: number; projectId: string }[]): string | null {
  for (const a of allocations) {
    if (!a.projectId) return 'Alege proiectul pe fiecare rând de alocare.';
    if (!(a.amount > 0)) return 'Suma alocată trebuie să fie mai mare ca 0.';
  }
  if (unallocated(amount, allocations) < -0.005) return 'Alocările depășesc suma documentului.';
  return null;
}

/** Împarte o sumă egal pe N rânduri, cu restul de bani pe primul rând (Σ rămâne exact suma). */
export function splitEqual(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor((amount / n) * 100) / 100;
  const parts = Array.from({ length: n }, () => base);
  parts[0] = round2(amount - base * (n - 1));
  return parts;
}

/** Net din brut pentru TVA inclus (firma plătitoare); fără TVA sau brut → aceeași sumă. */
export function netAmount(amount: number, vatPct: number | null, vatIncluded: boolean): number {
  if (vatPct == null || vatPct <= 0) return amount;
  return vatIncluded ? round2(amount / (1 + vatPct / 100)) : amount;
}

/** Ce datorează un proiect din facturile alocate lui: (document − plătit) × (alocare / document). */
export function projectShareOfUnpaid(doc: { amount: number; paid: number }, allocation: number): number {
  if (doc.amount <= 0) return 0;
  return round2(remainingToPay(doc.amount, doc.paid) * (allocation / doc.amount));
}

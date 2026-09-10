import { z } from 'zod';

/**
 * Sume introduse de om: „6.120,00", „6120.5", „1 234,56", „25.000" (mii). Regula: dacă există virgulă,
 * ea e separatorul zecimal și punctele sunt de mii; altfel un singur punct urmat de 1–2 cifre e zecimal,
 * orice alt punct e de mii. Întoarce NaN dacă nu e număr.
 */
export function parseMoneyInput(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return NaN;
  let s = raw.replace(/\s|lei/gi, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) ?? []).length === 1) {
    // „6120.5" — un singur punct zecimal
  } else {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Câmp zod pentru sume (obligatoriu). */
export const money = z.preprocess(
  (v) => (v === '' || v == null ? undefined : parseMoneyInput(v)),
  z.number({ invalid_type_error: 'Suma nu e un număr' }).finite('Suma nu e un număr'),
);

/** Câmp zod pentru sume opționale (gol → undefined). */
export const optMoney = z.preprocess(
  (v) => (v === '' || v == null ? undefined : parseMoneyInput(v)),
  z.number({ invalid_type_error: 'Suma nu e un număr' }).finite().optional(),
);

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

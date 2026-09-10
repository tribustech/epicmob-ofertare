/** Luni de calendar ca chei 'YYYY-MM' (filtre pe registru, cheltuieli, pagina Luna). */

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → interval [start, end) în timp local; invalid → null */
export function parseMonthKey(key: string | null | undefined): { key: string; start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key?.trim() ?? '');
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  return { key: `${m[1]}-${m[2]}`, start: new Date(y, mo - 1, 1), end: new Date(y, mo, 1) };
}

export function shiftMonth(key: string, delta: number): string {
  const p = parseMonthKey(key) ?? parseMonthKey(monthKey())!;
  return monthKey(new Date(p.start.getFullYear(), p.start.getMonth() + delta, 1));
}

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

/** 'Septembrie 2026' */
export function monthLabel(key: string): string {
  const p = parseMonthKey(key);
  if (!p) return key;
  const name = MONTHS[p.start.getMonth()];
  return `${name[0].toUpperCase()}${name.slice(1)} ${p.start.getFullYear()}`;
}

/** Ultimele N luni (inclusiv cea curentă), cele mai recente primele — pentru selectoare. */
export function recentMonthKeys(n = 12, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
}

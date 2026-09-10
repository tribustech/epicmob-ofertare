import { monthKey, parseMonthKey } from './month';

export interface RecurringLike {
  frequency: string;   // LUNAR | TRIMESTRIAL | ANUAL
  dayOfMonth: number;
  startsAt: Date;
  endsAt: Date | null;
}

const STEP: Record<string, number> = { LUNAR: 1, TRIMESTRIAL: 3, ANUAL: 12 };

/** Data scadenței pentru o perioadă: ziua din lună (limitată la ultima zi a lunii). */
export function dueDateFor(periodKey: string, dayOfMonth: number): Date {
  const p = parseMonthKey(periodKey)!;
  const lastDay = new Date(p.start.getFullYear(), p.start.getMonth() + 1, 0).getDate();
  return new Date(p.start.getFullYear(), p.start.getMonth(), Math.min(Math.max(1, dayOfMonth), lastDay));
}

/**
 * Perioadele (chei 'YYYY-MM') pentru care șablonul trebuie să aibă un document „așteptat" până la
 * luna curentă inclusiv: pornește de la luna lui `startsAt`, sare cu 1/3/12 luni, se oprește la
 * `endsAt` sau la luna de referință. Idempotent: apelantul creează doar cheile lipsă.
 */
export function periodKeysDue(r: RecurringLike, today = new Date()): string[] {
  const step = STEP[r.frequency] ?? 1;
  const current = parseMonthKey(monthKey(today))!.start;
  const end = r.endsAt ? parseMonthKey(monthKey(r.endsAt))!.start : null;
  const keys: string[] = [];
  let cursor = new Date(r.startsAt.getFullYear(), r.startsAt.getMonth(), 1);
  let guard = 0;
  while (cursor <= current && (!end || cursor <= end) && guard++ < 600) {
    keys.push(monthKey(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + step, 1);
  }
  return keys;
}

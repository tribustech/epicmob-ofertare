// Funcții pure pentru grila lunară (fără DB, fără UI).
import { parseMonthKey } from '@/lib/finance/month';
import { toDateInput } from '@/lib/crm/dates';
import { CALENDAR_KINDS, KIND_META, type CalendarItem, type CalendarKind } from './types';

export interface GridCell {
  date: Date;
  dayKey: string;   // 'YYYY-MM-DD' local
  inMonth: boolean;
  isToday: boolean;
  items: CalendarItem[];
}

export const GRID_DAYS = 42;

/** Luni din săptămâna zilei 1 → 42 de zile (end exclusiv). Cheie invalidă → luna curentă. */
export function gridRange(key: string): { start: Date; end: Date } {
  const p = parseMonthKey(key) ?? parseMonthKey(toDateInput(new Date()).slice(0, 7))!;
  const first = p.start;
  const mondayOffset = (first.getDay() + 6) % 7; // duminică(0) → 6, luni(1) → 0
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + GRID_DAYS);
  return { start, end };
}

const KIND_ORDER: Record<CalendarKind, number> = { DEADLINE: 0, ACTIUNE: 1, BANI: 2, MANUAL: 3 };

/** Cele cu oră întâi (după oră), apoi pe tip (DEADLINE, ACTIUNE, BANI, MANUAL), apoi alfabetic. */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort((a, b) => {
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (KIND_ORDER[a.kind] !== KIND_ORDER[b.kind]) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return a.title.localeCompare(b.title, 'ro');
  });
}

export function buildGrid(key: string, items: CalendarItem[], today: Date): GridCell[] {
  const { start } = gridRange(key);
  const month = (parseMonthKey(key) ?? parseMonthKey(toDateInput(today).slice(0, 7))!).start.getMonth();
  const todayKey = toDateInput(today);
  const byDay = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const k = toDateInput(it.date);
    const arr = byDay.get(k);
    if (arr) arr.push(it); else byDay.set(k, [it]);
  }
  return Array.from({ length: GRID_DAYS }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dayKey = toDateInput(date);
    return { date, dayKey, inMonth: date.getMonth() === month, isToday: dayKey === todayKey, items: sortItems(byDay.get(dayKey) ?? []) };
  });
}

/** `?tip=bani,deadline` → tipuri în ordinea canonică; lipsă sau nimic valid → toate. */
export function parseKinds(param: string | undefined): CalendarKind[] {
  if (!param) return [...CALENDAR_KINDS];
  const wanted = new Set(param.split(',').map((s) => s.trim().toLowerCase()));
  const kinds = CALENDAR_KINDS.filter((k) => wanted.has(KIND_META[k].param));
  return kinds.length > 0 ? kinds : [...CALENDAR_KINDS];
}

export function applyFilter(items: CalendarItem[], kinds: CalendarKind[]): CalendarItem[] {
  const set = new Set(kinds);
  return items.filter((i) => set.has(i.kind));
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Restanțele afișate pe grilă: doar zilele din luna curentă (nu cele din lunile vecine). */
export function countOverdue(cells: GridCell[]): number {
  return cells.reduce((n, c) => (c.inMonth ? n + c.items.filter((i) => i.overdue).length : n), 0);
}

/** Cheia de URL pentru un set de tipuri (toate → fără parametru). */
export function kindsParam(kinds: CalendarKind[]): string | null {
  if (kinds.length === CALENDAR_KINDS.length) return null;
  return kinds.map((k) => KIND_META[k].param).join(',');
}

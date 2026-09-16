export type CalendarKind = 'DEADLINE' | 'ACTIUNE' | 'BANI' | 'MANUAL';
export const CALENDAR_KINDS: CalendarKind[] = ['DEADLINE', 'ACTIUNE', 'BANI', 'MANUAL'];

export interface CalendarItem {
  id: string;              // `${kind}:${sourceId}` — unic în lună
  kind: CalendarKind;
  date: Date;              // zi locală (miezul nopții)
  time: string | null;     // 'HH:MM' doar la MANUAL
  title: string;
  subtitle: string | null; // clientul / nota / restul de plată
  href: string | null;     // null la MANUAL (se deschide modalul de editare)
  overdue: boolean;        // date < azi și încă activ
  manual?: { title: string; time: string | null; note: string | null; projectId: string | null; projectName: string | null };
}

/** Etichete, parametrul din URL și clasele Tailwind pentru fiecare tip. */
export const KIND_META: Record<CalendarKind, { label: string; param: string; dot: string; pill: string }> = {
  // DEADLINE e plin, nu palid: termenul promis clientului trebuie să sară în ochi din grilă
  DEADLINE: { label: 'Deadline', param: 'deadline', dot: 'bg-white', pill: 'bg-red-600 text-white ring-red-700 font-semibold shadow-sm' },
  ACTIUNE: { label: 'Acțiune', param: 'actiune', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 ring-blue-200' },
  BANI: { label: 'Bani', param: 'bani', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  MANUAL: { label: 'Eveniment', param: 'manual', dot: 'bg-violet-500', pill: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

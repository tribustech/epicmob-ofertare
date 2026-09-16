/** Date „de calendar" (fără oră) pentru deadline / următoarea acțiune. */

/** 'YYYY-MM-DD' → Date la miezul nopții local; '' / null → null */
export function parseDateInput(v: string | null | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Date → 'YYYY-MM-DD' pentru <input type="date"> */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** zile întregi de la azi până la d (negativ = în trecut) */
export function daysFromToday(d: Date): number {
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
}

export const fmtDate = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

export type DeadlineTier = 'NONE' | 'LATE' | 'TODAY' | 'SOON' | 'APROAPE' | 'OK';

/** Cât de urgent e termenul: întârziat, azi, sub 7 zile, mai departe. */
export function deadlineTier(deadlineAt: Date | null): DeadlineTier {
  if (!deadlineAt) return 'NONE';
  const d = daysFromToday(deadlineAt);
  if (d < 0) return 'LATE';
  if (d === 0) return 'TODAY';
  if (d < 7) return 'SOON';
  return d <= 14 ? 'APROAPE' : 'OK';
}

/** Eticheta unui deadline: data + „în N z / întârziat N z", roșu sub 7 zile, gri dacă lipsește. */
export function deadlineParts(deadlineAt: Date | null): { label: string; sub: string; cls: string; tier: DeadlineTier } {
  const tier = deadlineTier(deadlineAt);
  if (!deadlineAt) return { label: 'fără deadline', sub: '', cls: 'text-muted-foreground', tier };
  const d = daysFromToday(deadlineAt);
  const sub = d < 0 ? `întârziat ${-d} z` : d === 0 ? 'azi' : `în ${d} z`;
  return { label: fmtDate.format(deadlineAt), sub, cls: d < 7 ? 'text-red-600' : '', tier };
}
export const fmtDateTime = new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

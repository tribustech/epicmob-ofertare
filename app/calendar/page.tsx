// app/calendar/page.tsx
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { monthKey, monthLabel, parseMonthKey, shiftMonth } from '@/lib/finance/month';
import { generateExpectedDocuments } from '@/lib/finance/recurring-generate';
import { loadProjectOptions } from '@/lib/crm/project-queries';
import { loadCalendarMonth } from '@/lib/calendar/events';
import { applyFilter, buildGrid, kindsParam, parseKinds } from '@/lib/calendar/grid';
import { CALENDAR_KINDS, KIND_META } from '@/lib/calendar/types';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayPanel } from '@/components/calendar/DayPanel';
import { EventForm } from '@/components/calendar/EventForm';
import { FormModal } from '@/components/FormModal';

export const dynamic = 'force-dynamic';

function href(key: string, tip: string | null, zi?: string | null): string {
  const q = new URLSearchParams({ luna: key });
  if (tip) q.set('tip', tip);
  if (zi) q.set('zi', zi);
  return `/calendar?${q.toString()}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ luna?: string; tip?: string; zi?: string }> }) {
  const sp = await searchParams;
  const key = parseMonthKey(sp.luna)?.key ?? monthKey();
  const kinds = parseKinds(sp.tip);
  const tip = kindsParam(kinds);
  const zi = /^\d{4}-\d{2}-\d{2}$/.test(sp.zi ?? '') ? sp.zi! : null;

  await generateExpectedDocuments();
  const [items, projectOptions] = await Promise.all([loadCalendarMonth(key), loadProjectOptions()]);
  const today = new Date();
  const cells = buildGrid(key, applyFilter(items, kinds), today);
  const dayCell = zi ? cells.find((c) => c.dayKey === zi) ?? null : null;
  const todayKey = monthKey(today);
  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        <div className="flex items-center gap-2 text-[13.5px]">
          <Link href={href(shiftMonth(key, -1), tip)} className="rounded-lg border border-input px-2 py-1 hover:bg-muted">←</Link>
          <span className="min-w-[150px] text-center font-semibold">{monthLabel(key)}</span>
          <Link href={href(shiftMonth(key, 1), tip)} className="rounded-lg border border-input px-2 py-1 hover:bg-muted">→</Link>
          {key !== todayKey && <Link href={href(todayKey, tip)} className="rounded-lg border border-input px-2 py-1 hover:bg-muted">Azi</Link>}
          <FormModal trigger="Adaugă eveniment" title="Eveniment nou" size="sm">
            <EventForm projectOptions={projectOptions} defaults={{ date: zi ?? (key === todayKey ? `${todayKey}-${String(today.getDate()).padStart(2, '0')}` : `${key}-01`) }} />
          </FormModal>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        {CALENDAR_KINDS.map((k) => {
          const on = kinds.includes(k);
          // toggle; dacă ar rămâne zero filtre, arătăm toate celelalte (nu lăsăm grila goală)
          const next = on ? kinds.filter((x) => x !== k) : CALENDAR_KINDS.filter((x) => kinds.includes(x) || x === k);
          const nextKinds = next.length === 0 ? CALENDAR_KINDS.filter((x) => x !== k) : next;
          return (
            <Link key={k} href={href(key, kindsParam(nextKinds), zi)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1', on ? KIND_META[k].pill : 'bg-transparent text-muted-foreground ring-border line-through')}>
              <span className={cn('h-2 w-2 rounded-full', KIND_META[k].dot)} />{KIND_META[k].label}
            </Link>
          );
        })}
        {overdueCount > 0 && <span className="ml-auto text-red-600">{overdueCount} {overdueCount === 1 ? 'restanță' : 'restanțe'} în această lună</span>}
      </div>

      <MonthGrid cells={cells} projectOptions={projectOptions} baseHref={href(key, tip)} />

      {dayCell && <DayPanel cell={dayCell} projectOptions={projectOptions} closeHref={href(key, tip)} />}
    </div>
  );
}

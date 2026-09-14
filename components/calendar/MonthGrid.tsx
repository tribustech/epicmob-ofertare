// components/calendar/MonthGrid.tsx
// Grila lunară: 7 coloane Lu–Du × 6 rânduri. Pastile = Link sau modal de editare (MANUAL).
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { KIND_META, type CalendarItem } from '@/lib/calendar/types';
import type { GridCell } from '@/lib/calendar/grid';
import { FormModal } from '@/components/FormModal';
import { EventForm } from './EventForm';

const DAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'];
const MAX_PILLS = 3;

export function EventPill({ item, projectOptions, compact }: {
  item: CalendarItem; projectOptions: { value: string; label: string }[]; compact?: boolean;
}) {
  const meta = KIND_META[item.kind];
  const body = (
    <span className={cn(
      'flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11.5px] leading-tight ring-1',
      meta.pill, item.overdue && 'ring-2 ring-red-400',
    )}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      {item.time && <span className="shrink-0 font-mono text-[10.5px]">{item.time}</span>}
      <span className="truncate">{item.overdue && '! '}{item.title}</span>
      {!compact && item.subtitle && <span className="ml-auto shrink-0 truncate text-[10.5px] opacity-70">{item.subtitle}</span>}
    </span>
  );
  if (item.href) return <Link href={item.href} className="block min-w-0 hover:opacity-80" title={item.subtitle ?? item.title}>{body}</Link>;
  const m = item.manual!;
  return (
    <FormModal trigger={`${item.time ? `${item.time} ` : ''}${item.title}`} title="Editează evenimentul" variant="ghost" size="sm"
      className={cn('h-auto w-full justify-start rounded-md px-1.5 py-0.5 text-[11.5px] font-normal ring-1', meta.pill)}>
      <EventForm projectOptions={projectOptions} eventId={item.id.replace(/^MANUAL:/, '')}
        defaults={{ title: m.title, date: dayKeyOf(item.date), time: m.time, projectId: m.projectId, note: m.note }} />
    </FormModal>
  );
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonthGrid({ cells, projectOptions, baseHref }: {
  cells: GridCell[]; projectOptions: { value: string; label: string }[]; baseHref: string;
}) {
  const dayHref = (k: string) => `${baseHref}${baseHref.includes('?') ? '&' : '?'}zi=${k}`;
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
        {DAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => (
          <div key={c.dayKey} className={cn(
            'min-h-[72px] border-b border-r p-1.5 sm:min-h-[104px]',
            i % 7 === 6 && 'border-r-0', i >= 35 && 'border-b-0',
            !c.inMonth && 'bg-muted/30 text-muted-foreground', c.isToday && 'bg-accent-blue/40',
          )}>
            <div className="mb-1 flex items-center justify-between">
              <Link href={dayHref(c.dayKey)} className={cn('rounded px-1 text-[12px] font-semibold hover:bg-muted', c.isToday && 'bg-foreground text-background hover:bg-foreground')}>
                {c.date.getDate()}
              </Link>
            </div>
            {/* telefon: doar puncte; desktop: pastile */}
            <div className="flex flex-wrap gap-1 sm:hidden">
              {c.items.map((it) => <span key={it.id} className={cn('h-1.5 w-1.5 rounded-full', KIND_META[it.kind].dot)} />)}
            </div>
            <div className="hidden space-y-0.5 sm:block">
              {c.items.slice(0, MAX_PILLS).map((it) => <EventPill key={it.id} item={it} projectOptions={projectOptions} compact />)}
              {c.items.length > MAX_PILLS && (
                <Link href={dayHref(c.dayKey)} className="block px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">+{c.items.length - MAX_PILLS}</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

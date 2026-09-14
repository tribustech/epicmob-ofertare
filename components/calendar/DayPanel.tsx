// components/calendar/DayPanel.tsx
// Lista completă a unei zile (deschisă cu ?zi=YYYY-MM-DD) + „Adaugă eveniment" precompletat.
import Link from 'next/link';
import type { GridCell } from '@/lib/calendar/grid';
import { FormModal } from '@/components/FormModal';
import { EventForm } from './EventForm';
import { EventPill } from './MonthGrid';

const fmtLong = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function DayPanel({ cell, projectOptions, closeHref }: {
  cell: GridCell; projectOptions: { value: string; label: string }[]; closeHref: string;
}) {
  const label = fmtLong.format(cell.date);
  return (
    <div className="rounded-xl bg-card px-5 py-4 ring-1 ring-border">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-bold">{label[0].toUpperCase()}{label.slice(1)}</div>
        <div className="flex items-center gap-2">
          <FormModal trigger="Adaugă eveniment" title="Eveniment nou" variant="outline" size="sm">
            <EventForm projectOptions={projectOptions} defaults={{ date: cell.dayKey }} />
          </FormModal>
          <Link href={closeHref} className="rounded-lg border border-input px-2 py-1 text-[12.5px] hover:bg-muted">Închide</Link>
        </div>
      </div>
      {cell.items.length === 0 ? (
        <div className="py-4 text-center text-[13px] text-muted-foreground">Nimic în această zi.</div>
      ) : (
        <div className="space-y-1">
          {cell.items.map((it) => <EventPill key={it.id} item={it} projectOptions={projectOptions} />)}
        </div>
      )}
    </div>
  );
}

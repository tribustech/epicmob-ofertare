import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/crm/dates';
import type { TimelineEntry, TimelineFilter } from '@/lib/crm/timeline';
import { createNote, deleteNote, toggleNotePin } from '@/lib/crm/note-actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { SubmitButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { microLabelCls } from './ui';

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'tot', label: 'Tot' }, { key: 'notite', label: 'Notițe' }, { key: 'evenimente', label: 'Evenimente' },
];

/**
 * Timeline unificat: caseta de notiță sus (mereu vizibilă), filtre, apoi fluxul de notițe + evenimente.
 * `target` spune pe cine se scrie notița; `baseHref` e pagina curentă (pentru link-urile de filtru).
 */
export function Timeline({ entries, target, baseHref, filter, placeholder }: {
  entries: TimelineEntry[];
  target: { clientId: string } | { projectId: string };
  baseHref: string;
  filter: TimelineFilter;
  placeholder?: string;
}) {
  const shown = entries.filter((e) => filter === 'tot' || (filter === 'notite' ? e.kind === 'note' : e.kind === 'event'));
  const counts = { tot: entries.length, notite: entries.filter((e) => e.kind === 'note').length, evenimente: entries.filter((e) => e.kind === 'event').length };
  const sep = baseHref.includes('?') ? '&' : '?';

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-xl bg-card px-4 py-3.5 ring-1 ring-border">
        <ActionForm action={createNote.bind(null, target)} className="flex flex-col gap-2.5">
          <textarea
            name="body"
            rows={2}
            required
            placeholder={placeholder ?? 'Scrie o notiță… (ce ai vorbit, ce ai promis, ce s-a schimbat)'}
            className="w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-snug outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex items-center justify-between border-t pt-2.5">
            <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <input type="checkbox" name="pinned" className="size-3.5" /> Important
            </label>
            <SubmitButton>Adaugă</SubmitButton>
          </div>
        </ActionForm>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="text-[15px] font-bold">Timeline</div>
          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={`${baseHref}${sep}flux=${f.key}`}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[12px] font-medium',
                  f.key === filter ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label} <span className="font-mono text-[10.5px] opacity-70">{counts[f.key]}</span>
              </Link>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-muted-foreground">Nimic încă.</div>
        ) : (
          <ul>
            {shown.map((e) => (
              <li key={`${e.kind}-${e.id}`} className={cn('flex gap-3 border-b px-5 py-3 last:border-b-0', e.kind === 'note' && e.pinned && 'bg-amber-50/60')}>
                <div className={cn('mt-1.5 size-2 shrink-0 rounded-full', e.kind === 'note' ? 'bg-foreground' : 'bg-muted-foreground/40')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[13px]">
                      <span className="font-semibold">{e.user ?? 'Sistem'}</span>{' '}
                      <span className="text-muted-foreground">{e.kind === 'note' ? 'a scris' : e.label}</span>
                      {e.source && (
                        e.source.href
                          ? <Link href={e.source.href} className="ml-1.5 rounded-full bg-muted px-2 py-px text-[10.5px] font-semibold text-muted-foreground hover:text-foreground">{e.source.label}</Link>
                          : <span className="ml-1.5 rounded-full bg-muted px-2 py-px text-[10.5px] font-semibold text-muted-foreground">{e.source.label}</span>
                      )}
                      {e.kind === 'note' && e.pinned && (
                        <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-px text-[10.5px] font-semibold text-amber-800">important</span>
                      )}
                    </div>
                    {e.kind === 'note' && (
                      <div className="flex shrink-0 items-center gap-1">
                        <ActionForm action={toggleNotePin.bind(null, e.id)}>
                          <Button type="submit" variant="ghost" size="xs" className="text-muted-foreground">{e.pinned ? 'Scoate din importante' : 'Important'}</Button>
                        </ActionForm>
                        <DeleteButton action={deleteNote.bind(null, e.id)} iconOnly label="Șterge notița" confirmMessage="Ștergi această notiță?" />
                      </div>
                    )}
                  </div>
                  {e.kind === 'note'
                    ? <div className="mt-1 whitespace-pre-wrap text-[13.5px] leading-snug">{e.body}</div>
                    : e.detail && <div className="mt-0.5 text-[13px]">{e.detail}</div>}
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{fmtDateTime.format(e.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Cardul „Notițe importante" (pinuite), pentru coloana din stânga. */
export function PinnedNotes({ notes }: { notes: { id: string; body: string; at: Date; user: string | null; source: string | null }[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-card p-5 ring-1 ring-border">
      <div className={microLabelCls}>Notițe importante</div>
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[13px] leading-snug">
          <div className="whitespace-pre-wrap">{n.body}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {n.user ?? 'Sistem'} · {fmtDateTime.format(n.at)}{n.source && ` · ${n.source}`}
          </div>
        </div>
      ))}
    </div>
  );
}

export function parseFilter(v: string | undefined): TimelineFilter {
  return v === 'notite' || v === 'evenimente' ? v : 'tot';
}

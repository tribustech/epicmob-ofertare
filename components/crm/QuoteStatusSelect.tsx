'use client';

import { useActionState, useEffect, useRef, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormState } from '@/lib/forms/form-action';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_PILL, selectableStatuses, type QuoteStatus } from '@/lib/quote/status';

/** Selectorul de stare al ultimei oferte, din antetul proiectului. Schimbarea se trimite pe loc;
 *  o ofertă acceptată e blocată (acceptarea/renunțarea se fac din tabul Oferte). */
export function QuoteStatusSelect({ action, status, version, disabled }: {
  action: (fd: FormData) => Promise<FormState>;
  status: string; version: number; disabled?: boolean;
}) {
  const [state, dispatch] = useActionState(async (_prev: FormState, fd: FormData) => action(fd), {} as FormState);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLSelectElement>(null);
  // la eroare punem selectorul înapoi pe starea reală
  useEffect(() => { if (state.error && ref.current) ref.current.value = status; }, [state.error, status]);

  const locked = disabled || status === 'ACCEPTATA';
  const pill = QUOTE_STATUS_PILL[status as QuoteStatus] ?? 'bg-muted text-muted-foreground';

  if (locked) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold', pill)}>
        <span className="font-mono opacity-80">#{version}</span>
        {QUOTE_STATUS_LABELS[status as QuoteStatus] ?? status}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-full py-1 pl-3 pr-2 text-[12px] font-semibold shadow-sm transition-shadow hover:shadow',
        pill, pending && 'opacity-60',
      )}>
        <span className="font-mono opacity-80">#{version}</span>
        <select
          ref={ref}
          aria-label={`Starea ofertei #${version}`}
          defaultValue={status}
          disabled={pending}
          onChange={(e) => {
            const fd = new FormData();
            fd.set('status', e.target.value);
            startTransition(() => dispatch(fd));
          }}
          className="cursor-pointer appearance-none bg-transparent pr-0.5 text-[12px] font-semibold outline-none"
        >
          {selectableStatuses(status).map((s) => (
            <option key={s} value={s} className="bg-background text-foreground">{QUOTE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <ChevronDown className="size-3.5 opacity-70" aria-hidden />
      </span>
      {state.error && <span className="text-[11px] text-destructive">{state.error}</span>}
    </span>
  );
}

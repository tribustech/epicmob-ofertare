'use client';
import { useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface SearchableOption { value: string; label: string }

// aceleași clase ca `<select>`-ul din panou, ca trigger-ul să arate identic
const triggerCls = cn(
  'flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

// căutare fără diacritice: „stejar" găsește „Stejar", „sîmbure" ↔ „simbure"
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dropdown cu câmp de căutare. Termenii se caută independent („charles 18" găsește „Stejar Charles 18mm"). */
export function SearchableSelect({
  value, onChange, options, placeholder = 'Selectează…', searchPlaceholder = 'Caută…',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return options;
    return options.filter((o) => {
      const hay = fold(o.label);
      return terms.every((t) => hay.includes(t));
    });
  }, [options, q]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(''); }}>
      <Popover.Trigger asChild>
        <button type="button" className={triggerCls}>
          <span className={cn('min-w-0 grow truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-[var(--radix-popover-trigger-width)] min-w-64 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <Input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filtered.length > 0) { e.preventDefault(); pick(filtered[0].value); }
            }}
            placeholder={searchPlaceholder}
            className="mb-2"
          />
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                  o.value === value && 'bg-accent',
                )}
              >
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {o.value === value && <CheckIcon className="size-4" />}
                </span>
                <span className="min-w-0 grow truncate" title={o.label}>{o.label}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">Niciun rezultat.</p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

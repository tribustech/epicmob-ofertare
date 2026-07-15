'use client';

import { Fragment, useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { fieldLabelCls } from '@/components/forms';

export type FrontModelOption = {
  id: string;
  code: string;
  name: string;
  tier: string;
  collection: string | null;
  shapeFamily: string;
  imageUrl: string | null;
};

// aceleași clase ca `<select>`-ul din formular, ca trigger-ul să arate identic
const triggerCls = cn(
  'flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function Thumb({ model, className }: { model: FrontModelOption; className?: string }) {
  if (model.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={model.imageUrl} alt={model.name} loading="lazy" className={cn('shrink-0 rounded object-cover', className)} />;
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground', className)}>
      —
    </div>
  );
}

export function FrontModelPicker({
  label, value, onChange, models, allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (modelId: string) => void;
  models: FrontModelOption[];
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = useMemo(() => models.find((m) => m.id === value), [models, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return models;
    return models.filter((m) => `${m.code} ${m.name} ${m.collection ?? ''}`.toLowerCase().includes(needle));
  }, [models, q]);

  // grupare simplă pe colecție, păstrând ordinea de apariție
  const groups = useMemo(() => {
    const map = new Map<string, FrontModelOption[]>();
    for (const m of filtered) {
      const key = m.collection ?? 'Fără colecție';
      const arr = map.get(key);
      if (arr) arr.push(m);
      else map.set(key, [m]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };

  return (
    <div className="grid gap-1">
      <Label className={fieldLabelCls}>{label}</Label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={triggerCls}>
            {selected ? (
              <>
                <Thumb model={selected} className="size-6" />
                <span className="min-w-0 grow truncate">
                  <span className="font-medium">{selected.code}</span>
                  {' · '}
                  <span className="text-muted-foreground">{selected.name}</span>
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px]">{selected.tier}</Badge>
              </>
            ) : (
              <span className="grow text-muted-foreground">{allowEmpty ? '—' : 'Selectează model'}</span>
            )}
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 w-80 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <Input
              autoFocus
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Caută cod, denumire sau colecție…"
              className="mb-2"
            />
            <div className="max-h-72 overflow-y-auto">
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => pick('')}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                    !value && 'bg-accent',
                  )}
                >
                  <span className="flex size-4 items-center justify-center">{!value && <CheckIcon className="size-4" />}</span>
                  <span className="text-muted-foreground">— (fără)</span>
                </button>
              )}
              {groups.map(([collection, rows]) => (
                <Fragment key={collection}>
                  <p className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {collection}
                  </p>
                  {rows.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pick(m.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent',
                        m.id === value && 'bg-accent',
                      )}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {m.id === value && <CheckIcon className="size-4" />}
                      </span>
                      <Thumb model={m} className="size-8" />
                      <span className="min-w-0 grow">
                        <span className="font-medium">{m.code}</span>
                        <span className="block truncate text-xs text-muted-foreground" title={m.name}>
                          {m.name}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{m.tier}</Badge>
                    </button>
                  ))}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Niciun model.</p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

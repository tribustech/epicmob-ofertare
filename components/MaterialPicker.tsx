'use client';

import { useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NoPriceBadge } from '@/components/NoPriceBadge';
import { materialHasNoPrice } from '@/lib/quote/material-price';

export type MaterialPickerItem = {
  id: string;
  name: string;
  kind: string;
  thicknessMm: number;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  decorCode?: string | null;
  pricePerSheet: number | null;
  pricePerSqm: number | null;
  pricingMode: string;
  active: boolean;
};

// aceleași clase ca `<select>`-ul din formular, ca trigger-ul să arate identic
const triggerCls = cn(
  'flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function priceLabel(m: MaterialPickerItem): string | null {
  if (materialHasNoPrice(m)) return null;
  const value = m.pricingMode === 'PER_SQM' ? m.pricePerSqm : m.pricePerSheet;
  const suffix = m.pricingMode === 'PER_SQM' ? 'lei/m²' : 'lei';
  return `${value} ${suffix}`;
}

function Thumb({ m, className }: { m: MaterialPickerItem; className?: string }) {
  if (m.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={m.imageUrl} alt={m.name} loading="lazy" className={cn('shrink-0 rounded object-cover', className)} />;
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded bg-muted text-[9px] text-muted-foreground', className)}>
      —
    </div>
  );
}

export function MaterialPicker({
  label, value, onChange, materials, allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  materials: MaterialPickerItem[];
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('all');

  const selected = useMemo(() => materials.find((m) => m.id === value), [materials, value]);

  // lista răsfoibilă: doar materiale active + selecția curentă chiar dacă e dezactivată
  const browsable = useMemo(() => {
    const rows = materials.filter((m) => m.active);
    if (selected && !selected.active) rows.push(selected);
    return rows;
  }, [materials, selected]);

  const brandChips = useMemo(() => {
    const present = Array.from(new Set(browsable.map((m) => m.brand).filter(Boolean) as string[]));
    return present.length > 1 ? present : [];
  }, [browsable]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return browsable.filter((m) => {
      if (brand !== 'all' && (m.brand ?? '') !== brand) return false;
      if (needle) {
        const hay = `${m.name} ${m.decorCode ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [browsable, q, brand]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ('');
    setBrand('all');
  };

  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className={triggerCls}>
            {selected ? (
              <>
                <Thumb m={selected} className="size-6" />
                <span className="min-w-0 grow truncate">
                  {selected.decorCode && <span className="font-medium">{selected.decorCode}</span>}
                  {selected.decorCode && ' · '}
                  <span className={cn(!selected.decorCode && 'font-medium')}>{selected.name}</span>
                  {!selected.active && <span className="text-muted-foreground"> (dezactivat)</span>}
                </span>
                {materialHasNoPrice(selected) && <NoPriceBadge className="shrink-0" />}
              </>
            ) : (
              <span className="grow text-muted-foreground">{allowEmpty ? '—' : 'Selectează material'}</span>
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
              placeholder="Caută cod sau denumire…"
              className="mb-2"
            />
            {brandChips.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                <Button type="button" size="sm" variant={brand === 'all' ? 'default' : 'outline'} onClick={() => setBrand('all')}>
                  Toate
                </Button>
                {brandChips.map((b) => (
                  <Button key={b} type="button" size="sm" variant={brand === b ? 'default' : 'outline'} onClick={() => setBrand(b)}>
                    {b}
                  </Button>
                ))}
              </div>
            )}
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
              {filtered.map((m) => {
                const price = priceLabel(m);
                return (
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
                    <Thumb m={m} className="size-8" />
                    <span className="min-w-0 grow">
                      {m.decorCode && <span className="font-medium">{m.decorCode}</span>}
                      <span className="block truncate text-xs text-muted-foreground" title={m.name}>
                        {m.name}
                        {!m.active && ' (dezactivat)'}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      {m.brand && <Badge variant="outline" className="text-[10px]">{m.brand}</Badge>}
                      {price ? <span className="text-xs font-medium">{price}</span> : <NoPriceBadge />}
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Niciun material.</p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

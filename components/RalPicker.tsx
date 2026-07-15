'use client';

import { useMemo, useState } from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fieldLabelCls } from '@/components/forms';

// Formă client-safe pentru culoare RAL (NU importa lib/ral.ts — folosește fs).
// Datele vin ca prop (plain data) din server.
export type RalColor = {
  code: string;
  num: string;
  name_en: string;
  hex: string;
  vivid: boolean;
  black: boolean;
};

// aceleași clase ca `<select>`-ul din formular, ca trigger-ul să arate identic
const triggerCls = cn(
  'flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function Swatch({ hex, className }: { hex: string; className?: string }) {
  return (
    <span
      className={cn('shrink-0 rounded border border-foreground/10', className)}
      style={{ background: hex }}
    />
  );
}

export function RalPicker({
  label, value, onChange, colors, onVividHint, allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (ralCode: string) => void;
  colors: RalColor[];
  onVividHint?: (vivid: boolean) => void;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const selected = useMemo(() => colors.find((c) => c.code === value), [colors, value]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return colors;
    return colors.filter((c) => `${c.code} ${c.num} ${c.name_en}`.toLowerCase().includes(needle));
  }, [colors, q]);

  const pick = (color: RalColor | null) => {
    if (color) {
      onChange(color.code);
      onVividHint?.(color.vivid);
    } else {
      onChange('');
    }
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
                <Swatch hex={selected.hex} className="size-6" />
                <span className="min-w-0 grow truncate">
                  <span className="font-medium">{selected.code}</span>
                  {' · '}
                  <span className="text-muted-foreground">{selected.name_en}</span>
                </span>
              </>
            ) : (
              <span className="grow text-muted-foreground">{allowEmpty ? '—' : 'Selectează RAL'}</span>
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
            <div className="max-h-72 overflow-y-auto">
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => pick(null)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                    !value && 'bg-accent',
                  )}
                >
                  <span className="flex size-4 items-center justify-center">{!value && <CheckIcon className="size-4" />}</span>
                  <span className="text-muted-foreground">— (fără)</span>
                </button>
              )}
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pick(c)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent',
                    c.code === value && 'bg-accent',
                  )}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {c.code === value && <CheckIcon className="size-4" />}
                  </span>
                  <Swatch hex={c.hex} className="size-5" />
                  <span className="min-w-0 grow">
                    <span className="font-medium">{c.code}</span>
                    <span className="block truncate text-xs text-muted-foreground" title={c.name_en}>
                      {c.name_en}
                    </span>
                  </span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nicio culoare.</p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

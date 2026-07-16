'use client';

import { useMemo, useState, useTransition } from 'react';
import { Popover } from 'radix-ui';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { quickCreateHardware } from '@/lib/catalog/actions';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export interface HardwareComboItem {
  id: string;
  name: string;
  category: string;
  pricePerUnit: number;
  active: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  BALAMA: 'Balama', SERTAR: 'Sertar / glisiere', MANER: 'Mâner', PICIOR: 'Picior',
  SINA_SUSPENDARE: 'Șină suspendare', SUPORT_POLITA: 'Suport poliță',
  CLEMA_SOCLU: 'Clemă soclu', PISTON_AVENTOS: 'Aventos / piston',
  HOLTSURUB: 'Holtșurub', ACCESORIU: 'Accesoriu',
};

const triggerCls = cn(
  'flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1',
  'text-left text-base transition-colors outline-none md:text-sm dark:bg-input/30',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/**
 * Dropdown de feronerie cu căutare și creare pe loc: dacă produsul nu există,
 * îl adaugi direct din listă (denumire + preț) — intră în catalog și e selectat.
 */
export function HardwareCombobox({
  value, onChange, items, category, onCreated, error, placeholder = 'Selectează…',
}: {
  value: string | null;
  onChange: (id: string) => void;
  items: HardwareComboItem[];
  /** fixează categoria (rândurile auto); lipsă = orice categorie (rândurile extra) */
  category?: string;
  /** produs nou creat din combobox — apelantul îl adaugă în lista locală */
  onCreated: (item: HardwareComboItem) => void;
  error?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState(category ?? 'ACCESORIU');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(() => items.find((i) => i.id === value), [items, value]);

  const browsable = useMemo(() => {
    const rows = items.filter((i) => i.active && (!category || i.category === category));
    if (selected && !rows.some((r) => r.id === selected.id)) rows.push(selected);
    return rows;
  }, [items, category, selected]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return browsable;
    return browsable.filter((i) => i.name.toLowerCase().includes(needle));
  }, [browsable, q]);

  const close = () => {
    setOpen(false);
    setQ('');
    setCreating(false);
    setCreateError(null);
  };

  const startCreate = () => {
    setNewName(q.trim());
    setNewPrice('');
    setNewCategory(category ?? 'ACCESORIU');
    setCreateError(null);
    setCreating(true);
  };

  const submitCreate = () => {
    const price = Number(newPrice);
    if (!newName.trim() || !Number.isFinite(price) || price < 0) {
      setCreateError('Completează denumirea și un preț valid');
      return;
    }
    startTransition(async () => {
      const r = await quickCreateHardware(newCategory, newName.trim(), price);
      if (r.error || !r.id) {
        setCreateError(r.error ?? 'Nu s-a putut crea produsul');
        return;
      }
      onCreated({ id: r.id, name: newName.trim(), category: newCategory, pricePerUnit: price, active: true });
      onChange(r.id);
      close();
    });
  };

  return (
    <div className="grid gap-1">
      <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <Popover.Trigger asChild>
          <button type="button" className={cn(triggerCls, error && 'border-destructive')}>
            {selected ? (
              <span className="min-w-0 grow truncate">
                {selected.name}
                <span className="text-muted-foreground"> ({selected.pricePerUnit} lei)</span>
                {!selected.active && <span className="text-muted-foreground"> (dezactivat)</span>}
              </span>
            ) : (
              <span className="grow text-muted-foreground">{placeholder}</span>
            )}
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[340px] rounded-xl border bg-popover p-2 shadow-md outline-none"
          >
            {!creating ? (
              <>
                <Input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Caută sau scrie un produs nou…"
                  className="mb-2 h-8"
                />
                <div className="max-h-64 overflow-y-auto">
                  {filtered.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => { onChange(i.id); close(); }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent',
                        i.id === value && 'bg-accent',
                      )}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {i.id === value && <CheckIcon className="size-4" />}
                      </span>
                      <span className="min-w-0 grow truncate">
                        {i.name}
                        {!i.active && ' (dezactivat)'}
                        {!category && (
                          <span className="block text-xs text-muted-foreground">{CATEGORY_LABELS[i.category] ?? i.category}</span>
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{i.pricePerUnit} lei</span>
                    </button>
                  ))}
                  {filtered.length === 0 && (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">Niciun produs găsit.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startCreate}
                  className="mt-1 w-full rounded-md border border-dashed px-2 py-1.5 text-left text-sm text-accent-blue-foreground hover:bg-muted"
                >
                  ＋ Adaugă produs nou{q.trim() ? `: „${q.trim()}"` : ''}
                </button>
              </>
            ) : (
              <div className="space-y-2 p-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Produs nou · {category ? (CATEGORY_LABELS[category] ?? category) : 'alege categoria'}
                </p>
                <Input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Denumire"
                  className="h-8"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="Preț (lei/buc)"
                  className="h-8 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); }}
                />
                {!category && (
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                )}
                {createError && <p className="text-xs text-destructive">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={submitCreate}
                    disabled={isPending}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {isPending ? 'Se salvează…' : 'Salvează în catalog'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Înapoi
                  </button>
                </div>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

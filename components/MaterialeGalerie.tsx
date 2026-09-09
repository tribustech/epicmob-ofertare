'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NoPriceBadge } from '@/components/NoPriceBadge';
import { ActionForm } from '@/components/ActionForm';
import { ModalCloseContext } from '@/components/modal-close';
import { SubmitButton } from '@/components/forms';
import { updateMaterialPrice } from '@/lib/catalog/actions';
import { materialHasNoPrice } from '@/lib/quote/material-price';

export type MaterialCard = {
  id: string;
  name: string;
  kind: string;
  thicknessMm: number;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  decorCode: string | null;
  pricePerSheet: number | null;
  pricePerSqm: number | null;
  pricingMode: string;
};

// Fixed display order; only brands present in the data are shown.
const BRAND_ORDER = ['Egger', 'Kastamonu', 'AGT'];
const MANUAL = '__manual__';

const CATEGORY_CHIPS = [
  { value: 'all', label: 'Toate' },
  { value: 'PLACA', label: 'Plăci' },
  { value: 'BLAT', label: 'Blaturi' },
];

function priceLabel(m: MaterialCard) {
  if (materialHasNoPrice(m)) return null;
  const value = m.pricingMode === 'PER_SQM' ? m.pricePerSqm : m.pricePerSheet;
  const suffix = m.pricingMode === 'PER_SQM' ? 'lei/m²' : 'lei';
  return `${value} ${suffix}`;
}

export function MaterialeGalerie({ materials }: { materials: MaterialCard[] }) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [editing, setEditing] = useState<MaterialCard | null>(null);

  const hasManual = useMemo(() => materials.some((m) => m.brand == null), [materials]);

  const brandChips = useMemo(() => {
    const present = new Set(materials.map((m) => m.brand).filter(Boolean) as string[]);
    const chips: { value: string; label: string }[] = [{ value: 'all', label: 'Toate' }];
    for (const b of BRAND_ORDER) if (present.has(b)) chips.push({ value: b, label: b });
    if (hasManual) chips.push({ value: MANUAL, label: 'Manual' });
    return chips;
  }, [materials, hasManual]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return materials.filter((m) => {
      if (brand === MANUAL) {
        if (m.brand != null) return false;
      } else if (brand !== 'all' && m.brand !== brand) {
        return false;
      }
      if (category !== 'all' && m.category !== category) return false;
      if (needle) {
        const hay = `${m.name} ${m.decorCode ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [materials, q, brand, category]);

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 space-y-3 border-b bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Caută după cod sau denumire: U999, sonoma, gri, marmură..."
          className="max-w-md"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {brandChips.map((c) => (
              <Button
                key={c.value}
                type="button"
                size="sm"
                variant={brand === c.value ? 'default' : 'outline'}
                onClick={() => setBrand(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <Separator orientation="vertical" className="mx-1 h-6" />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_CHIPS.map((c) => (
              <Button
                key={c.value}
                type="button"
                size="sm"
                variant={category === c.value ? 'default' : 'outline'}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {filtered.length} materiale
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {filtered.map((m) => {
          const price = priceLabel(m);
          return (
            <Card
              key={m.id} size="sm"
              className="cursor-pointer gap-0 py-0 transition hover:ring-2 hover:ring-ring/50"
              onClick={() => setEditing(m)}
              title="Click pentru a modifica prețul"
            >
              {m.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageUrl}
                  alt={m.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  fără imagine
                </div>
              )}
              <CardContent className="space-y-1 py-2.5">
                {m.decorCode && (
                  <div className="truncate font-medium" title={m.decorCode}>
                    {m.decorCode}
                  </div>
                )}
                <div className="truncate text-xs text-muted-foreground" title={m.name}>
                  {m.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {m.kind} · {m.thicknessMm} mm
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                  <Badge variant="outline">{m.brand ?? 'Manual'}</Badge>
                  {price ? (
                    <span className="text-xs font-medium">{price}</span>
                  ) : (
                    <NoPriceBadge />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Niciun material nu corespunde filtrelor.
        </p>
      )}

      <Dialog open={editing != null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.decorCode || editing?.name || 'Material'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <ModalCloseContext.Provider value={() => setEditing(null)}>
              <ActionForm action={updateMaterialPrice.bind(null, editing.id)} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {editing.name} · {editing.kind} · {editing.thicknessMm} mm · {editing.brand ?? 'Manual'}
                </p>
                <div className="grid gap-1">
                  <Label htmlFor="material-price">
                    Preț ({editing.pricingMode === 'PER_SQM' ? 'lei/m²' : 'lei/foaie'})
                  </Label>
                  <Input
                    id="material-price" name="price" type="number" step="0.01" min="0" autoFocus
                    defaultValue={(editing.pricingMode === 'PER_SQM' ? editing.pricePerSqm : editing.pricePerSheet) ?? ''}
                  />
                </div>
                <SubmitButton>Salvează prețul</SubmitButton>
              </ActionForm>
            </ModalCloseContext.Provider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

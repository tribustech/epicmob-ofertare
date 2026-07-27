'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NumberInput, fieldLabelCls } from '@/components/forms';
import { MaterialPicker, type MaterialPickerItem } from '@/components/MaterialPicker';
import { quickCreateBlatMaterial } from '@/lib/catalog/actions';

export const ASSEMBLY_KIND_OPTIONS = [
  { value: 'FARA_BLAT', label: 'Fără blat (dressing, dulap, rafturi)' },
  { value: 'CU_BLAT', label: 'Cu blat (comodă, baie, living)' },
  { value: 'BUCATARIE', label: 'Bucătărie (blat + corpuri suspendate)' },
] as const;

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

export interface AssemblyKindFieldsProps {
  blatMaterials: MaterialPickerItem[];
  defaults?: {
    kind?: string;
    baseHeightMm?: number | null;
    blatMaterialId?: string | null;
    blatDepthMm?: number | null;
    upperHeightMm?: number | null;
  };
}

/** Dropdown „Tip ansamblu" + câmpurile de blat, afișate condiționat de tip. Câmpurile numite
 *  se trimit prin ActionForm-ul părinte; mini-formularul de quick-create NU are `name`, ca să
 *  nu polueze submit-ul ansamblului. */
export function AssemblyKindFields({ blatMaterials, defaults }: AssemblyKindFieldsProps) {
  const [kind, setKind] = useState(defaults?.kind ?? 'FARA_BLAT');
  const [materialId, setMaterialId] = useState(defaults?.blatMaterialId ?? '');
  const [created, setCreated] = useState<MaterialPickerItem[]>([]);
  const materials = [...blatMaterials, ...created];

  // quick-create blat nou (inline, nu modal imbricat)
  const [adding, setAdding] = useState(false);
  const [nc, setNc] = useState({ name: '', thicknessMm: '', sheetLengthMm: '2800', sheetWidthMm: '2070', pricePerSheet: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasBlat = kind === 'CU_BLAT' || kind === 'BUCATARIE';

  const submitNew = () => {
    setError(null);
    startTransition(async () => {
      const res = await quickCreateBlatMaterial({
        name: nc.name,
        thicknessMm: Number(nc.thicknessMm),
        sheetLengthMm: Number(nc.sheetLengthMm),
        sheetWidthMm: Number(nc.sheetWidthMm),
        pricePerSheet: Number(nc.pricePerSheet),
      });
      if (res.error || !res.id) { setError(res.error ?? 'Nu s-a putut crea blatul'); return; }
      setCreated((prev) => [...prev, {
        id: res.id!, name: nc.name.trim(), kind: 'PAL', category: 'BLAT',
        thicknessMm: Number(nc.thicknessMm), sheetLengthMm: Number(nc.sheetLengthMm),
        sheetWidthMm: Number(nc.sheetWidthMm), pricePerSheet: Number(nc.pricePerSheet),
        pricePerSqm: null, pricingMode: 'PER_SHEET', brand: null, imageUrl: null, decorCode: null, active: true,
      } as MaterialPickerItem]);
      setMaterialId(res.id);
      setAdding(false);
      setNc({ name: '', thicknessMm: '', sheetLengthMm: '2800', sheetWidthMm: '2070', pricePerSheet: '' });
    });
  };

  return (
    <>
      <div className="grid gap-1 sm:col-span-2">
        <Label htmlFor="kind" className={fieldLabelCls}>Tip ansamblu</Label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={selectCls}>
          {ASSEMBLY_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      {hasBlat && (
        <>
          <NumberInput name="baseHeightMm" label="Înălțime corpuri bază (mm)" defaultValue={defaults?.baseHeightMm ?? 900} step="1" />
          <NumberInput name="blatDepthMm" label="Adâncime blat (mm)" defaultValue={defaults?.blatDepthMm ?? 600} step="1" />
          <div className="grid gap-1.5 sm:col-span-2">
            <input type="hidden" name="blatMaterialId" value={materialId} />
            <MaterialPicker label="Material blat" value={materialId} onChange={setMaterialId} materials={materials} allowEmpty />
            {!adding && (
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setAdding(true)}>
                + Adaugă blat nou
              </Button>
            )}
            {adding && (
              <div className="mt-1 grid gap-2 rounded-xl border border-dashed p-3 sm:grid-cols-2">
                <div className="grid gap-1 sm:col-span-2">
                  <Label className={fieldLabelCls}>Denumire</Label>
                  <Input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Blat …" />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Grosime (mm)</Label>
                  <Input type="number" step="1" value={nc.thicknessMm} onChange={(e) => setNc({ ...nc, thicknessMm: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Preț / placă (lei)</Label>
                  <Input type="number" step="0.01" value={nc.pricePerSheet} onChange={(e) => setNc({ ...nc, pricePerSheet: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Placă — lungime (mm)</Label>
                  <Input type="number" step="1" value={nc.sheetLengthMm} onChange={(e) => setNc({ ...nc, sheetLengthMm: e.target.value })} />
                </div>
                <div className="grid gap-1">
                  <Label className={fieldLabelCls}>Placă — lățime (mm)</Label>
                  <Input type="number" step="1" value={nc.sheetWidthMm} onChange={(e) => setNc({ ...nc, sheetWidthMm: e.target.value })} />
                </div>
                {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="button" size="sm" onClick={submitNew} disabled={pending}>
                    {pending ? 'Se creează…' : 'Creează și selectează'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); setError(null); }}>Renunță</Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {kind === 'BUCATARIE' && (
        <NumberInput name="upperHeightMm" label="Înălțime corpuri suspendate (mm)" defaultValue={defaults?.upperHeightMm ?? null} step="1" required={false} />
      )}
    </>
  );
}

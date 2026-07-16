'use client';

import { useState } from 'react';
import { computeBlat } from '@/lib/engine';
import type { BoardMaterial } from '@/lib/engine';
import type { FormState } from '@/lib/forms/form-action';
import { fmtLei, fmtNum } from '@/lib/format';
import { ActionForm } from '@/components/ActionForm';
import { SubmitButton, fieldLabelCls } from '@/components/forms';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export interface BlatMaterialOption {
  id: string;
  label: string;
  sheetLengthMm: number;
  sheetWidthMm: number;
  thicknessMm: number;
  pricingMode: 'PER_SHEET' | 'PER_SQM';
  pricePerSheet: number | null;
  pricePerSqm: number | null;
}

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function toBoardMaterial(m: BlatMaterialOption): BoardMaterial {
  return {
    id: m.id, name: m.label, kind: 'PAL', thicknessMm: m.thicknessMm,
    sheetLengthMm: m.sheetLengthMm, sheetWidthMm: m.sheetWidthMm,
    pricing: m.pricingMode === 'PER_SHEET'
      ? { mode: 'PER_SHEET', pricePerSheet: m.pricePerSheet ?? 0 }
      : { mode: 'PER_SQM', pricePerSqm: m.pricePerSqm ?? 0 },
  };
}

export function BlatEditorForm(props: {
  initial: { label: string; widthMm: string; depthMm: string; blatMaterialId: string; manualPieces: string };
  materials: BlatMaterialOption[];
  cutPricePerPiece: number;
  save: (fd: FormData) => Promise<FormState>;
}) {
  const [label, setLabel] = useState(props.initial.label);
  const [widthMm, setWidthMm] = useState(props.initial.widthMm);
  const [depthMm, setDepthMm] = useState(props.initial.depthMm);
  const [blatMaterialId, setBlatMaterialId] = useState(props.initial.blatMaterialId);
  const [manualPieces, setManualPieces] = useState(props.initial.manualPieces);

  const material = props.materials.find((m) => m.id === blatMaterialId);
  const w = Number(widthMm);
  const d = Number(depthMm);
  const canCompute = material && w > 0 && d > 0;
  const overDepth = !!material && d > 0 && d > material.sheetWidthMm;

  const result = canCompute
    ? computeBlat({
        label: label || 'Blat',
        lengthMm: w,
        depthMm: d,
        material: toBoardMaterial(material),
        manualPieces: manualPieces ? Number(manualPieces) : undefined,
        cutPricePerPiece: props.cutPricePerPiece,
      })
    : null;

  return (
    <ActionForm action={props.save} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 grid gap-1">
          <Label htmlFor="label" className={fieldLabelCls}>Etichetă</Label>
          <Input id="label" name="label" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="widthMm" className={fieldLabelCls}>Lungime (mm)</Label>
          <Input id="widthMm" name="widthMm" type="number" step="1" min="0" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="depthMm" className={fieldLabelCls}>Adâncime (mm)</Label>
          <Input id="depthMm" name="depthMm" type="number" step="1" min="0" value={depthMm} onChange={(e) => setDepthMm(e.target.value)} required />
        </div>
        <div className="col-span-2 grid gap-1">
          <Label htmlFor="blatMaterialId" className={fieldLabelCls}>Material blat</Label>
          <select id="blatMaterialId" name="blatMaterialId" value={blatMaterialId} onChange={(e) => setBlatMaterialId(e.target.value)} className={selectCls} required>
            <option value="">— alege —</option>
            {props.materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · placă {fmtNum(m.sheetLengthMm, 0)}×{fmtNum(m.sheetWidthMm, 0)}
              </option>
            ))}
          </select>
        </div>
        {overDepth && (
          <div className="grid gap-1">
            <Label htmlFor="manualPieces" className={fieldLabelCls}>Număr plăci (manual)</Label>
            <Input id="manualPieces" name="manualPieces" type="number" step="1" min="1" value={manualPieces} onChange={(e) => setManualPieces(e.target.value)} />
          </div>
        )}
        {/* când adâncimea încape, nr. de plăci e automat — trimitem gol ca schema să-l ignore */}
        {!overDepth && <input type="hidden" name="manualPieces" value="" />}
      </div>

      {props.materials.length === 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertDescription>
            Nu există materiale de blat în catalog — adaugă un material cu categoria „Blat" în{' '}
            <span className="font-medium">Cataloage → Materiale</span>.
          </AlertDescription>
        </Alert>
      )}

      {overDepth && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-800">
          <AlertDescription>
            ⚠ Adâncimea ({fmtNum(d, 0)} mm) depășește lățimea plăcii ({fmtNum(material!.sheetWidthMm, 0)} mm) —
            blaturile nu se îmbină pe adâncime. Introdu manual numărul de plăci.
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <Card size="sm" className="bg-muted/40">
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Plăci necesare</div>
              <div className="text-lg font-semibold">{result.pieces} {result.pieces === 1 ? 'placă' : 'plăci'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Grosime</div>
              <div className="text-lg font-semibold">{fmtNum(material!.thicknessMm, 0)} mm</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cost plăci</div>
              <div className="text-lg font-semibold">{fmtLei(result.boardCost)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Debitare ({fmtNum(props.cutPricePerPiece, 0)} lei/placă)</div>
              <div className="text-lg font-semibold">{fmtLei(result.cuttingCost)}</div>
            </div>
          </CardContent>
        </Card>
      )}

      <SubmitButton>Salvează blatul</SubmitButton>
    </ActionForm>
  );
}

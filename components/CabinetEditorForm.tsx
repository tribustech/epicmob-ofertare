'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cabinetFormSchema, toCabinetInput } from '@/lib/quote/cabinet-form';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { estimateCabinetCost } from '@/lib/quote/estimate';
import type { SnapshotData } from '@/lib/quote/compute';
import { expandCabinet } from '@/lib/engine';
import type { HardwareLine, Part, Warning } from '@/lib/engine';
import { parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import type { FormState } from '@/lib/forms/form-action';
import { fmtLei, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type FieldOption = { value: string; label: string };

const TYPE_OPTIONS: FieldOption[] = [
  { value: 'BAZA', label: 'Corp bază' },
  { value: 'SUSPENDAT', label: 'Corp suspendat' },
  { value: 'INALT', label: 'Corp înalt' },
  { value: 'COLT', label: 'Corp de colț' },
];

const FRONT_TYPE_OPTIONS: FieldOption[] = [
  { value: 'USI', label: 'Uși' },
  { value: 'SERTARE', label: 'Sertare' },
  { value: 'FARA', label: 'Fără front' },
];

const DOOR_SPLIT_WIDTH_MM = 600; // convenția atelierului: peste 600mm → 2 uși

const DRAWER_SYSTEM_OPTIONS: FieldOption[] = [
  { value: 'METAL_BOX', label: 'Blum (laterale metalice)' },
  { value: 'PAL_BOX', label: 'Cutie din PAL' },
];

const BACK_MOUNT_OPTIONS: FieldOption[] = [
  { value: 'FALT', label: 'În falț' },
  { value: 'APLICAT', label: 'Aplicat' },
];

export interface CabinetEditorFormProps {
  cabinetId: string;
  initial: Record<string, string>;
  snapshot: SnapshotData;
  laborPct: number;
  yieldFactor: number;
  legHeightMm: number | null;
  materialOptions: {
    carcass: FieldOption[];
    front: FieldOption[];
    back: FieldOption[];
    drawersBottom: FieldOption[];
  };
  bandOptions: {
    carcassFront: FieldOption[];
    frontPerimeter: FieldOption[];
  };
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
  save: (data: Record<string, string>) => Promise<FormState>;
}

export function CabinetEditorForm(props: CabinetEditorFormProps) {
  const {
    initial, snapshot, laborPct, yieldFactor, legHeightMm,
    materialOptions, bandOptions, hardwareOverrides, extraParts, save,
  } = props;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>({});

  const set = (field: string, value: string) => setValues((v) => ({ ...v, [field]: value }));

  const parsed = useMemo(() => cabinetFormSchema.safeParse(values), [values]);

  const catalogs = useMemo(
    () => toCostCatalogs(snapshot.materials, snapshot.edgeBands, snapshot.hardware, snapshot.cuttingRates),
    [snapshot],
  );
  const cc = useMemo(() => parseConstruction(snapshot.settings.constructionJson), [snapshot]);

  const frontType = values.frontType;
  const withShelves = values.withShelves === 'true';
  const drawersCount = Math.max(0, Math.trunc(Number(values.drawersCount) || 0));

  const autoDoors = (widthMm: number) => (widthMm <= DOOR_SPLIT_WIDTH_MM ? 1 : 2);
  // ușile se precompletează după lățime cât timp utilizatorul nu le-a atins
  const [doorsTouched, setDoorsTouched] = useState(
    () => Number(initial.doors) !== autoDoors(Number(initial.widthMm)),
  );
  const onWidthChange = (v: string) => {
    setValues((prev) => ({
      ...prev, widthMm: v,
      ...(prev.frontType === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(v))) } : {}),
    }));
  };

  const equalHeights = (heightMm: number, n: number) => {
    const usable = heightMm - 2 * cc.outerGapMm - (n - 1) * cc.frontGapMm;
    return Array.from({ length: n }, () => Math.round((usable / n) * 10) / 10);
  };
  const drawerHeights = (values.drawerFrontHeightsMm ?? '')
    .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  const onDrawersCountChange = (v: string) => {
    const n = Math.max(0, Math.trunc(Number(v) || 0));
    setValues((prev) => ({
      ...prev, drawersCount: v,
      drawerFrontHeightsMm: n > 0 ? equalHeights(Number(prev.heightMm), n).join(', ') : '',
    }));
  };
  const setDrawerHeight = (i: number, v: string) => {
    const next = [...drawerHeights];
    next[i] = Number(v);
    set('drawerFrontHeightsMm', next.join(', '));
  };
  const usableDrawerH = Number(values.heightMm) - 2 * cc.outerGapMm - (drawersCount - 1) * cc.frontGapMm;
  const drawerSum = drawerHeights.reduce((a, b) => a + b, 0);
  const drawerSumMismatch = drawersCount > 0 && drawerHeights.length === drawersCount
    && Math.abs(drawerSum - usableDrawerH) > 1;

  const live = useMemo(() => {
    if (!parsed.success) return null;
    const input = toCabinetInput(parsed.data);
    let parts: Part[] = [];
    let warnings: Warning[] = [];
    let expandError: string | null = null;
    try {
      const expanded = expandCabinet(input, catalogs, cc);
      parts = expanded.parts;
      warnings = expanded.warnings;
    } catch (e) {
      expandError = e instanceof Error ? e.message : 'Eroare la generarea pieselor';
    }
    const estimate = estimateCabinetCost({ input, hardwareOverrides, extraParts }, snapshot, { laborPct, yieldFactor, legHeightMm });
    return { input, parts, warnings, expandError, estimate };
  }, [parsed, catalogs, cc, hardwareOverrides, extraParts, snapshot, laborPct, yieldFactor, legHeightMm]);

  const [lastPrice, setLastPrice] = useState<{ cost: number; sell: number } | null>(() =>
    live && !live.expandError && !live.estimate.error ? { cost: live.estimate.cost, sell: live.estimate.sell } : null,
  );

  useEffect(() => {
    if (live && !live.expandError && !live.estimate.error) {
      setLastPrice({ cost: live.estimate.cost, sell: live.estimate.sell });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const invalid = !parsed.success;
  const displayPrice = live && !live.expandError && !live.estimate.error
    ? { cost: live.estimate.cost, sell: live.estimate.sell }
    : lastPrice;

  const materialName = (mid: string) => snapshot.materials.find((m) => m.id === mid)?.name ?? mid;
  const bandName = (bid?: string) => (bid ? (snapshot.edgeBands.find((e) => e.id === bid)?.name ?? bid) : '');

  function handleSave() {
    startTransition(async () => {
      const result = await save(values);
      setFormState(result);
      if (!result.error) router.refresh();
    });
  }

  const type = values.type;
  const isColt = type === 'COLT';
  const backEnabled = values.backEnabled === 'true';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Identificare și dimensiuni</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <Label htmlFor="label">Etichetă</Label>
              <Input id="label" value={values.label} onChange={(e) => set('label', e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Tip corp</Label>
              <RadioGroup value={type} onValueChange={(v) => set('type', v)} className="flex flex-wrap gap-4">
                {TYPE_OPTIONS.map((o) => (
                  <div key={o.value} className="flex items-center gap-2">
                    <RadioGroupItem value={o.value} id={`type-${o.value}`} />
                    <Label htmlFor={`type-${o.value}`} className="font-normal">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Lățime L (mm)" value={values.widthMm} onChange={onWidthChange} />
              <NumField label="Înălțime H (mm)" value={values.heightMm} onChange={(v) => set('heightMm', v)} />
              <NumField label="Adâncime A (mm)" value={values.depthMm} onChange={(v) => set('depthMm', v)} />
              {isColt && (
                <NumField label="Panou orb (mm)" value={values.blindPanelWidthMm} onChange={(v) => set('blindPanelWidthMm', v)} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Materiale și canturi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label="Material carcasă" value={values.carcassMaterialId} onChange={(v) => set('carcassMaterialId', v)} options={materialOptions.carcass} />
            <SelectField label="Material fronturi" value={values.frontMaterialId} onChange={(v) => set('frontMaterialId', v)} options={materialOptions.front} allowEmpty />
            <SelectField label="Cant carcasă" value={values.carcassFrontEdgeId} onChange={(v) => set('carcassFrontEdgeId', v)} options={bandOptions.carcassFront} />
            <SelectField label="Cant fronturi" value={values.frontPerimeterId} onChange={(v) => set('frontPerimeterId', v)} options={bandOptions.frontPerimeter} allowEmpty />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fronturi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={frontType}
              onValueChange={(v) => setValues((prev) => ({
                ...prev, frontType: v,
                ...(v === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(prev.widthMm))) } : {}),
                ...(v === 'SERTARE' && drawersCount === 0
                  ? { drawersCount: '3', drawerFrontHeightsMm: equalHeights(Number(prev.heightMm), 3).join(', ') }
                  : {}),
              }))}
              className="flex flex-wrap gap-4"
            >
              {FRONT_TYPE_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-2">
                  <RadioGroupItem value={o.value} id={`front-${o.value}`} />
                  <Label htmlFor={`front-${o.value}`} className="font-normal">{o.label}</Label>
                </div>
              ))}
            </RadioGroup>

            {frontType === 'USI' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Uși" value={values.doors} onChange={(v) => { setDoorsTouched(true); set('doors', v); }} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="withShelves"
                    checked={withShelves}
                    onCheckedChange={(c) => set('withShelves', c === true ? 'true' : 'false')}
                  />
                  <Label htmlFor="withShelves" className="font-normal">Cu polițe (debifează la corpul de chiuvetă)</Label>
                </div>
                {withShelves && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Convenție atelier: până în 600mm lățime → 1 ușă; peste → 2 uși.
                </p>
              </div>
            )}

            {frontType === 'SERTARE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Nr. sertare" value={values.drawersCount} onChange={onDrawersCountChange} />
                  <SelectField label="Sistem sertare" value={values.drawersSystem} onChange={(v) => set('drawersSystem', v)} options={DRAWER_SYSTEM_OPTIONS} />
                  <SelectField label="Fund sertare" value={values.drawersBottomMaterialId} onChange={(v) => set('drawersBottomMaterialId', v)} options={materialOptions.drawersBottom} allowEmpty />
                </div>
                {drawersCount > 0 && (
                  <div className="space-y-2">
                    {Array.from({ length: drawersCount }, (_, i) => (
                      <div key={i} className="grid grid-cols-2 items-center gap-3">
                        <Label className="font-normal">{i === 0 ? 'Sertar 1 (sus)' : `Sertar ${i + 1}`}</Label>
                        <NumField label="Înălțime front (mm)" value={String(drawerHeights[i] ?? '')} onChange={(v) => setDrawerHeight(i, v)} />
                      </div>
                    ))}
                    {drawerSumMismatch && (
                      <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                        ⚠ Suma fronturilor ({fmtNum(drawerSum, 1)}mm) nu se încadrează — util {fmtNum(usableDrawerH, 1)}mm
                        (înălțime corp minus rosturi).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {frontType === 'FARA' && (
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Spate</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="backEnabled"
                checked={backEnabled}
                onCheckedChange={(c) => set('backEnabled', c === true ? 'true' : 'false')}
              />
              <Label htmlFor="backEnabled" className="font-normal">Cu spate</Label>
            </div>
            {backEnabled && (
              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Material spate" value={values.backMaterialId} onChange={(v) => set('backMaterialId', v)} options={materialOptions.back} allowEmpty />
                <SelectField label="Montaj spate" value={values.backMount} onChange={(v) => set('backMount', v)} options={BACK_MOUNT_OPTIONS} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? 'Se salvează…' : 'Salvează corpul'}
          </Button>
          {formState.error && (
            <Alert variant="destructive"><AlertDescription>{formState.error}</AlertDescription></Alert>
          )}
          {invalid && !parsed.success && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {parsed.error.issues.map((issue, i) => <li key={i}>{issue.message}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Preț estimativ</CardTitle>
              {invalid && <Badge variant="outline" className="border-amber-500 text-amber-700">valori invalide</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {displayPrice ? (
              <div className="grid grid-cols-2 gap-2">
                <Card size="sm">
                  <CardContent>
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="text-2xl font-bold">{fmtLei(displayPrice.cost)}</div>
                  </CardContent>
                </Card>
                <Card size="sm">
                  <CardContent>
                    <div className="text-xs text-muted-foreground">Preț vânzare</div>
                    <div className="text-2xl font-bold">{fmtLei(displayPrice.sell)}</div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Fără preț disponibil încă.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Estimativ — prețul final rotunjește foile pe proiect.
            </p>
            {live?.estimate.error && (
              <Alert variant="destructive"><AlertDescription>{live.estimate.error}</AlertDescription></Alert>
            )}
          </CardContent>
        </Card>

        {live?.expandError && (
          <Alert variant="destructive"><AlertDescription>{live.expandError}</AlertDescription></Alert>
        )}

        {live && live.warnings.length > 0 && (
          <ul className="space-y-1">
            {live.warnings.map((w, i) => (
              <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">⚠ {w.message}</li>
            ))}
          </ul>
        )}

        <Card>
          <CardHeader><CardTitle>Piese generate</CardTitle></CardHeader>
          <CardContent>
            {live && !live.expandError ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Piesă</TableHead>
                    <TableHead>Dimensiuni (mm)</TableHead>
                    <TableHead>Buc</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Canturi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {live.parts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)}</TableCell>
                      <TableCell>{p.qty}</TableCell>
                      <TableCell>{materialName(p.materialId)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[p.edges.l1, p.edges.l2, p.edges.w1, p.edges.w2].filter(Boolean).map((b) => bandName(b)).join(', ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {live.parts.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-muted-foreground">Nicio piesă.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                {invalid ? 'Corectează formularul pentru a vedea piesele.' : 'Nu se pot genera piese.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input type="number" step="1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function SelectField({ label, value, onChange, options, allowEmpty }: {
  label: string; value: string; onChange: (v: string) => void;
  options: FieldOption[]; allowEmpty?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <select className={selectCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

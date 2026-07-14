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
  { value: 'SERTARE', label: 'Corp cu sertare' },
  { value: 'COLT', label: 'Corp de colț' },
];

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

  const onTypeChange = (type: string) => {
    setValues((v) => ({ ...v, type, ...(type === 'SERTARE' ? { shelves: '0' } : {}) }));
  };

  const parsed = useMemo(() => cabinetFormSchema.safeParse(values), [values]);

  const catalogs = useMemo(
    () => toCostCatalogs(snapshot.materials, snapshot.edgeBands, snapshot.hardware, snapshot.cuttingRates),
    [snapshot],
  );
  const cc = useMemo(() => parseConstruction(snapshot.settings.constructionJson), [snapshot]);

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
  const isSertare = type === 'SERTARE';
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
              <RadioGroup value={type} onValueChange={onTypeChange} className="flex flex-wrap gap-4">
                {TYPE_OPTIONS.map((o) => (
                  <div key={o.value} className="flex items-center gap-2">
                    <RadioGroupItem value={o.value} id={`type-${o.value}`} />
                    <Label htmlFor={`type-${o.value}`} className="font-normal">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Lățime L (mm)" value={values.widthMm} onChange={(v) => set('widthMm', v)} />
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

        {isSertare ? (
          <Card>
            <CardHeader><CardTitle>Sertare</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <NumField label="Nr. sertare" value={values.drawersCount} onChange={(v) => set('drawersCount', v)} />
              <SelectField label="Sistem sertare" value={values.drawersSystem} onChange={(v) => set('drawersSystem', v)} options={DRAWER_SYSTEM_OPTIONS} />
              <SelectField label="Fund sertare" value={values.drawersBottomMaterialId} onChange={(v) => set('drawersBottomMaterialId', v)} options={materialOptions.drawersBottom} allowEmpty />
              <div className="col-span-2 grid gap-1">
                <Label htmlFor="drawerFrontHeightsMm">Înălțimi fronturi sertar (mm, cu virgulă; gol = egale)</Label>
                <Input
                  id="drawerFrontHeightsMm"
                  value={values.drawerFrontHeightsMm}
                  onChange={(e) => set('drawerFrontHeightsMm', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Uși și polițe</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <NumField label="Polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
                <NumField label="Uși" value={values.doors} onChange={(v) => set('doors', v)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Convenție atelier: până în 600mm lățime → 1 ușă; peste → 2 uși. Corpurile suspendate tip hotă se fac cu tipul „Corp suspendat".
              </p>
            </CardContent>
          </Card>
        )}

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

'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cabinetFormSchema, toCabinetInput } from '@/lib/quote/cabinet-form';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { estimateCabinetCost } from '@/lib/quote/estimate';
import type { SnapshotData } from '@/lib/quote/compute';
import { HANDLE_TYPE_OPTIONS, withResolvedHandle } from '@/lib/quote/handle';
import { expandCabinet } from '@/lib/engine';
import type { HandleType, HardwareLine, Part, Warning } from '@/lib/engine';
import { parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import type { FormState } from '@/lib/forms/form-action';
import { fmtLei, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SectionAccordion } from '@/components/ui/section-accordion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { fieldLabelCls } from '@/components/forms';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CabinetIsoSvg } from '@/components/CabinetIsoSvg';
import { MaterialPicker } from '@/components/MaterialPicker';
import { materialHasNoPrice } from '@/lib/quote/material-price';

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

const MOUNT_OPTIONS: FieldOption[] = [
  { value: 'INCADRAT', label: 'Încadrat (între laterale)' },
  { value: 'APLICAT', label: 'Aplicat (peste laterale)' },
];

const DRAWER_SYSTEM_OPTIONS: FieldOption[] = [
  { value: 'TANDEMBOX', label: 'Tandembox (sertar metalic complet)' },
  { value: 'PAL_BOX', label: 'Cutie PAL + glisiere Tandem' },
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
  bandOptions: {
    carcassFront: FieldOption[];
    frontPerimeter: FieldOption[];
  };
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
  feronerieSlot: ReactNode;
  feronerieSummary: string;
  extraPartsSlot: ReactNode;
  extraPartsSummary: string;
  projectHandle: { type: string; itemId: string | null; label: string };
  hardwareSelOptions: {
    hinges: FieldOption[];
    slides: FieldOption[];
    tandemboxHeights: number[];
    handleItems: FieldOption[];
    pushItems: FieldOption[];
    defaultHingeName: string | null;
  };
  save: (data: Record<string, string>) => Promise<FormState>;
}

export function CabinetEditorForm(props: CabinetEditorFormProps) {
  const {
    initial, snapshot, laborPct, yieldFactor, legHeightMm,
    bandOptions, hardwareOverrides, extraParts,
    feronerieSlot, feronerieSummary, extraPartsSlot, extraPartsSummary,
    projectHandle, hardwareSelOptions, save,
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
    () => initial.frontType === 'USI' && Number(initial.doors) !== autoDoors(Number(initial.widthMm)),
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
  const minDrawerFrontH = drawersCount > 0 && drawerHeights.length === drawersCount
    ? Math.min(...drawerHeights) : null;
  const noTandemboxFits = values.drawersSystem === 'TANDEMBOX' && minDrawerFrontH !== null
    && hardwareSelOptions.tandemboxHeights.length > 0
    && hardwareSelOptions.tandemboxHeights.every((h) => h > minDrawerFrontH - cc.tandemboxFrontClearanceMm);

  const live = useMemo(() => {
    if (!parsed.success) return null;
    const input = withResolvedHandle(
      toCabinetInput(parsed.data),
      { type: projectHandle.type as HandleType, itemId: projectHandle.itemId },
    );
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
    const estimate = estimateCabinetCost({ input, hardwareOverrides, extraParts }, snapshot, {
      laborPct, yieldFactor, legHeightMm,
      projectHandle: { type: projectHandle.type as HandleType, itemId: projectHandle.itemId },
    });
    return { input, parts, warnings, expandError, estimate };
  }, [parsed, catalogs, cc, hardwareOverrides, extraParts, snapshot, laborPct, yieldFactor, legHeightMm, projectHandle]);

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

  const pickerMaterials = useMemo(() => snapshot.materials.filter((m) => m.category !== 'BLAT'), [snapshot]);

  const noPriceMaterials = useMemo(() => {
    const ids = [values.carcassMaterialId, values.frontMaterialId, values.backMaterialId, values.drawersBottomMaterialId, ...extraParts.map((p) => p.materialId)];
    const seen = new Set<string>();
    const names: string[] = [];
    for (const id of ids) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const m = snapshot.materials.find((x) => x.id === id);
      if (m && materialHasNoPrice(m)) names.push(m.name);
    }
    return names;
  }, [values.carcassMaterialId, values.frontMaterialId, values.backMaterialId, values.drawersBottomMaterialId, extraParts, snapshot]);

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

  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(['dimensiuni']));
  const toggleSection = (id: string) => setOpenSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const typeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
  const dimSummary = `${values.label} · ${typeLabel} · ${values.widthMm} × ${values.heightMm} × ${values.depthMm}`;
  const matSummary = [materialName(values.carcassMaterialId), bandName(values.carcassFrontEdgeId)]
    .filter(Boolean).join(' · ') || '—';
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const handleSummary = values.handleMode === 'PROIECT' ? 'mâner ca proiectul' : 'mâner pe corp';
  const frontSummary =
    frontType === 'USI'
      ? [
          `Uși · ${plural(Number(values.doors) || 0, 'ușă', 'uși')}`,
          withShelves ? plural(Number(values.shelves) || 0, 'poliță', 'polițe') : null,
          handleSummary,
        ].filter(Boolean).join(' · ')
      : frontType === 'SERTARE'
        ? `Sertare · ${plural(drawersCount, 'sertar', 'sertare')} · ${handleSummary}`
        : `Fără front · ${plural(Number(values.shelves) || 0, 'poliță', 'polițe')}`;
  const backSummary = backEnabled
    ? ['Cu spate', values.backMaterialId ? materialName(values.backMaterialId) : null,
       BACK_MOUNT_OPTIONS.find((o) => o.value === values.backMount)?.label.toLowerCase() ?? null]
        .filter(Boolean).join(' · ')
    : 'Fără spate';

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="flex flex-col gap-3">
        <SectionAccordion title="Identificare și dimensiuni" summary={dimSummary}
          open={openSections.has('dimensiuni')} onToggle={() => toggleSection('dimensiuni')}>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="label" className={fieldLabelCls}>Etichetă</Label>
              <Input id="label" value={values.label} onChange={(e) => set('label', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label className={fieldLabelCls}>Tip corp</Label>
              <SegmentedControl value={type} onChange={(v) => set('type', v)} options={TYPE_OPTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Lățime L (mm)" value={values.widthMm} onChange={onWidthChange} />
              <NumField label="Înălțime H (mm)" value={values.heightMm} onChange={(v) => set('heightMm', v)} />
              <NumField label="Adâncime A (mm)" value={values.depthMm} onChange={(v) => set('depthMm', v)} />
              {isColt && (
                <NumField label="Panou orb (mm)" value={values.blindPanelWidthMm} onChange={(v) => set('blindPanelWidthMm', v)} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Blat corp (sus)" value={values.mountTop} onChange={(v) => set('mountTop', v)} options={MOUNT_OPTIONS} />
              <SelectField label="Fund corp (jos)" value={values.mountBottom} onChange={(v) => set('mountBottom', v)} options={MOUNT_OPTIONS} />
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion title="Materiale și canturi" summary={matSummary}
          open={openSections.has('materiale')} onToggle={() => toggleSection('materiale')}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MaterialPicker label="Material carcasă" value={values.carcassMaterialId} onChange={(v) => set('carcassMaterialId', v)} materials={pickerMaterials} />
              <MaterialPicker label="Material fronturi" value={values.frontMaterialId} onChange={(v) => set('frontMaterialId', v)} materials={pickerMaterials} allowEmpty />
              <SelectField label="Cant carcasă" value={values.carcassFrontEdgeId} onChange={(v) => set('carcassFrontEdgeId', v)} options={bandOptions.carcassFront} />
              <SelectField label="Cant fronturi" value={values.frontPerimeterId} onChange={(v) => set('frontPerimeterId', v)} options={bandOptions.frontPerimeter} allowEmpty />
            </div>
            {noPriceMaterials.length > 0 && (
              <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                Materiale fără preț: {noPriceMaterials.join(', ')} — apar cu 0 lei în ofertă.
              </p>
            )}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Fronturi" summary={frontSummary}
          open={openSections.has('fronturi')} onToggle={() => toggleSection('fronturi')}>
          <div className="space-y-4">
            <SegmentedControl
              value={frontType}
              onChange={(v) => setValues((prev) => ({
                ...prev, frontType: v,
                ...(v === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(prev.widthMm))) } : {}),
                ...(v === 'SERTARE' && drawersCount === 0
                  ? { drawersCount: '3', drawerFrontHeightsMm: equalHeights(Number(prev.heightMm), 3).join(', ') }
                  : {}),
              }))}
              options={FRONT_TYPE_OPTIONS}
            />
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
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Model balamale" value={values.hingeId} onChange={(v) => set('hingeId', v)} options={hardwareSelOptions.hinges} allowEmpty />
                </div>
                <p className="text-xs text-muted-foreground">
                  {values.hingeId
                    ? 'Balamale alese pe corp; numărul rămâne calculat automat.'
                    : `Balamale: ${hardwareSelOptions.defaultHingeName ?? 'default global nesetat'} — default din Setări; numărul se calculează automat.`}
                </p>
              </div>
            )}

            {frontType === 'SERTARE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Nr. sertare" value={values.drawersCount} onChange={onDrawersCountChange} />
                  <SelectField label="Sistem sertare" value={values.drawersSystem} onChange={(v) => set('drawersSystem', v)} options={DRAWER_SYSTEM_OPTIONS} />
                  {values.drawersSystem === 'PAL_BOX' && (
                    <MaterialPicker label="Fund sertare" value={values.drawersBottomMaterialId} onChange={(v) => set('drawersBottomMaterialId', v)} materials={pickerMaterials} allowEmpty />
                  )}
                </div>
                {values.drawersSystem === 'PAL_BOX' && (
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Model glisiere" value={values.slideId} onChange={(v) => set('slideId', v)} options={hardwareSelOptions.slides} allowEmpty />
                  </div>
                )}
                {values.drawersSystem === 'TANDEMBOX' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className={fieldLabelCls}>Înălțime laterală (mm)</Label>
                        <select className={selectCls} value={values.tandemboxHeightMm ?? ''} onChange={(e) => set('tandemboxHeightMm', e.target.value)}>
                          <option value="">— alege —</option>
                          {hardwareSelOptions.tandemboxHeights.map((h) => {
                            const fits = minDrawerFrontH === null || h <= minDrawerFrontH - cc.tandemboxFrontClearanceMm;
                            return (
                              <option key={h} value={h} disabled={!fits}>
                                {h}mm{fits ? '' : ` — nu încape (front min. ${fmtNum(minDrawerFrontH ?? 0, 0)}mm)`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sertar metalic complet — nu se debitează nimic. Adâncimea nominală se alege automat; rezervă front {fmtNum(cc.tandemboxFrontClearanceMm, 0)}mm (Setări).
                    </p>
                    {noTandemboxFits && (
                      <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                        ⚠ Nicio înălțime de laterală nu încape în fronturile configurate.
                      </p>
                    )}
                  </div>
                )}
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

            {frontType !== 'FARA' && (
              <div className="space-y-2 border-t pt-3">
                <Label className={fieldLabelCls}>Mâner</Label>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Tip"
                    value={values.handleMode === 'PROIECT' ? '' : values.handleType}
                    onChange={(v) => setValues((prev) => ({
                      ...prev,
                      handleMode: v === '' ? 'PROIECT' : 'CUSTOM',
                      ...(v !== '' ? { handleType: v } : {}),
                      ...(v === 'FARA' && !prev.frontExtensionMm
                        ? { frontExtensionMm: String(cc.frontExtensionDefaultMm) } : {}),
                    }))}
                    options={[{ value: '', label: `Ca proiectul (${projectHandle.label})` },
                      ...HANDLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                  />
                  {values.handleMode === 'CUSTOM' && ['APLICAT', 'BUTON', 'INGROPAT'].includes(values.handleType) && (
                    <SelectField label="Produs" value={values.handleItemId} onChange={(v) => set('handleItemId', v)} options={hardwareSelOptions.handleItems} allowEmpty />
                  )}
                  {values.handleMode === 'CUSTOM' && values.handleType === 'PUSH' && (
                    <SelectField label="Mecanism (uși)" value={values.handleItemId} onChange={(v) => set('handleItemId', v)} options={hardwareSelOptions.pushItems} allowEmpty />
                  )}
                  {values.handleMode === 'CUSTOM' && values.handleType === 'FARA' && (
                    <NumField label="Prelungire front (mm)" value={values.frontExtensionMm} onChange={(v) => set('frontExtensionMm', v)} />
                  )}
                </div>
                {values.handleMode === 'CUSTOM' && values.handleType === 'GOLA' && (
                  <p className="text-xs text-muted-foreground">
                    GOLA: fronturile se scurtează cu {fmtNum(cc.golaFrontDeductMm, 0)}mm, profil {'≈'}{fmtNum(Number(values.widthMm) / 1000, 2)}ml — valori din Setări.
                  </p>
                )}
                {values.handleMode === 'CUSTOM' && values.handleType === 'FARA' && (
                  <p className="text-xs text-muted-foreground">
                    Front prelungit în jos (default {fmtNum(cc.frontExtensionDefaultMm, 0)}mm din Setări) — util la corpurile suspendate.
                  </p>
                )}
              </div>
            )}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Spate" summary={backSummary}
          open={openSections.has('spate')} onToggle={() => toggleSection('spate')}>
          <div className="space-y-3">
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
                <MaterialPicker label="Material spate" value={values.backMaterialId} onChange={(v) => set('backMaterialId', v)} materials={pickerMaterials} allowEmpty />
                <SelectField label="Montaj spate" value={values.backMount} onChange={(v) => set('backMount', v)} options={BACK_MOUNT_OPTIONS} />
              </div>
            )}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Feronerie" summary={feronerieSummary}
          open={openSections.has('feronerie')} onToggle={() => toggleSection('feronerie')}>
          {feronerieSlot}
        </SectionAccordion>

        <SectionAccordion title="Piese suplimentare" summary={extraPartsSummary}
          open={openSections.has('suplimentare')} onToggle={() => toggleSection('suplimentare')}>
          {extraPartsSlot}
        </SectionAccordion>

        <div className="mt-1.5 space-y-2">
          <Button onClick={handleSave} disabled={isPending} size="lg">
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

      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-[15px] font-bold">Preț estimativ</div>
            {invalid && <Badge variant="outline" className="border-amber-500 text-amber-700">valori invalide</Badge>}
          </div>
          {displayPrice ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#ececea] bg-[#fafaf8] px-4 py-3.5">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">Cost</div>
                <div className="font-mono text-[22px] font-semibold tracking-tight">{fmtLei(displayPrice.cost)}</div>
              </div>
              <div className="rounded-lg border border-accent-blue-border bg-accent-blue px-4 py-3.5">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-blue-foreground">Preț vânzare</div>
                <div className="font-mono text-[22px] font-semibold tracking-tight text-accent-blue-foreground">{fmtLei(displayPrice.sell)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Fără preț disponibil încă.</p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Estimativ — prețul final rotunjește foile pe proiect.</p>
          {live?.estimate.error && (
            <Alert variant="destructive" className="mt-3"><AlertDescription>{live.estimate.error}</AlertDescription></Alert>
          )}
        </div>

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

        <div className="rounded-xl bg-card p-5 ring-1 ring-border">
          <div className="mb-3 text-[15px] font-bold">Piese generate</div>
          {live && !live.expandError ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Piesă</TableHead>
                  <TableHead>Dim. (mm)</TableHead>
                  <TableHead>Buc</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Canturi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {live.parts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs">{fmtNum(p.lengthMm, 1)}×{fmtNum(p.widthMm, 1)}</TableCell>
                    <TableCell className="font-mono">{p.qty}</TableCell>
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
        </div>

        {live && !live.expandError && (
          <div className="rounded-xl bg-card p-5 ring-1 ring-border">
            <div className="mb-1 text-[15px] font-bold">Previzualizare</div>
            <CabinetIsoSvg input={live.input} cc={cc} />
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <Input type="number" step="1" value={value ?? ''} onChange={(e) => onChange(e.target.value)} className="font-mono" />
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
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <select className={selectCls} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

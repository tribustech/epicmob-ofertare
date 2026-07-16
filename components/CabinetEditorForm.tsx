'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cabinetFormSchema, toCabinetInput } from '@/lib/quote/cabinet-form';
import type { ExtraPart } from '@/lib/quote/cabinet-form';
import { estimateCabinetCost } from '@/lib/quote/estimate';
import { frontCatalogsFromSnapshot, type SnapshotData } from '@/lib/quote/compute';
import { HANDLE_TYPE_OPTIONS, withResolvedHandle } from '@/lib/quote/handle';
import { expandCabinet, resolveSuggestions } from '@/lib/engine';
import type {
  HandleType, HardwareAdjustments, HardwareLine, HardwareSlot, HardwareSuggestion,
  Part, ResolvedSlot, Warning,
} from '@/lib/engine';
import { buildHardwareDefaults, parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import { pickLegId } from '@/lib/quote/legs';
import type { FormState } from '@/lib/forms/form-action';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SectionAccordion } from '@/components/ui/section-accordion';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { fieldLabelCls } from '@/components/forms';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CabinetIsoSvg } from '@/components/CabinetIsoSvg';
import { HardwareCombobox, type HardwareComboItem } from '@/components/HardwareCombobox';
import { MaterialPicker } from '@/components/MaterialPicker';
import { FrontModelPicker, type FrontModelOption } from '@/components/FrontModelPicker';
import { RalPicker, type RalColor } from '@/components/RalPicker';
import { materialHasNoPrice } from '@/lib/quote/material-price';

export type FieldOption = { value: string; label: string };

const FRONT_KIND_OPTIONS: FieldOption[] = [
  { value: 'PAL', label: 'PAL' },
  { value: 'MDF_MELAMINAT', label: 'MDF melaminat' },
  { value: 'MDF_INFOLIAT', label: 'MDF infoliat' },
  { value: 'MDF_VOPSIT', label: 'MDF vopsit' },
];

const MDF_FINISH_OPTIONS: FieldOption[] = [
  { value: 'MAT', label: 'Mat' },
  { value: 'LUCIOS', label: 'Lucios' },
];

const MDF_FACES_OPTIONS: FieldOption[] = [
  { value: '1', label: '1 față' },
  { value: '2', label: '2 fețe' },
];

const MDF_COLOR_CATEGORY_OPTIONS: FieldOption[] = [
  { value: 'NORMALA', label: 'Normală' },
  { value: 'VIE', label: 'Vie' },
  { value: 'METALIZAT', label: 'Metalizat' },
];

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

const SHELF_AXIS_OPTIONS: FieldOption[] = [
  { value: 'LR', label: 'Stânga–dreapta' },
  { value: 'FB', label: 'Față–spate' },
];

const DOOR_OPENING_OPTIONS: FieldOption[] = [
  { value: 'BALAMALE', label: 'Clasic' },
  { value: 'RIDICABILA', label: 'Tip Aventos' },
];

export interface CabinetEditorFormProps {
  initial: Record<string, string>;
  snapshot: SnapshotData;
  laborPct: number;
  yieldFactor: number;
  legHeightMm: number | null;
  bandOptions: {
    carcassFront: FieldOption[];
    frontPerimeter: FieldOption[];
  };
  hardwareAdjustments: HardwareAdjustments | null;
  extraParts: ExtraPart[];
  extraPartsSlot: ReactNode;
  extraPartsSummary: string;
  frontSupplierOptions: FieldOption[];
  frontModelOptions: FrontModelOption[];
  ralColors: RalColor[];
  projectHandle: { type: string; itemId: string | null; label: string };
  tandemboxHeights: number[];
  save: (data: Record<string, string>) => Promise<FormState>;
}

export function CabinetEditorForm(props: CabinetEditorFormProps) {
  const {
    initial, snapshot, laborPct, yieldFactor, legHeightMm,
    bandOptions, hardwareAdjustments, extraParts,
    extraPartsSlot, extraPartsSummary,
    frontSupplierOptions, frontModelOptions, ralColors,
    projectHandle, tandemboxHeights, save,
  } = props;
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(initial);
  // feronerie v4: abaterile per rând de la sugestiile automate (doar ce s-a atins)
  const [hw, setHw] = useState<HardwareAdjustments>(hardwareAdjustments ?? {});
  // produse create pe loc din combobox — vizibile imediat, până le aduce refresh-ul din snapshot
  const [createdHw, setCreatedHw] = useState<HardwareComboItem[]>([]);
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<FormState>({});

  // erorile de validare apar doar pe câmpurile atinse sau după o încercare de salvare
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const markTouched = (field: string) => setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));

  const set = (field: string, value: string) => {
    markTouched(field);
    setValues((v) => ({ ...v, [field]: value }));
  };

  const parsed = useMemo(() => cabinetFormSchema.safeParse(values), [values]);

  // prima eroare per câmp (schema are mesaje RO + path pe toate refine-urile)
  const fieldErrors = useMemo(() => {
    const m = new Map<string, string>();
    if (parsed.success) return m;
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '');
      if (field && !m.has(field)) m.set(field, issue.message);
    }
    return m;
  }, [parsed]);
  const showError = (field: string) =>
    submitAttempted || touched.has(field) ? fieldErrors.get(field) : undefined;

  // snapshotul + produsele create pe loc (dedupe pe id; refresh-ul serverului le va aduce în snapshot)
  const snapExt = useMemo(() => {
    const fresh = createdHw.filter((c) => !snapshot.hardware.some((h) => h.id === c.id));
    if (fresh.length === 0) return snapshot;
    return {
      ...snapshot,
      hardware: [
        ...snapshot.hardware,
        ...fresh.map((c) => ({
          id: c.id, name: c.name, category: c.category, pricePerUnit: c.pricePerUnit,
          nominalLengthMm: null, loadClassKg: null, boxHeightMm: null, active: true,
        })),
      ],
    };
  }, [snapshot, createdHw]);

  const catalogs = useMemo(
    () => toCostCatalogs(
      snapExt.materials, snapExt.edgeBands, snapExt.hardware, snapExt.cuttingRates,
      frontCatalogsFromSnapshot(snapExt),
    ),
    [snapExt],
  );
  const cc = useMemo(() => parseConstruction(snapshot.settings.constructionJson), [snapshot]);

  const frontType = values.frontType;
  const frontKind = values.frontKind ?? 'PAL';
  const withShelves = values.withShelves === 'true';
  const drawersCount = Math.max(0, Math.trunc(Number(values.drawersCount) || 0));

  const autoDoors = (widthMm: number) => (widthMm <= DOOR_SPLIT_WIDTH_MM ? 1 : 2);
  // ușile se precompletează după lățime cât timp utilizatorul nu le-a atins
  const [doorsTouched, setDoorsTouched] = useState(
    () => initial.frontType === 'USI' && Number(initial.doors) !== autoDoors(Number(initial.widthMm)),
  );
  const onWidthChange = (v: string) => {
    markTouched('widthMm');
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
  // înălțimile se recalculează egal la schimbarea H cât timp utilizatorul nu le-a atins
  const [heightsTouched, setHeightsTouched] = useState(() => {
    const n = Math.max(0, Math.trunc(Number(initial.drawersCount) || 0));
    if (initial.frontType !== 'SERTARE' || n === 0) return false;
    const eq = equalHeights(Number(initial.heightMm), n);
    const cur = (initial.drawerFrontHeightsMm ?? '').split(',').map((s) => Number(s.trim()));
    return !(cur.length === n && cur.every((h, i) => Math.abs(h - eq[i]) < 0.15));
  });
  const onHeightChange = (v: string) => {
    markTouched('heightMm');
    setValues((prev) => {
      const n = Math.max(0, Math.trunc(Number(prev.drawersCount) || 0));
      const recalc = prev.frontType === 'SERTARE' && n > 0 && !heightsTouched;
      return {
        ...prev, heightMm: v,
        ...(recalc ? { drawerFrontHeightsMm: equalHeights(Number(v), n).join(', ') } : {}),
      };
    });
  };
  const onDrawersCountChange = (v: string) => {
    markTouched('drawersCount');
    const n = Math.max(0, Math.trunc(Number(v) || 0));
    setHeightsTouched(false); // re-împărțim egal la schimbarea numărului
    setValues((prev) => ({
      ...prev, drawersCount: v,
      drawerFrontHeightsMm: n > 0 ? equalHeights(Number(prev.heightMm), n).join(', ') : '',
    }));
  };
  const setDrawerHeight = (i: number, v: string) => {
    setHeightsTouched(true);
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
    && tandemboxHeights.length > 0
    && tandemboxHeights.every((h) => h > minDrawerFrontH - cc.tandemboxFrontClearanceMm);

  const live = useMemo(() => {
    if (!parsed.success) return null;
    const input = withResolvedHandle(
      toCabinetInput(parsed.data),
      { type: projectHandle.type as HandleType, itemId: projectHandle.itemId },
    );
    let parts: Part[] = [];
    let warnings: Warning[] = [];
    let expandError: string | null = null;
    // tabelul de feronerie: rândurile auto rezolvate cu abaterile per slot + liniile extra
    let hardwareLines: HardwareLine[] = [];
    let unresolvedHardware: HardwareSuggestion[] = [];
    let slots: ResolvedSlot[] = [];
    try {
      const expanded = expandCabinet(input, catalogs, cc);
      parts = expanded.parts;
      warnings = expanded.warnings;
      const defaults = buildHardwareDefaults(
        snapExt.hardware.filter((h) => h.active),
        snapExt.settings,
      );
      if (legHeightMm != null) defaults.legId = pickLegId(snapExt.hardware, legHeightMm, defaults.legId);
      const resolved = resolveSuggestions(expanded.hardware, hw, defaults, catalogs.hardware);
      hardwareLines = resolved.lines;
      unresolvedHardware = resolved.unresolved;
      slots = resolved.slots;
    } catch (e) {
      expandError = e instanceof Error ? e.message : 'Eroare la generarea pieselor';
    }
    const estimate = estimateCabinetCost({ input, hardwareAdjustments: hw, extraParts }, snapExt, {
      laborPct, yieldFactor, legHeightMm,
      projectHandle: { type: projectHandle.type as HandleType, itemId: projectHandle.itemId },
    });
    return { input, parts, warnings, expandError, estimate, hardwareLines, unresolvedHardware, slots };
  }, [parsed, catalogs, cc, hw, extraParts, snapExt, laborPct, yieldFactor, legHeightMm, projectHandle]);

  const invalid = !parsed.success;

  const materialName = (mid: string) => snapshot.materials.find((m) => m.id === mid)?.name ?? mid;
  const bandName = (bid?: string) => (bid ? (snapshot.edgeBands.find((e) => e.id === bid)?.name ?? bid) : '');
  // lista pentru combobox-ul de feronerie (căutare + creare pe loc)
  const comboItems: HardwareComboItem[] = useMemo(
    () => snapExt.hardware.map((h) => ({
      id: h.id, name: h.name, category: h.category, pricePerUnit: h.pricePerUnit, active: h.active,
    })),
    [snapExt],
  );
  const onHardwareCreated = (item: HardwareComboItem) => {
    setCreatedHw((prev) => [...prev, item]);
    router.refresh(); // aduce produsul nou în snapshotul serverului
  };

  // manipularea abaterilor per slot: setezi doar ce atingi; undefined = revine la automat
  const setSlotAdj = (slot: HardwareSlot, patch: { itemId?: string | undefined; qty?: number | undefined }) => {
    setHw((prev) => {
      const cur = { ...(prev.slots?.[slot] ?? {}) };
      if ('itemId' in patch) { if (patch.itemId === undefined) delete cur.itemId; else cur.itemId = patch.itemId; }
      if ('qty' in patch) { if (patch.qty === undefined) delete cur.qty; else cur.qty = patch.qty; }
      const slots = { ...(prev.slots ?? {}) };
      if (cur.itemId === undefined && cur.qty === undefined) delete slots[slot];
      else slots[slot] = cur;
      return { ...prev, slots };
    });
  };
  const resetSlot = (slot: HardwareSlot) => setHw((prev) => {
    const slots = { ...(prev.slots ?? {}) };
    delete slots[slot];
    return { ...prev, slots };
  });
  const setExtra = (updater: (extra: HardwareLine[]) => HardwareLine[]) =>
    setHw((prev) => ({ ...prev, extra: updater(prev.extra ?? []) }));

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
    if (!parsed.success) {
      // nu trimitem un formular invalid — arătăm erorile pe secțiuni/câmpuri
      setSubmitAttempted(true);
      return;
    }
    startTransition(async () => {
      const result = await save({ ...values, hardwareAdjustmentsJson: JSON.stringify(hw) });
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

  // indicator „completat" per secțiune (bulină verde)
  const numV = (s: string) => Number(s) || 0;
  const frontCovered =
    frontType === 'FARA' ? true
      : values.frontKind === 'MDF_VOPSIT'
        ? !!(values.mdfSupplierId && values.mdfModelId && values.mdfRalCode)
        : !!values.frontMaterialId;
  const sectionComplete = {
    dimensiuni: !!values.type && numV(values.widthMm) > 0 && numV(values.heightMm) > 0 && numV(values.depthMm) > 0,
    materiale: !!values.carcassMaterialId && !!values.carcassFrontEdgeId && frontCovered,
    fronturi: frontType === 'USI' ? numV(values.doors) >= 1
      : frontType === 'SERTARE' ? drawersCount >= 1
        : true,
    spate: !backEnabled || !!values.backMaterialId,
    // feronerie completă = toate rândurile au produs (nimic nerezolvat)
    feronerie: !!live && !live.expandError && live.unresolvedHardware.length === 0,
  };

  // secțiunea fiecărui câmp — pentru marcajul roșu din headerele accordion-ului
  const FIELD_SECTION: Record<string, keyof typeof sectionComplete> = {
    label: 'dimensiuni', type: 'dimensiuni', widthMm: 'dimensiuni', heightMm: 'dimensiuni', depthMm: 'dimensiuni',
    blindPanelWidthMm: 'dimensiuni', mountTop: 'dimensiuni', mountBottom: 'dimensiuni',
    carcassMaterialId: 'materiale', carcassFrontEdgeId: 'materiale', frontKind: 'materiale', frontMaterialId: 'materiale',
    frontPerimeterId: 'materiale', mdfSupplierId: 'materiale', mdfModelId: 'materiale', mdfFinish: 'materiale',
    mdfFaces: 'materiale', mdfRalCode: 'materiale', mdfColorCategory: 'materiale',
    frontType: 'fronturi', doors: 'fronturi', withShelves: 'fronturi', shelves: 'fronturi',
    shelfMaterialId: 'fronturi', shelfDecorMatters: 'fronturi', shelfDecorAxis: 'fronturi',
    drawersCount: 'fronturi', drawersSystem: 'fronturi', drawersBottomMaterialId: 'fronturi', drawerFrontHeightsMm: 'fronturi',
    tandemboxHeightMm: 'fronturi', doorOpening: 'fronturi',
    handleMode: 'fronturi', handleType: 'fronturi', frontExtensionMm: 'fronturi',
    backEnabled: 'spate', backMaterialId: 'spate', backMount: 'spate',
  };
  const manualHwCount = Object.keys(hw.slots ?? {}).length + (hw.extra?.length ?? 0);
  const feronerieSummary = !live || live.expandError
    ? '—'
    : live.unresolvedHardware.length > 0
      ? `${live.unresolvedHardware.length} ${live.unresolvedHardware.length === 1 ? 'produs de ales' : 'produse de ales'}`
      : `${live.hardwareLines.reduce((s, l) => s + l.qty, 0)} bucăți${manualHwCount ? ` · ${manualHwCount} manual` : ''}`;

  const sectionError = (id: keyof typeof sectionComplete) =>
    [...fieldErrors.keys()].some((f) => FIELD_SECTION[f] === id && (submitAttempted || touched.has(f)));
  const anyVisibleError = (['dimensiuni', 'materiale', 'fronturi', 'spate'] as const).some(sectionError);

  // polițe: material propriu (— = ca al carcasei) + direcția decorului doar când contează
  const shelfControls = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MaterialPicker label="Material polițe" value={values.shelfMaterialId} onChange={(v) => set('shelfMaterialId', v)} materials={pickerMaterials} allowEmpty />
      </div>
      <p className="text-xs text-muted-foreground">Fără selecție, polițele se fac din materialul carcasei.</p>
      <div className="flex items-center gap-2">
        <Checkbox
          id="shelfDecorMatters"
          checked={values.shelfDecorMatters === 'true'}
          onCheckedChange={(c) => set('shelfDecorMatters', c === true ? 'true' : 'false')}
        />
        <Label htmlFor="shelfDecorMatters" className="font-normal">Contează direcția decorului</Label>
      </div>
      {values.shelfDecorMatters === 'true' && (
        <div className="grid gap-2">
          <Label className={fieldLabelCls}>Axa decorului</Label>
          <SegmentedControl value={values.shelfDecorAxis} onChange={(v) => set('shelfDecorAxis', v)} options={SHELF_AXIS_OPTIONS} />
          <p className="text-xs text-muted-foreground">
            Față–spate rotește piesa în lista de debitare (decorul curge pe lungimea plăcii).
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="flex flex-col gap-3">
        <SectionAccordion title="Identificare și dimensiuni" summary={dimSummary}
          open={openSections.has('dimensiuni')} onToggle={() => toggleSection('dimensiuni')}
          complete={sectionComplete.dimensiuni} error={sectionError('dimensiuni')}>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="label" className={fieldLabelCls}>Etichetă</Label>
              <Input id="label" value={values.label} onChange={(e) => set('label', e.target.value)} />
              <FieldError error={showError('label')} />
            </div>
            <div className="grid gap-2">
              <Label className={fieldLabelCls}>Tip corp</Label>
              <SegmentedControl value={type} onChange={(v) => set('type', v)} options={TYPE_OPTIONS} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumField label="Lățime L (mm)" value={values.widthMm} onChange={onWidthChange} error={showError('widthMm')} />
              <NumField label="Înălțime H (mm)" value={values.heightMm} onChange={onHeightChange} error={showError('heightMm')} />
              <NumField label="Adâncime A (mm)" value={values.depthMm} onChange={(v) => set('depthMm', v)} error={showError('depthMm')} />
              {isColt && (
                <NumField label="Panou orb (mm)" value={values.blindPanelWidthMm} onChange={(v) => set('blindPanelWidthMm', v)} error={showError('blindPanelWidthMm')} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Blat corp (sus)" value={values.mountTop} onChange={(v) => set('mountTop', v)} options={MOUNT_OPTIONS} />
              <SelectField label="Fund corp (jos)" value={values.mountBottom} onChange={(v) => set('mountBottom', v)} options={MOUNT_OPTIONS} />
            </div>
          </div>
        </SectionAccordion>

        <SectionAccordion title="Materiale și canturi" summary={matSummary}
          open={openSections.has('materiale')} onToggle={() => toggleSection('materiale')}
          complete={sectionComplete.materiale} error={sectionError('materiale')}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MaterialPicker label="Material carcasă" value={values.carcassMaterialId} onChange={(v) => set('carcassMaterialId', v)} materials={pickerMaterials} error={showError('carcassMaterialId')} />
              <SelectField label="Cant carcasă" value={values.carcassFrontEdgeId} onChange={(v) => set('carcassFrontEdgeId', v)} options={bandOptions.carcassFront} error={showError('carcassFrontEdgeId')} />
            </div>

            <div className="grid gap-2 border-t pt-3">
              <Label className={fieldLabelCls}>Tip front</Label>
              <SegmentedControl value={frontKind} onChange={(v) => set('frontKind', v)} options={FRONT_KIND_OPTIONS} />
            </div>

            {frontKind !== 'MDF_VOPSIT' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <MaterialPicker label="Material fronturi" value={values.frontMaterialId} onChange={(v) => set('frontMaterialId', v)} materials={pickerMaterials} allowEmpty error={showError('frontMaterialId')} />
                <SelectField label="Cant fronturi" value={values.frontPerimeterId} onChange={(v) => set('frontPerimeterId', v)} options={bandOptions.frontPerimeter} allowEmpty />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField label="Furnizor" value={values.mdfSupplierId} onChange={(v) => set('mdfSupplierId', v)} options={frontSupplierOptions} allowEmpty error={showError('mdfSupplierId')} />
                  <FrontModelPicker label="Model" value={values.mdfModelId} onChange={(v) => set('mdfModelId', v)} models={frontModelOptions} allowEmpty />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className={fieldLabelCls}>Finisaj</Label>
                    <SegmentedControl value={values.mdfFinish} onChange={(v) => set('mdfFinish', v)} options={MDF_FINISH_OPTIONS} />
                  </div>
                  <div className="grid gap-2">
                    <Label className={fieldLabelCls}>Nr. fețe</Label>
                    <SegmentedControl value={values.mdfFaces} onChange={(v) => set('mdfFaces', v)} options={MDF_FACES_OPTIONS} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <RalPicker
                    label="Culoare RAL"
                    value={values.mdfRalCode}
                    onChange={(v) => set('mdfRalCode', v)}
                    colors={ralColors}
                    onVividHint={(vivid) => { if (vivid) set('mdfColorCategory', 'VIE'); }}
                    allowEmpty
                  />
                  <div className="grid gap-2">
                    <Label className={fieldLabelCls}>Categorie culoare</Label>
                    <SegmentedControl value={values.mdfColorCategory} onChange={(v) => set('mdfColorCategory', v)} options={MDF_COLOR_CATEGORY_OPTIONS} />
                  </div>
                </div>
              </div>
            )}
            {noPriceMaterials.length > 0 && (
              <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                Materiale fără preț: {noPriceMaterials.join(', ')} — apar cu 0 lei în ofertă.
              </p>
            )}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Fronturi" summary={frontSummary}
          open={openSections.has('fronturi')} onToggle={() => toggleSection('fronturi')}
          complete={sectionComplete.fronturi} error={sectionError('fronturi')}>
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
                  <NumField label="Uși" value={values.doors} onChange={(v) => { setDoorsTouched(true); set('doors', v); }} error={showError('doors')} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Convenție atelier: până în 600mm lățime → 1 ușă; peste → 2 uși.
                </p>
                <div className="space-y-3 rounded-lg border p-3">
                  <Label className={fieldLabelCls}>Polițe</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="withShelves"
                      checked={withShelves}
                      onCheckedChange={(c) => set('withShelves', c === true ? 'true' : 'false')}
                    />
                    <Label htmlFor="withShelves" className="font-normal">Cu polițe (debifează la corpul de chiuvetă)</Label>
                  </div>
                  {withShelves && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
                      </div>
                      {shelfControls}
                    </>
                  )}
                </div>
                {type === 'SUSPENDAT' && (
                  <div className="grid gap-2">
                    <Label className={fieldLabelCls}>Tip deschidere</Label>
                    <SegmentedControl
                      value={values.doorOpening}
                      onChange={(v) => set('doorOpening', v)}
                      options={DOOR_OPENING_OPTIONS}
                    />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {values.doorOpening === 'RIDICABILA' && type === 'SUSPENDAT'
                    ? 'Ușa se ridică pe set Aventos — fără balamale; setul se alege în secțiunea Feronerie.'
                    : 'Modelul și numărul balamalelor se aleg în secțiunea Feronerie.'}
                </p>
              </div>
            )}

            {frontType === 'SERTARE' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Nr. sertare" value={values.drawersCount} onChange={onDrawersCountChange} error={showError('drawersCount')} />
                  <SelectField label="Sistem sertare" value={values.drawersSystem} onChange={(v) => set('drawersSystem', v)} options={DRAWER_SYSTEM_OPTIONS} />
                  {values.drawersSystem === 'PAL_BOX' && (
                    <MaterialPicker label="Fund sertare" value={values.drawersBottomMaterialId} onChange={(v) => set('drawersBottomMaterialId', v)} materials={pickerMaterials} allowEmpty error={showError('drawersBottomMaterialId')} />
                  )}
                </div>
                {values.drawersSystem === 'PAL_BOX' && (
                  <p className="text-xs text-muted-foreground">
                    Modelul glisierelor se alege în secțiunea Feronerie.
                  </p>
                )}
                {values.drawersSystem === 'TANDEMBOX' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label className={fieldLabelCls}>Înălțime laterală (mm)</Label>
                        <select className={selectCls} value={values.tandemboxHeightMm ?? ''} onChange={(e) => set('tandemboxHeightMm', e.target.value)}>
                          <option value="">— alege —</option>
                          {tandemboxHeights.map((h) => {
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
                    <FieldError error={showError('drawerFrontHeightsMm')} />
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
              <div className="space-y-3 rounded-lg border p-3">
                <Label className={fieldLabelCls}>Polițe</Label>
                <div className="grid grid-cols-2 gap-3">
                  <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
                </div>
                {Number(values.shelves) > 0 && shelfControls}
              </div>
            )}

            {frontType !== 'FARA' && (
              <div className="space-y-2 border-t pt-3">
                <Label className={fieldLabelCls}>Mâner</Label>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Tip"
                    value={values.handleMode === 'PROIECT' ? '' : values.handleType}
                    onChange={(v) => { markTouched('handleType'); setValues((prev) => ({
                      ...prev,
                      handleMode: v === '' ? 'PROIECT' : 'CUSTOM',
                      ...(v !== '' ? { handleType: v } : {}),
                      ...(v === 'FARA' && !prev.frontExtensionMm
                        ? { frontExtensionMm: String(cc.frontExtensionDefaultMm) } : {}),
                    })); }}
                    options={[{ value: '', label: `Ca proiectul (${projectHandle.label})` },
                      ...HANDLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                  />
                  {values.handleMode === 'CUSTOM' && values.handleType === 'FARA' && (
                    <NumField label="Prelungire front (mm)" value={values.frontExtensionMm} onChange={(v) => set('frontExtensionMm', v)} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Produsul și numărul de mânere se aleg în secțiunea Feronerie.
                </p>
                {values.handleMode === 'CUSTOM' && values.handleType === 'GOLA' && (
                  <p className="text-xs text-muted-foreground">
                    GOLA: fiecare front se scurtează cu {fmtNum(cc.golaFrontDeductMm, 0)}mm,
                    profil {'≈'}{fmtNum(((frontType === 'SERTARE' ? Math.max(drawersCount, 1) : 1) * Number(values.widthMm)) / 1000, 2)}ml
                    {frontType === 'SERTARE' ? ' (un profil pe fiecare sertar)' : ''} — valori din Setări.
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
          open={openSections.has('spate')} onToggle={() => toggleSection('spate')}
          complete={sectionComplete.spate} error={sectionError('spate')}>
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
                <MaterialPicker label="Material spate" value={values.backMaterialId} onChange={(v) => set('backMaterialId', v)} materials={pickerMaterials} allowEmpty error={showError('backMaterialId')} />
                <SelectField label="Montaj spate" value={values.backMount} onChange={(v) => set('backMount', v)} options={BACK_MOUNT_OPTIONS} />
              </div>
            )}
          </div>
        </SectionAccordion>

        <SectionAccordion title="Feronerie" summary={feronerieSummary}
          open={openSections.has('feronerie')} onToggle={() => toggleSection('feronerie')} complete={sectionComplete.feronerie}>
          {live && !live.expandError ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Rândurile vin din configurația corpului (fronturi, polițe, tip). Ce modifici rămâne
                ales manual; restul se recalculează automat la orice schimbare a corpului.
                Scrii un produs care nu există? Îl adaugi direct din listă, cu preț.
              </p>
              <div>
                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_4.5rem_4.5rem] items-center gap-x-3 border-b pb-1.5">
                  <span className={fieldLabelCls}>Rând</span>
                  <span className={fieldLabelCls}>Produs</span>
                  <span className={fieldLabelCls}>Buc</span>
                  <span />
                </div>
                {live.slots.map((r) => {
                  const adjusted = r.itemAdjusted || r.qtyAdjusted;
                  const removed = r.qty === 0;
                  return (
                    <div
                      key={r.slot}
                      className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_4.5rem_4.5rem] items-center gap-x-3 border-b border-border/60 py-2"
                    >
                      <div className="min-w-0">
                        <div className={cn('truncate text-sm font-medium', removed && 'text-muted-foreground line-through')}>
                          {r.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {removed ? 'eliminat de pe corp' : adjusted ? 'ales manual' : 'automat'}
                          {r.qtyAdjusted && r.qty !== r.autoQty && !removed ? ` · sugestie: ${r.autoQty}` : ''}
                        </div>
                      </div>
                      {removed ? (
                        <div className="col-span-2 text-sm text-muted-foreground">—</div>
                      ) : (
                        <>
                          <HardwareCombobox
                            value={r.itemId}
                            onChange={(v) => setSlotAdj(r.slot, { itemId: v })}
                            items={comboItems}
                            category={r.category}
                            onCreated={onHardwareCreated}
                            error={r.itemId === null ? 'Alege produsul' : undefined}
                          />
                          <Input
                            type="number"
                            step="1"
                            value={String(r.qty)}
                            onChange={(e) => setSlotAdj(r.slot, {
                              qty: e.target.value === '' ? undefined : Math.max(0, Math.trunc(Number(e.target.value) || 0)),
                            })}
                            className="h-8 font-mono"
                          />
                        </>
                      )}
                      <div className="flex justify-end gap-1">
                        {adjusted && (
                          <button
                            type="button"
                            onClick={() => resetSlot(r.slot)}
                            title="Revino la automat"
                            className="rounded-lg border px-2 py-1 text-xs hover:bg-muted"
                          >
                            ↺
                          </button>
                        )}
                        {!removed && (
                          <button
                            type="button"
                            title="Elimină rândul de pe corp"
                            onClick={() => {
                              if (window.confirm(`Elimini „${r.name}" de pe acest corp? Îl aduci înapoi cu ↺.`)) {
                                setSlotAdj(r.slot, { qty: 0 });
                              }
                            }}
                            className="rounded-lg border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {live.slots.length === 0 && (
                  <p className="py-3 text-sm text-muted-foreground">Configurația corpului nu cere feronerie.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className={fieldLabelCls}>Produse adăugate manual</Label>
                {(hw.extra ?? []).map((l, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_4.5rem_4.5rem] items-center gap-x-3"
                  >
                    <div />
                    <HardwareCombobox
                      value={l.hardwareId || null}
                      onChange={(v) => setExtra((extra) => extra.map((x, j) => (j === i ? { ...x, hardwareId: v } : x)))}
                      items={comboItems}
                      onCreated={onHardwareCreated}
                    />
                    <Input
                      type="number"
                      step="1"
                      value={String(l.qty)}
                      onChange={(e) => setExtra((extra) => extra.map((x, j) => (
                        j === i ? { ...x, qty: Math.max(0, Math.trunc(Number(e.target.value) || 0)) } : x
                      )))}
                      className="h-8 font-mono"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        title="Șterge rândul"
                        onClick={() => setExtra((extra) => extra.filter((_, j) => j !== i))}
                        className="rounded-lg border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExtra((extra) => [...extra, { hardwareId: '', qty: 1 }])}
                  className="rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  ＋ Adaugă produs
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Completează corpul (dimensiuni + materiale) — feroneria se calculează din configurație.
            </p>
          )}
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
          {submitAttempted && invalid && (
            <Alert variant="destructive">
              <AlertDescription>
                Corpul nu se poate salva încă — deschide secțiunile marcate cu roșu și corectează câmpurile.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
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
              {invalid
                ? anyVisibleError
                  ? 'Corectează erorile pentru a vedea piesele.'
                  : 'Completează formularul pentru a vedea piesele.'
                : 'Nu se pot genera piese.'}
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

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-destructive">{error}</p>;
}

function NumField({ label, value, onChange, error }: {
  label: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <Input
        type="number" step="1" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        className={cn('font-mono', error && 'border-destructive focus-visible:ring-destructive/30')}
      />
      <FieldError error={error} />
    </div>
  );
}

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

function SelectField({ label, value, onChange, options, allowEmpty, error }: {
  label: string; value: string; onChange: (v: string) => void;
  options: FieldOption[]; allowEmpty?: boolean; error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>{label}</Label>
      <select
        className={cn(selectCls, error && 'border-destructive')}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">—</option>}
        {/* fără valoare aleasă, un select nativ ar afișa prima opțiune ca și cum ar fi selectată */}
        {!allowEmpty && !value && !options.some((o) => o.value === '') && <option value="" disabled>Selectează…</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FieldError error={error} />
    </div>
  );
}

'use client';

import {
  createContext, type ReactNode, useContext, useMemo, useState, useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Layers3 } from 'lucide-react';
import { applyBulkCabinetEdit, previewBulkCabinetEdit } from '@/lib/quote/actions';
import type { BulkCabinetPatch } from '@/lib/quote/bulk-edit';
import { fmtLei } from '@/lib/format';
import { cn } from '@/lib/utils';
import { MaterialPicker, type MaterialPickerItem } from '@/components/MaterialPicker';
import { FrontModelPicker, type FrontModelOption } from '@/components/FrontModelPicker';
import { RalPicker, type RalColor } from '@/components/RalPicker';
import { fieldLabelCls } from '@/components/forms';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type BulkFrontKind = '' | 'PAL' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT' | 'MDF_VOPSIT' | 'STICLA_RAMA';

export type BulkFrontSupplier = { id: string; name: string };
export type BulkFrontModel = FrontModelOption & { supplierId: string };

type SelectionContextValue = {
  isSelected: (id: string) => boolean;
  toggle: (id: string, checked: boolean) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useBulkCabinetSelection() {
  return useContext(SelectionContext);
}

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

type Preview = Extract<Awaited<ReturnType<typeof previewBulkCabinetEdit>>, { ok: true }>['preview'];

export type BulkEdgeBand = { id: string; name: string; thicknessMm: number };

export function BulkCabinetEditor({
  assemblyId, eligibleIds, materials, suppliers, models, ralColors, edgeBands, children,
}: {
  assemblyId: string;
  eligibleIds: string[];
  materials: MaterialPickerItem[];
  suppliers: BulkFrontSupplier[];
  models: BulkFrontModel[];
  ralColors: RalColor[];
  edgeBands: BulkEdgeBand[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [carcassMaterialId, setCarcassMaterialId] = useState('');
  const [carcassEdgeBandId, setCarcassEdgeBandId] = useState('');
  const [frontEdgeBandId, setFrontEdgeBandId] = useState('');
  const [frontKind, setFrontKind] = useState<BulkFrontKind>('');
  const [frontMaterialId, setFrontMaterialId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [modelId, setModelId] = useState('');
  const [finish, setFinish] = useState<'MAT' | 'LUCIOS'>('MAT');
  const [faces, setFaces] = useState('1');
  const [ralCode, setRalCode] = useState('');
  const [colorCategory, setColorCategory] = useState<'NORMALA' | 'VIE' | 'METALIZAT'>('NORMALA');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [depthMm, setDepthMm] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const selectedIds = useMemo(() => eligibleIds.filter((id) => selected.has(id)), [eligibleIds, selected]);
  const allSelected = eligibleIds.length > 0 && selectedIds.length === eligibleIds.length;
  const carcassMaterials = useMemo(
    () => materials.filter((m) => !['STICLA_RAMA', 'STICLA_POLITA', 'PFL'].includes(m.kind)),
    [materials],
  );
  const frontMaterials = useMemo(
    () => materials.filter((m) => m.kind === frontKind),
    [materials, frontKind],
  );
  const supplierModels = useMemo(
    () => models.filter((model) => !supplierId || model.supplierId === supplierId),
    [models, supplierId],
  );

  const context = useMemo<SelectionContextValue>(() => ({
    isSelected: (id) => selected.has(id),
    toggle: (id, checked) => setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id); else next.delete(id);
      return next;
    }),
  }), [selected]);

  const invalidatePreview = () => {
    setPreview(null);
    setError('');
  };

  const parseDimension = (value: string, label: string) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} trebuie să fie mai mare ca 0`);
    return parsed;
  };

  const makePatch = (): BulkCabinetPatch => {
    const dimensions = {
      widthMm: parseDimension(widthMm, 'Lățimea'),
      heightMm: parseDimension(heightMm, 'Înălțimea'),
      depthMm: parseDimension(depthMm, 'Adâncimea'),
    };
    const patch: BulkCabinetPatch = {};
    if (carcassMaterialId) patch.carcassMaterialId = carcassMaterialId;
    if (carcassEdgeBandId) patch.carcassEdgeBandId = carcassEdgeBandId;
    if (frontEdgeBandId) patch.frontEdgeBandId = frontEdgeBandId;
    if (Object.values(dimensions).some((value) => value !== undefined)) patch.dimensions = dimensions;

    if (frontKind === 'MDF_VOPSIT') {
      if (!supplierId || !modelId || !ralCode) throw new Error('Completează furnizorul, modelul și culoarea RAL');
      patch.front = {
        kind: 'MDF_VOPSIT',
        mdfFront: {
          supplierId, modelId, finish, faces: Number(faces), ralCode, colorCategory,
        },
      };
    } else if (frontKind) {
      if (!frontMaterialId) throw new Error('Alege materialul fronturilor');
      patch.front = { kind: frontKind, materialId: frontMaterialId };
    }

    if (!patch.carcassMaterialId && !patch.front && !patch.dimensions
      && !patch.carcassEdgeBandId && !patch.frontEdgeBandId) {
      throw new Error('Alege cel puțin un material, un cant sau o dimensiune');
    }
    return patch;
  };

  const calculatePreview = () => {
    setError('');
    let patch: BulkCabinetPatch;
    try { patch = makePatch(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Date invalide');
      return;
    }
    startTransition(async () => {
      const result = await previewBulkCabinetEdit(assemblyId, selectedIds, patch);
      if (!result.ok) setError(result.error);
      else setPreview(result.preview);
    });
  };

  const applyChanges = () => {
    setError('');
    let patch: BulkCabinetPatch;
    try { patch = makePatch(); } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Date invalide');
      return;
    }
    startTransition(async () => {
      const result = await applyBulkCabinetEdit(assemblyId, selectedIds, patch);
      if (!result.ok) {
        setError(result.error);
        setPreview(null);
        return;
      }
      setSelected(new Set());
      setOpen(false);
      setPreview(null);
      router.refresh();
    });
  };

  const setDialogOpen = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPreview(null);
      setError('');
    }
  };

  return (
    <SelectionContext.Provider value={context}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected ? true : selectedIds.length > 0 ? 'indeterminate' : false}
              onCheckedChange={(checked) => setSelected(checked === true ? new Set(eligibleIds) : new Set())}
            />
            Selectează toate
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedIds.length} corpuri selectate</span>
            <Button type="button" size="sm" disabled={selectedIds.length === 0} onClick={() => setDialogOpen(true)}>
              <Layers3 /> Modifică în masă
            </Button>
          </div>
        </div>

        {children}
      </div>

      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Modifică {selectedIds.length} corpuri</DialogTitle>
            <DialogDescription>Câmpurile lăsate goale își păstrează valorile actuale.</DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Materiale</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MaterialPicker
                    label="Material carcasă (opțional)" value={carcassMaterialId}
                    onChange={(value) => { setCarcassMaterialId(value); invalidatePreview(); }}
                    materials={carcassMaterials} allowEmpty
                  />
                  <div className="grid gap-1">
                    <Label className={fieldLabelCls}>Tip front (opțional)</Label>
                    <select
                      className={selectCls} value={frontKind}
                      onChange={(event) => {
                        setFrontKind(event.target.value as BulkFrontKind);
                        setFrontMaterialId(''); setSupplierId(''); setModelId(''); invalidatePreview();
                      }}
                    >
                      <option value="">— nu modifica</option>
                      <option value="PAL">PAL</option>
                      <option value="MDF_MELAMINAT">MDF melaminat</option>
                      <option value="MDF_INFOLIAT">MDF înfoliat</option>
                      <option value="MDF_VOPSIT">MDF vopsit</option>
                      <option value="STICLA_RAMA">Sticlă cu ramă</option>
                    </select>
                  </div>
                </div>

                {frontKind && frontKind !== 'MDF_VOPSIT' && (
                  <MaterialPicker
                    label="Material fronturi" value={frontMaterialId}
                    onChange={(value) => { setFrontMaterialId(value); invalidatePreview(); }}
                    materials={frontMaterials}
                  />
                )}

                {frontKind === 'MDF_VOPSIT' && (
                  <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label className={fieldLabelCls}>Furnizor</Label>
                      <select className={selectCls} value={supplierId} onChange={(event) => {
                        setSupplierId(event.target.value); setModelId(''); invalidatePreview();
                      }}>
                        <option value="">— selectează</option>
                        {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                      </select>
                    </div>
                    <FrontModelPicker
                      label="Model" value={modelId}
                      onChange={(value) => { setModelId(value); invalidatePreview(); }}
                      models={supplierModels} allowEmpty
                    />
                    <div className="grid gap-1">
                      <Label className={fieldLabelCls}>Finisaj</Label>
                      <select className={selectCls} value={finish} onChange={(event) => { setFinish(event.target.value as typeof finish); invalidatePreview(); }}>
                        <option value="MAT">Mat</option><option value="LUCIOS">Lucios</option>
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <Label className={fieldLabelCls}>Număr fețe</Label>
                      <select className={selectCls} value={faces} onChange={(event) => { setFaces(event.target.value); invalidatePreview(); }}>
                        <option value="1">1 față</option><option value="2">2 fețe</option>
                      </select>
                    </div>
                    <RalPicker
                      label="Culoare RAL" value={ralCode} colors={ralColors} allowEmpty
                      onChange={(value) => { setRalCode(value); invalidatePreview(); }}
                      onVividHint={(vivid) => setColorCategory(vivid ? 'VIE' : 'NORMALA')}
                    />
                    <div className="grid gap-1">
                      <Label className={fieldLabelCls}>Categorie culoare</Label>
                      <select className={selectCls} value={colorCategory} onChange={(event) => { setColorCategory(event.target.value as typeof colorCategory); invalidatePreview(); }}>
                        <option value="NORMALA">Normală</option><option value="VIE">Vie</option><option value="METALIZAT">Metalizat</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Canturi ABS</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1">
                    <Label className={fieldLabelCls}>Cant carcasă (opțional)</Label>
                    <select className={selectCls} value={carcassEdgeBandId}
                      onChange={(event) => { setCarcassEdgeBandId(event.target.value); invalidatePreview(); }}>
                      <option value="">— nu modifica</option>
                      {edgeBands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1">
                    <Label className={fieldLabelCls}>Cant front (opțional)</Label>
                    <select className={selectCls} value={frontEdgeBandId}
                      onChange={(event) => { setFrontEdgeBandId(event.target.value); invalidatePreview(); }}>
                      <option value="">— nu modifica</option>
                      {edgeBands.map((band) => <option key={band.id} value={band.id}>{band.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cantul de front se aplică doar la fronturile PAL / MDF melaminat (MDF vopsit, înfoliat și sticla nu au cant).
                </p>
              </section>

              <section className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Dimensiuni exacte (mm)</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Lățime', widthMm, setWidthMm],
                    ['Înălțime', heightMm, setHeightMm],
                    ['Adâncime', depthMm, setDepthMm],
                  ].map(([label, value, setter]) => (
                    <div key={label as string} className="grid gap-1">
                      <Label className={fieldLabelCls}>{label as string}</Label>
                      <Input
                        type="number" min="0.01" step="0.01" value={value as string} placeholder="Nu modifica"
                        onChange={(event) => { (setter as (value: string) => void)(event.target.value); invalidatePreview(); }}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
                <Button type="button" onClick={calculatePreview} disabled={pending}>
                  {pending ? 'Se calculează…' : 'Verifică și calculează prețul'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">Corpuri: {preview.selectedLabels.join(', ')}</p>
                {preview.skippedFrontLabels.length > 0 && (
                  <p className="mt-2 flex gap-2 text-amber-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    Fără fronturi; materialul frontului va fi ignorat: {preview.skippedFrontLabels.join(', ')}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Corpurile selectate</p>
                  <p className="text-lg font-semibold">{fmtLei(preview.selectedBefore)} → {fmtLei(preview.selectedAfter)}</p>
                  <p className="text-xs text-muted-foreground">Diferență: {fmtLei(preview.selectedAfter - preview.selectedBefore)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total ofertă</p>
                  <p className="text-lg font-semibold">{fmtLei(preview.totalBefore)} → {fmtLei(preview.totalAfter)}</p>
                  <p className="text-xs text-muted-foreground">Diferență: {fmtLei(preview.totalAfter - preview.totalBefore)}</p>
                </div>
              </div>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPreview(null)} disabled={pending}>Înapoi</Button>
                <Button type="button" onClick={applyChanges} disabled={pending}>
                  {pending ? 'Se salvează…' : 'Aplică modificările'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SelectionContext.Provider>
  );
}

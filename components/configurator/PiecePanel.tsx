'use client';
import { useState } from 'react';
import type { DimCalc, EdgeSide, FreePiece, PieceInstance, PieceOverride } from '@/lib/engine';
import { EDGE_SIDES, EDGE_SIDE_LABELS } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fieldLabelCls } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ConfiguratorCatalogItem } from './ConfiguratorSheet';

const selectCls = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'md:text-sm dark:bg-input/30',
);

// „H 720 − picior 100 = 620"; un singur termen → doar „label: valoare" (copiat din CabinetEditorForm.fmtDimCalc)
function fmtDimCalc(c: DimCalc): string {
  if (c.terms.length <= 1) return `${c.label}: ${fmtNum(c.resultMm, 1)}`;
  const body = c.terms
    .map((term, i) => {
      const sign = i === 0 ? '' : term.valueMm < 0 ? '− ' : '+ ';
      return `${sign}${term.label} ${fmtNum(Math.abs(term.valueMm), 1)}`;
    })
    .join(' ');
  return `${c.label}: ${body} = ${fmtNum(c.resultMm, 1)}`;
}

// duplicat din ConfiguratorSheet (neexportat acolo)
const omit = <T,>(o: Record<string, T> | undefined, k: string): Record<string, T> => {
  const { [k]: _, ...rest } = o ?? {};
  return rest;
};

// un override fără niciun conținut nu merită păstrat în cfg.overrides (ar umfla contorul din peek)
const isEmptyOverride = (ov: PieceOverride): boolean =>
  !ov.removed && !ov.materialId && ov.lengthMm === undefined && ov.widthMm === undefined
  && Object.keys(ov.edges ?? {}).length === 0;

const TOP_SLOT_KEYS = new Set(['blat-corp', 'pazie-fata', 'pazie-spate']);
const TOP_OPTIONS = [
  { value: 'PLIN', label: 'Plin' },
  { value: 'PAZII', label: 'Pazii' },
  { value: 'ABSENT', label: 'Absent' },
];

export function PiecePanel(props: {
  piece: PieceInstance | null;
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
  materials: ConfiguratorCatalogItem[];
  edgeBands: ConfiguratorCatalogItem[];
  addingFree: boolean;
  onDoneAddingFree: () => void;
  topSlotWidthDefaultMm: number;
}) {
  const { piece, cfg, onCfgChange, materials, edgeBands } = props;

  if (props.addingFree) {
    return <FreePieceForm materials={materials} cfg={cfg} onCfgChange={onCfgChange} onDone={props.onDoneAddingFree} />;
  }

  const showTopSlot = piece ? TOP_SLOT_KEYS.has(piece.key) : true;

  if (!piece) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Alege o piesă din listă sau din scena 3D pentru a o edita.</p>
        {showTopSlot && (
          <TopSlotSection cfg={cfg} onCfgChange={onCfgChange} defaultWidthMm={props.topSlotWidthDefaultMm} />
        )}
      </div>
    );
  }

  const key = piece.key;
  const override = cfg.overrides?.[key];

  // piesele libere NU trec prin cfg.overrides (motorul le generează direct din cfg.free) —
  // toate editările lor merg în intrarea din cfg.free găsită după id-ul de bază.
  const freeId = piece.free ? piece.key.split(':')[1] : null;
  const freeEntry = freeId ? (cfg.free ?? []).find((f) => f.id === freeId) : undefined;

  const updateFree = (patch: Partial<FreePiece>) => {
    if (!freeId) return;
    onCfgChange({ ...cfg, free: (cfg.free ?? []).map((f) => (f.id === freeId ? { ...f, ...patch } : f)) });
  };

  const writeOverride = (next: PieceOverride) => {
    onCfgChange({
      ...cfg,
      overrides: isEmptyOverride(next) ? omit(cfg.overrides, key) : { ...cfg.overrides, [key]: next },
    });
  };

  const setOverride = (patch: Partial<PieceOverride>) => {
    writeOverride({ ...cfg.overrides?.[key], ...patch });
  };

  const clearOverrideField = (field: keyof PieceOverride) => {
    const next = { ...(cfg.overrides?.[key] ?? {}) };
    delete next[field];
    writeOverride(next);
  };

  const setEdge = (side: EdgeSide, raw: string) => {
    if (freeEntry) {
      updateFree({ edges: { ...freeEntry.edges, [side]: raw === 'null' ? null : raw } });
      return;
    }
    const edges = { ...override?.edges };
    if (raw === '') delete edges[side];
    else edges[side] = raw === 'null' ? null : raw;
    if (Object.keys(edges).length === 0) clearOverrideField('edges');
    else setOverride({ edges });
  };

  const setAllEdges = (bandId: string | null) => {
    const edges: Partial<Record<EdgeSide, string | null>> = {};
    for (const side of Object.keys(piece.edgeAxis) as EdgeSide[]) edges[side] = bandId;
    if (freeEntry) updateFree({ edges });
    else setOverride({ edges });
  };

  const setMaterial = (raw: string) => {
    if (freeEntry) { if (raw) updateFree({ materialId: raw }); return; }
    if (raw === '') clearOverrideField('materialId');
    else setOverride({ materialId: raw });
  };

  const removePiece = () => {
    if (piece.free) {
      onCfgChange({ ...cfg, free: (cfg.free ?? []).filter((f) => f.id !== freeId) });
    } else {
      setOverride({ removed: true });
    }
  };

  const activeMaterials = materials.filter((m) => m.active !== false);
  const currentMaterialName = materials.find((m) => m.id === piece.materialId)?.name ?? piece.materialId;

  const sortedBands = edgeBands.filter((b) => b.thicknessMm != null);
  const minThicknessBand = sortedBands.length > 0
    ? sortedBands.reduce((a, b) => (b.thicknessMm! < a.thicknessMm! ? b : a))
    : null;
  const closest2mmBand = sortedBands.length > 0
    ? sortedBands.reduce((a, b) => (Math.abs(b.thicknessMm! - 2) < Math.abs(a.thicknessMm! - 2) ? b : a))
    : null;
  const twoMmSide: EdgeSide = piece.edgeAxis.fata !== undefined ? 'fata' : 'sus';
  const hasTwoMmSide = piece.edgeAxis[twoMmSide] !== undefined;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[15px] font-bold">{piece.label}</div>
        {piece.free && (
          <Button type="button" variant="destructive" size="sm" onClick={removePiece}>Șterge piesa</Button>
        )}
      </div>

      {showTopSlot && (
        <TopSlotSection cfg={cfg} onCfgChange={onCfgChange} defaultWidthMm={props.topSlotWidthDefaultMm} />
      )}

      <div className="grid gap-1.5">
        <Label className={fieldLabelCls}>Material</Label>
        {/* la piese libere nu există „automat": materialul e chiar cel din cfg.free */}
        <select
          className={selectCls}
          value={freeEntry ? freeEntry.materialId : (override?.materialId ?? '')}
          onChange={(e) => setMaterial(e.target.value)}
        >
          {!freeEntry && <option value="">Automat — {currentMaterialName}</option>}
          {freeEntry && !activeMaterials.some((m) => m.id === freeEntry.materialId) && (
            <option value={freeEntry.materialId}>{currentMaterialName}</option>
          )}
          {activeMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <Label className={fieldLabelCls}>Canturi pe muchii</Label>
        {EDGE_SIDES.filter((side) => piece.edgeAxis[side] !== undefined).map((side) => {
          let value: string;
          let autoName: string | null = null;
          if (freeEntry) {
            // fără opțiune „Automat" la piese libere: canturile trăiesc direct în cfg.free
            value = freeEntry.edges?.[side] ?? 'null';
          } else {
            const sideOverride = override?.edges?.[side];
            value = sideOverride === undefined ? '' : sideOverride === null ? 'null' : sideOverride;
            autoName = sideOverride === undefined
              ? (piece.edges[side] ? (edgeBands.find((b) => b.id === piece.edges[side])?.name ?? piece.edges[side]) : '—')
              : null; // cu override activ nu mai știm valoarea automată fără re-calcul
          }
          return (
            <div key={side} className="grid grid-cols-[64px_1fr] items-center gap-2">
              <span className="text-xs text-muted-foreground">{EDGE_SIDE_LABELS[side]}</span>
              <select className={selectCls} value={value} onChange={(e) => setEdge(side, e.target.value)}>
                {!freeEntry && <option value="">{autoName !== null ? `Automat — ${autoName}` : 'Automat'}</option>}
                <option value="null">Fără cant</option>
                {edgeBands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {freeEntry ? (
        <FreeDimensionsSection freeEntry={freeEntry} updateFree={updateFree} />
      ) : (
        <DimensionsSection piece={piece} override={override} setOverride={setOverride} clearOverrideField={clearOverrideField} />
      )}

      <div className="grid gap-1.5">
        <Label className={fieldLabelCls}>Sugestii</Label>
        <div className="flex flex-wrap gap-1.5">
          {minThicknessBand && (
            <Button type="button" variant="outline" size="sm" onClick={() => setAllEdges(minThicknessBand.id)}>
              ABS 0,4 peste tot
            </Button>
          )}
          {closest2mmBand && hasTwoMmSide && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEdge(twoMmSide, closest2mmBand.id)}>
              2 mm pe față
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setAllEdges(null)}>Fără cant</Button>
          <Button type="button" variant="destructive" size="sm" onClick={removePiece}>Elimină piesa</Button>
        </div>
      </div>
    </div>
  );
}

function DimensionsSection(props: {
  piece: PieceInstance;
  override: PieceOverride | undefined;
  setOverride: (patch: Partial<PieceOverride>) => void;
  clearOverrideField: (field: keyof PieceOverride) => void;
}) {
  const { piece, override, setOverride, clearOverrideField } = props;
  const onDim = (field: 'lengthMm' | 'widthMm', raw: string) => {
    if (raw === '') { clearOverrideField(field); return; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    setOverride({ [field]: n });
  };
  return (
    <div className="grid gap-2">
      <Label className={fieldLabelCls}>Dimensiuni</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Lungime (mm)</span>
            {override?.lengthMm !== undefined && (
              <button type="button" className="text-xs text-accent-blue" onClick={() => clearOverrideField('lengthMm')}>↺ auto</button>
            )}
          </div>
          <Input
            type="number" step="0.1"
            value={override?.lengthMm ?? ''}
            placeholder={fmtNum(piece.lengthMm, 1)}
            onChange={(e) => onDim('lengthMm', e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Lățime (mm)</span>
            {override?.widthMm !== undefined && (
              <button type="button" className="text-xs text-accent-blue" onClick={() => clearOverrideField('widthMm')}>↺ auto</button>
            )}
          </div>
          <Input
            type="number" step="0.1"
            value={override?.widthMm ?? ''}
            placeholder={fmtNum(piece.widthMm, 1)}
            onChange={(e) => onDim('widthMm', e.target.value)}
          />
        </div>
      </div>
      {piece.calc && (
        <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
          {piece.calc.length && <div>{fmtDimCalc(piece.calc.length)}</div>}
          {piece.calc.width && <div>{fmtDimCalc(piece.calc.width)}</div>}
        </div>
      )}
    </div>
  );
}

/** Dimensiunile pieselor libere sunt fixe (fără „automat"): inputurile arată valoarea curentă
 *  editabilă și scriu direct în cfg.free. Necontrolate (defaultValue) ca să se poată goli
 *  câmpul în timpul tastării — commit doar la număr valid > 0. */
function FreeDimensionsSection(props: {
  freeEntry: FreePiece;
  updateFree: (patch: Partial<FreePiece>) => void;
}) {
  const { freeEntry, updateFree } = props;
  const onDim = (field: 'lengthMm' | 'widthMm', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    updateFree({ [field]: n });
  };
  return (
    <div className="grid gap-2">
      <Label className={fieldLabelCls}>Dimensiuni</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Lungime (mm)</span>
          <Input
            key={`${freeEntry.id}:L`}
            type="number" step="0.1"
            defaultValue={freeEntry.lengthMm}
            onChange={(e) => onDim('lengthMm', e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Lățime (mm)</span>
          <Input
            key={`${freeEntry.id}:l`}
            type="number" step="0.1"
            defaultValue={freeEntry.widthMm}
            onChange={(e) => onDim('widthMm', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function TopSlotSection(props: {
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
  defaultWidthMm: number;
}) {
  const { cfg, onCfgChange } = props;
  const variant = cfg.top?.variant ?? 'PLIN';
  const setVariant = (v: string) => {
    onCfgChange({ ...cfg, top: { ...cfg.top, variant: v as 'PLIN' | 'PAZII' | 'ABSENT' } });
  };
  const setPazieWidth = (raw: string) => {
    const current = cfg.top ?? { variant: 'PLIN' as const };
    if (raw === '') {
      const { pazieWidthMm: _drop, ...rest } = current;
      onCfgChange({ ...cfg, top: rest });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    onCfgChange({ ...cfg, top: { ...current, pazieWidthMm: n } });
  };
  return (
    <div className="grid gap-1.5">
      <Label className={fieldLabelCls}>Slot capac</Label>
      <SegmentedControl value={variant} onChange={setVariant} options={TOP_OPTIONS} />
      {variant === 'PAZII' && (
        <div className="grid gap-1 pt-1">
          <span className="text-xs text-muted-foreground">Lățime pazie (mm)</span>
          <Input
            type="number" step="0.1"
            value={cfg.top?.pazieWidthMm ?? ''}
            placeholder={fmtNum(props.defaultWidthMm, 0)}
            onChange={(e) => setPazieWidth(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function FreePieceForm(props: {
  materials: ConfiguratorCatalogItem[];
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
  onDone: () => void;
}) {
  const { materials, cfg, onCfgChange } = props;
  const [name, setName] = useState('');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [qty, setQty] = useState('1');
  const [materialId, setMaterialId] = useState('');

  const activeMaterials = materials.filter((m) => m.active !== false);
  const lengthN = Number(lengthMm);
  const widthN = Number(widthMm);
  const qtyN = Number(qty);
  const valid = name.trim().length > 0
    && Number.isFinite(lengthN) && lengthN > 0
    && Number.isFinite(widthN) && widthN > 0
    && Number.isFinite(qtyN) && qtyN > 0
    && materialId !== '';

  const add = () => {
    if (!valid) return;
    const free = [...(cfg.free ?? []), {
      id: crypto.randomUUID(), name: name.trim(), lengthMm: lengthN, widthMm: widthN,
      qty: Math.trunc(qtyN), materialId,
    }];
    onCfgChange({ ...cfg, free });
    props.onDone();
  };

  return (
    <div className="space-y-3">
      <div className="text-[15px] font-bold">Piesă liberă nouă</div>
      <div className="grid gap-1.5">
        <Label className={fieldLabelCls}>Nume</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Poliță suplimentară" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5">
          <Label className={fieldLabelCls}>Lungime (mm)</Label>
          <Input type="number" step="0.1" value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className={fieldLabelCls}>Lățime (mm)</Label>
          <Input type="number" step="0.1" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label className={fieldLabelCls}>Bucăți</Label>
        <Input type="number" step="1" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label className={fieldLabelCls}>Material</Label>
        <select className={selectCls} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          <option value="" disabled>Selectează…</option>
          {activeMaterials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={add} disabled={!valid}>Adaugă</Button>
        <Button type="button" variant="ghost" onClick={props.onDone}>Anulează</Button>
      </div>
    </div>
  );
}

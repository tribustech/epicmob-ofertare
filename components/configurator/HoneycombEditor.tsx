'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  layoutHoneycomb,
  removeHoneycombSplit,
  resizeHoneycombSplit,
  splitHoneycombLeaf,
  type HoneycombNode,
  type HoneycombRect,
  type HoneycombSplit,
} from '@/lib/engine/honeycomb';

interface HoneycombMaterial {
  id: string;
  name: string;
  thicknessMm: number;
  kind: string;
}

interface HoneycombEditorProps {
  root: HoneycombNode;
  widthMm: number;
  heightMm: number;
  carcassThicknessMm: number;
  defaultShelfMaterialId?: string;
  materials: HoneycombMaterial[];
  onChange: (root: HoneycombNode) => void;
}

function findNode(node: HoneycombNode, id: string): HoneycombNode | null {
  if (node.id === id) return node;
  if (node.kind === 'leaf') return null;
  return findNode(node.first, id) ?? findNode(node.second, id);
}

function replaceNode(root: HoneycombNode, id: string, update: (node: HoneycombNode) => HoneycombNode): HoneycombNode {
  if (root.id === id) return update(root);
  if (root.kind === 'leaf') return root;
  return { ...root, first: replaceNode(root.first, id, update), second: replaceNode(root.second, id, update) };
}

function nodeRect(
  node: HoneycombNode,
  id: string,
  rect: HoneycombRect,
  thicknessFor: (split: HoneycombSplit) => number,
): HoneycombRect | null {
  if (node.id === id) return rect;
  if (node.kind === 'leaf') return null;
  const thickness = thicknessFor(node);
  const first = node.axis === 'V'
    ? { ...rect, width: node.firstSizeMm }
    : { ...rect, height: node.firstSizeMm };
  const second = node.axis === 'V'
    ? {
        x: rect.x + node.firstSizeMm + thickness, y: rect.y,
        width: rect.width - node.firstSizeMm - thickness, height: rect.height,
      }
    : {
        x: rect.x, y: rect.y + node.firstSizeMm + thickness,
        width: rect.width, height: rect.height - node.firstSizeMm - thickness,
      };
  return nodeRect(node.first, id, first, thicknessFor) ?? nodeRect(node.second, id, second, thicknessFor);
}

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function HoneycombEditor({
  root, widthMm, heightMm, carcassThicknessMm, defaultShelfMaterialId, materials, onChange,
}: HoneycombEditorProps) {
  const [selectedId, setSelectedId] = useState(root.id);
  const [past, setPast] = useState<HoneycombNode[]>([]);
  const [future, setFuture] = useState<HoneycombNode[]>([]);
  const [draftSize, setDraftSize] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dragStart = useRef<HoneycombNode | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bounds = useMemo(() => ({ x: 0, y: 0, width: widthMm, height: heightMm }), [widthMm, heightMm]);
  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
  const thicknessFor = (split: HoneycombSplit) => split.axis === 'V'
    ? carcassThicknessMm
    : (materialById.get(split.materialId ?? defaultShelfMaterialId ?? '')?.thicknessMm ?? carcassThicknessMm);
  const selected = findNode(root, selectedId);
  const selectedRect = selected ? nodeRect(root, selected.id, bounds, thicknessFor) : null;

  useEffect(() => {
    if (!selected) setSelectedId(root.id);
    if (selected?.kind === 'split') setDraftSize(String(selected.firstSizeMm));
  }, [root, selected, selectedId]);

  const layout = useMemo(() => {
    try {
      return layoutHoneycomb(root, bounds, thicknessFor);
    } catch {
      return { dividers: [], leaves: [] };
    }
  }, [root, bounds, materialById, defaultShelfMaterialId, carcassThicknessMm]);

  const commit = (next: HoneycombNode) => {
    setPast((items) => [...items, root]);
    setFuture([]);
    setError(null);
    onChange(next);
  };

  const split = (axis: 'H' | 'V') => {
    if (!selected || selected.kind !== 'leaf' || !selectedRect) return;
    const materialId = axis === 'H' ? defaultShelfMaterialId : undefined;
    const thickness = axis === 'V'
      ? carcassThicknessMm
      : (materialById.get(materialId ?? '')?.thicknessMm ?? carcassThicknessMm);
    const total = axis === 'V' ? selectedRect.width : selectedRect.height;
    try {
      const splitId = makeId(axis === 'H' ? 'polita' : 'separator');
      const next = splitHoneycombLeaf(root, selected.id, {
        id: splitId, axis, firstSizeMm: Math.round(((total - thickness) / 2) * 10) / 10,
        firstId: makeId('compartiment'), secondId: makeId('compartiment'), materialId,
      });
      commit(next);
      setSelectedId(splitId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Împărțirea nu este posibilă.');
    }
  };

  const applySize = (value = draftSize) => {
    if (!selected || selected.kind !== 'split') return;
    const numeric = Number(value.replace(',', '.'));
    if (!Number.isFinite(numeric)) return;
    try {
      commit(resizeHoneycombSplit(root, selected.id, numeric, bounds, thicknessFor));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Dimensiunea nu este posibilă.');
    }
  };

  const removeSelected = () => {
    if (!selected || selected.kind !== 'split') return;
    try {
      commit(removeHoneycombSplit(root, selected.id));
      setSelectedId(selected.sourceId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delimitarea nu poate fi eliminată.');
    }
  };

  const setShelfMaterial = (materialId: string) => {
    if (!selected || selected.kind !== 'split' || selected.axis !== 'H') return;
    const next = replaceNode(root, selected.id, (node) => node.kind === 'split'
      ? { ...node, materialId: materialId || undefined }
      : node);
    try {
      layoutHoneycomb(next, bounds, thicknessFor);
      commit(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Materialul nu încape în compartiment.');
    }
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [root, ...items]);
    setSelectedId(previous.id);
    onChange(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items, root]);
    setFuture((items) => items.slice(1));
    setSelectedId(next.id);
    onChange(next);
  };

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * widthMm,
      y: heightMm - ((event.clientY - rect.top) / rect.height) * heightMm,
    };
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStart.current || !selected || selected.kind !== 'split' || !selectedRect) return;
    const point = pointerPosition(event);
    const size = selected.axis === 'V' ? point.x - selectedRect.x : point.y - selectedRect.y;
    try {
      const rounded = Math.round(size * 10) / 10;
      onChange(resizeHoneycombSplit(root, selected.id, rounded, bounds, thicknessFor));
      setDraftSize(String(rounded));
      setError(null);
    } catch {
      // cursorul poate ieși temporar din compartiment; păstrăm ultima poziție validă
    }
  };

  const endDrag = () => {
    if (!dragStart.current) return;
    setPast((items) => [...items, dragStart.current!]);
    setFuture([]);
    dragStart.current = null;
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Editor compartimente</p>
          <p className="text-xs text-muted-foreground">Selectează un spațiu sau o delimitare. Trage delimitările pentru poziționare.</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={past.length === 0}>Anulează</Button>
          <Button type="button" variant="outline" size="sm" onClick={redo} disabled={future.length === 0}>Refă</Button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${Math.max(widthMm, 1)} ${Math.max(heightMm, 1)}`}
        className="max-h-[390px] w-full touch-none rounded border bg-white"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {layout.leaves.map((leaf) => {
          const y = heightMm - leaf.y - leaf.height;
          const active = selectedId === leaf.id;
          return (
            <g key={leaf.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(leaf.id); setError(null); }}>
              <rect x={leaf.x} y={y} width={leaf.width} height={leaf.height}
                role="button" aria-label={`Compartiment ${Math.round(leaf.width)} × ${Math.round(leaf.height)} mm`}
                tabIndex={0} data-honeycomb-kind="leaf" data-honeycomb-id={leaf.id}
                fill={active ? '#dbeafe' : '#f8fafc'} stroke={active ? '#2563eb' : '#cbd5e1'} strokeWidth={active ? 3 : 1} />
              {leaf.width > 90 && leaf.height > 55 && (
                <text x={leaf.x + leaf.width / 2} y={y + leaf.height / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.max(10, Math.min(18, leaf.width / 12))} fill="#64748b" pointerEvents="none">
                  {Math.round(leaf.width)} × {Math.round(leaf.height)}
                </text>
              )}
            </g>
          );
        })}
        {layout.dividers.map((divider) => {
          const y = heightMm - divider.y - divider.height;
          const active = selectedId === divider.id;
          return (
            <rect key={divider.id} x={divider.x} y={y} width={divider.width} height={divider.height}
              role="button" aria-label={divider.axis === 'H' ? 'Poliță fagure' : 'Separator vertical fagure'}
              tabIndex={0} data-honeycomb-kind="divider" data-honeycomb-id={divider.id}
              fill={divider.axis === 'H' && materialById.get(divider.materialId ?? defaultShelfMaterialId ?? '')?.kind === 'STICLA_POLITA'
                ? '#7dd3fc99' : active ? '#2563eb' : '#a16207'}
              stroke={active ? '#1d4ed8' : '#713f12'} strokeWidth={active ? 3 : 1}
              className={divider.axis === 'V' ? 'cursor-ew-resize' : 'cursor-ns-resize'}
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedId(divider.id);
                setError(null);
                dragStart.current = root;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            />
          );
        })}
      </svg>

      {selected?.kind === 'leaf' && (
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => split('H')}>＋ Poliță orizontală</Button>
          <Button type="button" variant="outline" onClick={() => split('V')}>＋ Separator vertical</Button>
        </div>
      )}

      {selected?.kind === 'split' && selectedRect && (
        <div className="space-y-3 rounded-md border bg-background p-3">
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="honeycomb-size">
                Distanță {selected.axis === 'V' ? 'din stânga' : 'de jos'} (mm)
              </Label>
              <Input id="honeycomb-size" inputMode="decimal" value={draftSize}
                onChange={(event) => setDraftSize(event.target.value)}
                onBlur={() => applySize()}
                onKeyDown={(event) => { if (event.key === 'Enter') applySize(); }} />
            </div>
            <Button type="button" variant="outline" onClick={() => {
              const total = selected.axis === 'V' ? selectedRect.width : selectedRect.height;
              const equal = Math.round(((total - thicknessFor(selected)) / 2) * 10) / 10;
              setDraftSize(String(equal));
              applySize(String(equal));
            }}>Împarte egal</Button>
          </div>
          {selected.axis === 'H' && (
            <div className="grid gap-1">
              <Label htmlFor="honeycomb-material">Material poliță</Label>
              <select id="honeycomb-material" className="h-9 rounded-md border bg-background px-3 text-sm"
                value={selected.materialId ?? ''} onChange={(event) => setShelfMaterial(event.target.value)}>
                <option value="">Ca materialul implicit al polițelor</option>
                {materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}
              </select>
            </div>
          )}
          <Button type="button" variant="destructive" onClick={removeSelected}>Șterge delimitarea</Button>
        </div>
      )}

      {error && <p className="rounded bg-destructive/10 px-2 py-1 text-sm text-destructive">{error}</p>}
    </div>
  );
}

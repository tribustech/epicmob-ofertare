'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';
import { PieceList } from './PieceList';
import { PiecePanel } from './PiecePanel';

export interface ConfiguratorCatalogItem {
  id: string; name: string; thicknessMm?: number; kind?: string;
  active?: boolean; // absent = toate se consideră disponibile
}

const Scene3D = dynamic(() => import('./Scene3D'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Se încarcă 3D…</div>,
});

const omit = <T,>(o: Record<string, T> | undefined, k: string): Record<string, T> => {
  const { [k]: _, ...rest } = o ?? {};
  return rest;
};

// sheet-ul stă mereu montat la 80vh; închis = translatat în jos până rămâne doar antetul (peek)
const PEEK_PX = 56;

export function ConfiguratorSheet(props: {
  corpLabel: string;
  pieces: PieceInstance[];
  materials: ConfiguratorCatalogItem[];
  edgeBands: ConfiguratorCatalogItem[];
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
  topSlotWidthDefaultMm: number;
}) {
  const [open, setOpen] = useState(false);
  // px de translateY cât timp utilizatorul trage; null = fără drag (poziția vine din `open`)
  const [dragY, setDragY] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [addingFree, setAddingFree] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startY: number; startOffset: number; travel: number } | null>(null);

  const overrideCount = Object.keys(props.cfg.overrides ?? {}).length
    + (props.cfg.free?.length ?? 0)
    + (props.cfg.top && props.cfg.top.variant !== 'PLIN' ? 1 : 0);
  const materialKindById: Record<string, string> = Object.fromEntries(
    props.materials.map((m) => [m.id, m.kind ?? 'PAL']),
  );
  const handleSelect = (key: string | null) => { setSelectedKey(key); setAddingFree(false); };
  const selectedPiece = props.pieces.find((p) => p.key === selectedKey) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const onGripPointerDown = (e: React.PointerEvent) => {
    const h = sheetRef.current?.offsetHeight ?? 0;
    const travel = Math.max(0, h - PEEK_PX);
    drag.current = { startY: e.clientY, startOffset: open ? 0 : travel, travel };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { startY, startOffset, travel } = drag.current;
    setDragY(Math.min(travel, Math.max(0, startOffset + (e.clientY - startY))));
  };
  const onGripPointerUp = () => {
    if (!drag.current) return;
    const { startOffset, travel } = drag.current;
    const moved = (dragY ?? startOffset) - startOffset;
    if (Math.abs(moved) < 8) {
      if (!open) setOpen(true); // tap pe peek = deschide; tap pe antet deschis nu face nimic
    } else {
      // tras suficient (peste 20% din cursă sau 80px) → comută; altfel revine
      const threshold = Math.min(80, travel * 0.2);
      if (moved < -threshold) setOpen(true);
      else if (moved > threshold) setOpen(false);
    }
    drag.current = null;
    setDragY(null);
  };

  const dragging = dragY !== null;
  const showContent = open || dragging;
  const transform = dragging
    ? `translateY(${dragY}px)`
    : open ? 'translateY(0)' : `translateY(calc(100% - ${PEEK_PX}px))`;

  return (
    <>
      {/* fundal întunecat, doar cât sheet-ul e deschis; click = închide */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-foreground/25 transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-2xl border border-b-0 border-border bg-background shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
        style={{ transform, transition: dragging ? 'none' : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <div
          onPointerDown={onGripPointerDown}
          onPointerMove={onGripPointerMove}
          onPointerUp={onGripPointerUp}
          onPointerCancel={onGripPointerUp}
          className="flex shrink-0 cursor-grab select-none items-center justify-between px-6 active:cursor-grabbing"
          style={{ height: PEEK_PX, touchAction: 'none' }}
        >
          <div className="flex items-center gap-3">
            <div className="h-1 w-9 rounded-full bg-muted-foreground/40" />
            <span className="text-sm font-bold">Configurator piese · {props.corpLabel}</span>
            <span className="text-xs text-muted-foreground">
              {props.pieces.length} piese{overrideCount > 0 ? ` · ${overrideCount} cu modificări` : ''}
              {!open && !dragging ? ' · trage sau apasă ↑' : ''}
            </span>
          </div>
          {open && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Închide ✕
            </button>
          )}
        </div>
        {showContent && (
          <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_360px] border-t border-border">
            <div className="overflow-y-auto border-r border-border p-3">
              <PieceList
                pieces={props.pieces}
                cfg={props.cfg}
                selectedKey={selectedKey}
                onSelect={handleSelect}
                onRestore={(key) => props.onCfgChange({ ...props.cfg, overrides: omit(props.cfg.overrides, key) })}
                onAddFree={() => setAddingFree(true)}
              />
            </div>
            <div className="relative h-full min-h-0">
              <Scene3D
                pieces={props.pieces}
                selectedKey={selectedKey}
                onSelect={handleSelect}
                materialKindById={materialKindById}
              />
            </div>
            <div className="overflow-y-auto border-l border-border p-4">
              <PiecePanel
                piece={selectedPiece}
                cfg={props.cfg}
                onCfgChange={props.onCfgChange}
                materials={props.materials}
                edgeBands={props.edgeBands}
                addingFree={addingFree}
                onDoneAddingFree={() => setAddingFree(false)}
                topSlotWidthDefaultMm={props.topSlotWidthDefaultMm}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

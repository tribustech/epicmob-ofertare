'use client';
import { useEffect, useState } from 'react';
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [addingFree, setAddingFree] = useState(false);
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent-blue bg-card/95 px-6 py-2 text-left shadow-lg backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1340px] items-center gap-3">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/40" />
          <span className="text-sm font-bold">Configurator piese · {props.corpLabel}</span>
          <span className="text-xs text-muted-foreground">
            {props.pieces.length} piese{overrideCount > 0 ? ` · ${overrideCount} cu modificări` : ''} · click pentru deschidere ↑
          </span>
        </div>
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <span className="text-sm font-bold">Configurator piese · {props.corpLabel}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Închide ✕</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_360px]">
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
    </div>
  );
}

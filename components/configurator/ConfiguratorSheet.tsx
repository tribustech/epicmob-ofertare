'use client';
import { useEffect, useState } from 'react';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';

export interface ConfiguratorCatalogItem { id: string; name: string; thicknessMm?: number; kind?: string }

export function ConfiguratorSheet(props: {
  corpLabel: string;
  pieces: PieceInstance[];
  materials: ConfiguratorCatalogItem[];
  edgeBands: ConfiguratorCatalogItem[];
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const overrideCount = Object.keys(props.cfg.overrides ?? {}).length
    + (props.cfg.free?.length ?? 0)
    + (props.cfg.top && props.cfg.top.variant !== 'PLIN' ? 1 : 0);

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
        <div className="overflow-y-auto border-r border-border p-3">{/* Task 8: PieceList */}</div>
        <div className="relative">{/* Task 9: Scene3D */}</div>
        <div className="overflow-y-auto border-l border-border p-4">{/* Task 10: PiecePanel */}</div>
      </div>
    </div>
  );
}

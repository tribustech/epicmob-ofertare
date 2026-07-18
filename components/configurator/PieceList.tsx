'use client';
import { Eye, EyeOff } from 'lucide-react';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function PieceList(props: {
  pieces: PieceInstance[];
  cfg: PiecesConfigForm;
  selectedKey: string | null;
  hoveredKey?: string | null;
  /** chei ascunse DOAR din scena 3D (filtru de vizualizare — piesa rămâne în calcul) */
  hiddenKeys?: Set<string>;
  onSelect: (key: string) => void;
  onHover?: (key: string | null) => void;
  onToggleVisibility?: (key: string) => void;
  onShowAll?: () => void;
  onRestore: (key: string) => void;
  onAddFree: () => void;
}) {
  const removed = Object.entries(props.cfg.overrides ?? {})
    .filter(([, ov]) => ov.removed).map(([k]) => k);
  const hiddenCount = props.hiddenKeys?.size ?? 0;
  return (
    <div className="space-y-0.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Piese</span>
        {hiddenCount > 0 && props.onShowAll && (
          <button type="button" onClick={props.onShowAll} className="text-xs text-accent-blue">
            Arată tot ({hiddenCount} ascunse)
          </button>
        )}
      </div>
      {props.pieces.map((pc) => {
        const hidden = props.hiddenKeys?.has(pc.key) ?? false;
        return (
          <button
            key={pc.key} type="button" onClick={() => props.onSelect(pc.key)}
            onMouseEnter={() => props.onHover?.(pc.key)}
            onMouseLeave={() => props.onHover?.(null)}
            className={`group flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
              props.selectedKey === pc.key ? 'bg-accent-blue/10 ring-1 ring-accent-blue'
              : props.hoveredKey === pc.key ? 'bg-accent-blue/10' : ''
            } ${hidden ? 'opacity-50' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {(pc.manual && Object.keys(pc.manual).length > 0) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-blue" />}
              <span className="truncate">{pc.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="font-mono text-xs text-muted-foreground">{fmt(pc.lengthMm)}×{fmt(pc.widthMm)}</span>
              {props.onToggleVisibility && (
                <span
                  role="button"
                  aria-label={hidden ? 'Arată în 3D' : 'Ascunde din 3D'}
                  title={hidden ? 'Arată în 3D' : 'Ascunde din 3D'}
                  onClick={(e) => { e.stopPropagation(); props.onToggleVisibility!(pc.key); }}
                  className={`cursor-pointer text-muted-foreground hover:text-foreground ${hidden ? '' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </span>
              )}
            </span>
          </button>
        );
      })}
      {removed.map((key) => (
        <div key={key} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-muted-foreground opacity-60">
          <span className="line-through">{key}</span>
          <button type="button" className="text-accent-blue" onClick={() => props.onRestore(key)}>↺</button>
        </div>
      ))}
      <button type="button" onClick={props.onAddFree}
        className="mt-2 w-full rounded border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
        ＋ Piesă liberă
      </button>
    </div>
  );
}

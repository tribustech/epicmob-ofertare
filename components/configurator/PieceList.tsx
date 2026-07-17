'use client';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function PieceList(props: {
  pieces: PieceInstance[];
  cfg: PiecesConfigForm;
  selectedKey: string | null;
  hoveredKey?: string | null;
  onSelect: (key: string) => void;
  onHover?: (key: string | null) => void;
  onRestore: (key: string) => void;
  onAddFree: () => void;
}) {
  const removed = Object.entries(props.cfg.overrides ?? {})
    .filter(([, ov]) => ov.removed).map(([k]) => k);
  return (
    <div className="space-y-0.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Piese</div>
      {props.pieces.map((pc) => (
        <button
          key={pc.key} type="button" onClick={() => props.onSelect(pc.key)}
          onMouseEnter={() => props.onHover?.(pc.key)}
          onMouseLeave={() => props.onHover?.(null)}
          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
            props.selectedKey === pc.key ? 'bg-accent-blue/10 ring-1 ring-accent-blue'
            : props.hoveredKey === pc.key ? 'bg-accent-blue/10' : ''
          }`}
        >
          <span className="flex items-center gap-1.5">
            {(pc.manual && Object.keys(pc.manual).length > 0) && <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />}
            {pc.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{fmt(pc.lengthMm)}×{fmt(pc.widthMm)}</span>
        </button>
      ))}
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

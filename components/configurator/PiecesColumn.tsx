'use client';
import { EDGE_SIDES } from '@/lib/engine';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';
import { fmtNum } from '@/lib/format';
import { PieceList } from './PieceList';
import { PiecePanel } from './PiecePanel';

export interface ConfiguratorCatalogItem {
  id: string; name: string; thicknessMm?: number; kind?: string;
  active?: boolean; // absent = toate se consideră disponibile
}

const omit = <T,>(o: Record<string, T> | undefined, k: string): Record<string, T> => {
  const { [k]: _, ...rest } = o ?? {};
  return rest;
};

const sectionHeadingCls = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const rowCls = 'flex items-baseline justify-between gap-3 text-sm';
const rowValueCls = 'font-mono tabular-nums text-xs text-muted-foreground';

export function PiecesColumn(props: {
  pieces: PieceInstance[];
  selectedPiece: PieceInstance | null;
  onSelect: (key: string | null) => void;
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
  materials: ConfiguratorCatalogItem[];
  edgeBands: ConfiguratorCatalogItem[];
  addingFree: boolean;
  onAddFree: () => void;
  onDoneAddingFree: () => void;
  topSlotWidthDefaultMm: number;
  hardwareRows: { name: string; qty: number }[];
}) {
  const { pieces, selectedPiece, addingFree } = props;

  if (selectedPiece !== null || addingFree) {
    return (
      <div className="rounded-xl bg-card p-4 ring-1 ring-border">
        <button
          type="button"
          onClick={() => { props.onSelect(null); props.onDoneAddingFree(); }}
          className="mb-3 text-sm text-accent-blue"
        >
          ← Toate piesele
        </button>
        <PiecePanel
          piece={selectedPiece}
          cfg={props.cfg}
          onCfgChange={props.onCfgChange}
          materials={props.materials}
          edgeBands={props.edgeBands}
          addingFree={props.addingFree}
          onDoneAddingFree={props.onDoneAddingFree}
          topSlotWidthDefaultMm={props.topSlotWidthDefaultMm}
        />
      </div>
    );
  }

  // metraj per cant (ml), derivat din muchiile bucăților
  const edgingMl = new Map<string, number>();
  for (const pc of pieces) {
    for (const side of EDGE_SIDES) {
      const band = pc.edges[side];
      const axis = pc.edgeAxis[side];
      if (!band || !axis) continue;
      const mm = axis === 'L' ? pc.lengthMm : pc.widthMm;
      edgingMl.set(band, (edgingMl.get(band) ?? 0) + mm / 1000);
    }
  }
  const edgingRows = [...edgingMl.entries()];

  return (
    <div className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-border">
      <div>
        <PieceList
          pieces={props.pieces}
          cfg={props.cfg}
          selectedKey={null}
          onSelect={(k) => props.onSelect(k)}
          onRestore={(key) => props.onCfgChange({ ...props.cfg, overrides: omit(props.cfg.overrides, key) })}
          onAddFree={props.onAddFree}
        />
      </div>

      {edgingRows.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <div className={sectionHeadingCls}>Canturi</div>
          {edgingRows.map(([bandId, ml]) => (
            <div key={bandId} className={rowCls}>
              <span>{props.edgeBands.find((b) => b.id === bandId)?.name ?? bandId}</span>
              <span className={rowValueCls}>{fmtNum(ml, 1)} ml</span>
            </div>
          ))}
        </div>
      )}

      {props.hardwareRows.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <div className={sectionHeadingCls}>Feronerie</div>
          {props.hardwareRows.map((r) => (
            <div key={r.name} className={rowCls}>
              <span>{r.name}</span>
              <span className={rowValueCls}>×{r.qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

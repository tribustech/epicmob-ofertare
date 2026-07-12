import type { SheetLayout } from '@/lib/engine';

// Desenul unei plăci: fundal hașurat = pierdere, dreptunghiuri albe = piese.
// viewBox e în mm, deci coordonatele pieselor se folosesc direct.
export function CuttingLayoutSvg({ layout, sheetLengthMm, sheetWidthMm, patternId }: {
  layout: SheetLayout;
  sheetLengthMm: number;
  sheetWidthMm: number;
  patternId: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${sheetLengthMm} ${sheetWidthMm}`}
      className="w-full rounded border"
      role="img"
    >
      <defs>
        <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="40" height="40" fill="#f5f5f4" />
          <line x1="0" y1="0" x2="0" y2="40" stroke="#d6d3d1" strokeWidth="12" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={sheetLengthMm} height={sheetWidthMm} fill={`url(#${patternId})`} stroke="#78716c" strokeWidth="4" />
      {layout.pieces.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.lengthMm} height={p.widthMm} fill="#ffffff" stroke="#57534e" strokeWidth="3" />
          {p.widthMm >= 55 && <text x={p.x + 14} y={p.y + 44} fontSize="36" fill="#44403c">{p.label}</text>}
          {p.widthMm >= 100 && <text x={p.x + 14} y={p.y + 84} fontSize="32" fill="#78716c">{p.lengthMm}×{p.widthMm}</text>}
        </g>
      ))}
    </svg>
  );
}

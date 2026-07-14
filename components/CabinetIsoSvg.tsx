import { useMemo } from 'react';
import type { CabinetInput, ConstructionConstants } from '@/lib/engine';
import { buildIsoModel } from '@/lib/iso/geometry';
import { fmtNum } from '@/lib/format';

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

// punct 3D (mm) → punct 2D în planul izometric
function iso(x: number, y: number, z: number): [number, number] {
  return [(x + z) * COS30, (x - z) * SIN30 - y];
}

function poly(points: [number, number, number][]): string {
  return points.map((p) => iso(...p).map((v) => v.toFixed(1)).join(',')).join(' ');
}

export function CabinetIsoSvg({ input, cc }: { input: CabinetInput; cc: ConstructionConstants }) {
  const model = useMemo(() => buildIsoModel(input, cc), [input, cc]);
  const { widthMm: W, heightMm: H, depthMm: D } = model;

  // limitele desenului pentru viewBox (toate cele 8 colțuri ale cutiei + spațiu pentru cote)
  const corners: [number, number, number][] = [
    [0, 0, 0], [W, 0, 0], [0, H, 0], [W, H, 0],
    [0, 0, D], [W, 0, D], [0, H, D], [W, H, D],
  ];
  const pts = corners.map((c) => iso(...c));
  const pad = 90;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const maxX = Math.max(...pts.map((p) => p[0])) + pad;
  const minY = Math.min(...pts.map((p) => p[1])) - pad;
  const maxY = Math.max(...pts.map((p) => p[1])) + pad;

  const frontFill = '#ffffff';
  const sideFill = '#e7e2da';
  const topFill = '#f1ede6';
  const stroke = '#57534e';

  return (
    <svg
      viewBox={`${minX.toFixed(0)} ${minY.toFixed(0)} ${(maxX - minX).toFixed(0)} ${(maxY - minY).toFixed(0)}`}
      className="mx-auto w-full max-w-md"
      role="img"
      aria-label={`Previzualizare corp ${input.label}`}
    >
      <defs>
        <pattern id="hatch" width="14" height="14" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="14" stroke={stroke} strokeWidth="1.5" opacity="0.35" />
        </pattern>
      </defs>

      {/* fața laterală dreaptă (x = W) */}
      <polygon points={poly([[W, 0, 0], [W, 0, D], [W, H, D], [W, H, 0]])} fill={sideFill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      {/* blatul (y = H) */}
      <polygon points={poly([[0, H, 0], [W, H, 0], [W, H, D], [0, H, D]])} fill={topFill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      {/* fața frontală (z = 0) — interiorul corpului */}
      <polygon points={poly([[0, 0, 0], [W, 0, 0], [W, H, 0], [0, H, 0]])} fill={frontFill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />

      {/* polițele — muchii orizontale vizibile prin fronturi */}
      {model.shelfYsMm.map((y, i) => (
        <line
          key={`shelf-${i}`}
          x1={iso(12, y, 0)[0]} y1={iso(12, y, 0)[1]}
          x2={iso(W - 12, y, 0)[0]} y2={iso(W - 12, y, 0)[1]}
          stroke={stroke} strokeWidth="2" opacity="0.5"
        />
      ))}

      {/* fronturile — semitransparente ca polițele să rămână vizibile */}
      {model.fronts.map((f, i) => (
        <g key={`front-${i}`}>
          <polygon
            points={poly([
              [f.xMm, f.yMm, 0], [f.xMm + f.wMm, f.yMm, 0],
              [f.xMm + f.wMm, f.yMm + f.hMm, 0], [f.xMm, f.yMm + f.hMm, 0],
            ])}
            fill={f.kind === 'PANOU_ORB' ? 'url(#hatch)' : '#cdd7e1'}
            fillOpacity={f.kind === 'PANOU_ORB' ? 1 : 0.6}
            stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"
          />
          {f.handle && (
            <circle cx={iso(f.handle.xMm, f.handle.yMm, 0)[0]} cy={iso(f.handle.xMm, f.handle.yMm, 0)[1]} r="5" fill={stroke} />
          )}
        </g>
      ))}

      {/* cote */}
      <text x={iso(W / 2, 0, 0)[0]} y={iso(W / 2, 0, 0)[1] + 34} textAnchor="middle" fontSize="26" fill={stroke}>
        L {fmtNum(W, 0)}
      </text>
      <text x={iso(0, H / 2, 0)[0] - 14} y={iso(0, H / 2, 0)[1]} textAnchor="end" fontSize="26" fill={stroke}>
        H {fmtNum(H, 0)}
      </text>
      <text x={iso(W, H, D / 2)[0] + 14} y={iso(W, H, D / 2)[1] - 10} textAnchor="start" fontSize="26" fill={stroke}>
        A {fmtNum(D, 0)}
      </text>
    </svg>
  );
}

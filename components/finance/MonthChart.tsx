'use client';

import { useState } from 'react';
import { fmtLei } from '@/lib/format';
import { monthLabel } from '@/lib/finance/month';

export interface MonthPoint { key: string; contribution: number; fixed: number; net: number }

const C_CONTRIB = '#3B6FD9'; // validat (dataviz): ΔE ok, contrast cu relief prin tabel + etichete
const C_FIXED = '#D98C2B';
const C_NET = '#18181b';

/**
 * Ultimele 12 luni: bare subțiri contribuție vs fixe, linia net. O singură axă. Legendă + tooltip la hover;
 * tabelul de sub grafic e „table view"-ul pentru accesibilitate.
 */
export function MonthChart({ points }: { points: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960; const H = 260; const padL = 56; const padR = 12; const padT = 16; const padB = 36;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const maxBar = Math.max(1, ...points.map((p) => Math.max(p.contribution, p.fixed)));
  const minNet = Math.min(0, ...points.map((p) => p.net));
  const maxV = Math.max(maxBar, ...points.map((p) => p.net));
  const span = maxV - minNet || 1;
  const y = (v: number) => padT + innerH - ((v - minNet) / span) * innerH;
  const zero = y(0);
  const slot = innerW / Math.max(1, points.length);
  const barW = Math.max(6, Math.min(18, slot * 0.28));
  const ticks = [minNet, 0, maxV].filter((v, i, a) => a.indexOf(v) === i);
  const short = (k: string) => monthLabel(k).slice(0, 3).toLowerCase() + ' ' + k.slice(2, 4);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[3px]" style={{ background: C_CONTRIB }} /> contribuție</span>
        <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-[3px]" style={{ background: C_FIXED }} /> cheltuieli fixe</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4" style={{ background: C_NET }} /> net</span>
      </div>
      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Contribuție, cheltuieli fixe și net pe ultimele 12 luni">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#e6e6e2" strokeWidth={1} />
              <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="#71717a" fontFamily="IBM Plex Mono, monospace">{Math.round(v / 1000)}k</text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = padL + slot * i + slot / 2;
            const bar = (v: number, x: number, color: string) => {
              const top = Math.min(y(v), zero); const h = Math.abs(zero - y(v));
              return <rect x={x} y={top} width={barW} height={Math.max(0, h)} rx={3} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />;
            };
            return (
              <g key={p.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill="transparent" />
                {bar(p.contribution, cx - barW - 1, C_CONTRIB)}
                {bar(p.fixed, cx + 1, C_FIXED)}
                <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize={10.5} fill="#71717a">{short(p.key)}</text>
              </g>
            );
          })}
          <polyline
            fill="none" stroke={C_NET} strokeWidth={2} strokeLinejoin="round"
            points={points.map((p, i) => `${padL + slot * i + slot / 2},${y(p.net)}`).join(' ')}
          />
          {points.map((p, i) => (
            <circle key={p.key} cx={padL + slot * i + slot / 2} cy={y(p.net)} r={hover === i ? 5 : 3.5} fill={C_NET} stroke="#fff" strokeWidth={2} />
          ))}
        </svg>
        {hover !== null && points[hover] && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-foreground px-3 py-2 text-[12px] text-background shadow">
            <div className="font-semibold">{monthLabel(points[hover].key)}</div>
            <div className="font-mono">contribuție {fmtLei(points[hover].contribution)} · fixe {fmtLei(points[hover].fixed)} · net {fmtLei(points[hover].net)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

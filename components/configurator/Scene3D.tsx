'use client';
import { Canvas } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import type { PieceInstance } from '@/lib/engine';

const KIND_COLORS: Record<string, string> = {
  PAL: '#c9a87c', MDF_MELAMINAT: '#d8cdb8', MDF_INFOLIAT: '#d8d3c8',
  MDF_VOPSIT: '#cfd4d8', PFL: '#b8a888',
};
const S = 1 / 1000; // mm → unități scenă (metri)
const fmt = (n: number) => String(Math.round(n * 10) / 10);

function PieceMesh({ pc, color, selected, onSelect }: {
  pc: PieceInstance; color: string; selected: boolean; onSelect: (key: string) => void;
}) {
  const p = pc.placement!;
  return (
    <mesh
      position={[(p.x + p.w / 2) * S, (p.y + p.h / 2) * S, (p.z + p.d / 2) * S]}
      onClick={(e) => { e.stopPropagation(); onSelect(pc.key); }}
    >
      <boxGeometry args={[p.w * S, p.h * S, p.d * S]} />
      <meshStandardMaterial color={selected ? '#5b8def' : color} transparent opacity={selected ? 0.95 : 0.92} />
      <Edges color={selected ? '#2b5fd9' : '#8a6d45'} lineWidth={selected ? 2 : 1} />
      {selected && (
        <Html center distanceFactor={1.6} position={[0, p.h * S / 2 + 0.04, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-foreground/90 px-2 py-0.5 font-mono text-[11px] text-background shadow">
            {pc.label}: {fmt(pc.lengthMm)} × {fmt(pc.widthMm)} mm
          </div>
        </Html>
      )}
    </mesh>
  );
}

export default function Scene3D({ pieces, selectedKey, onSelect, materialKindById }: {
  pieces: PieceInstance[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  materialKindById: Record<string, string>;
}) {
  const placed = pieces.filter((p) => p.placement);
  const maxDim = Math.max(...placed.map((p) => Math.max(
    p.placement!.x + p.placement!.w, p.placement!.y + p.placement!.h, p.placement!.z + p.placement!.d,
  )), 600) * S;
  const cx = Math.max(...placed.map((p) => p.placement!.x + p.placement!.w), 1) * S / 2;
  const cy = Math.max(...placed.map((p) => p.placement!.y + p.placement!.h), 1) * S / 2;
  return (
    <Canvas
      camera={{ position: [maxDim * 1.6, maxDim * 1.2, maxDim * 2.2], fov: 40 }}
      onPointerMissed={() => onSelect(null)}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <group position={[-cx, -cy, 0]}>
        {placed.map((pc) => (
          <PieceMesh
            key={pc.key} pc={pc} selected={pc.key === selectedKey} onSelect={onSelect}
            color={KIND_COLORS[materialKindById[pc.materialId] ?? 'PAL'] ?? '#c9a87c'}
          />
        ))}
      </group>
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
    </Canvas>
  );
}

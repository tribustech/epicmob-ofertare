'use client';
import { Canvas } from '@react-three/fiber';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import type { EdgeSide, PieceInstance, PiecePlacement } from '@/lib/engine';

const KIND_COLORS: Record<string, string> = {
  PAL: '#c9a87c', MDF_MELAMINAT: '#d8cdb8', MDF_INFOLIAT: '#d8d3c8',
  MDF_VOPSIT: '#cfd4d8', PFL: '#b8a888',
  STICLA_RAMA: '#b9e5f2',
  STICLA_POLITA: '#c9edf5',
};
const S = 1 / 1000; // mm → unități scenă (metri)
const fmt = (n: number) => String(Math.round(n * 10) / 10);

type Axis3 = 'x' | 'y' | 'z';
const AXES: Axis3[] = ['x', 'y', 'z'];

// harta laturilor semantice → axa și semnul feței pe care stă cantul
const SIDE_DIR: Record<EdgeSide, { axis: Axis3; sign: 1 | -1 }> = {
  fata: { axis: 'z', sign: 1 }, spate: { axis: 'z', sign: -1 },
  sus: { axis: 'y', sign: 1 }, jos: { axis: 'y', sign: -1 },
  stanga: { axis: 'x', sign: -1 }, dreapta: { axis: 'x', sign: 1 },
};

/** geometria box-ului subțire care evidențiază muchia `side` a piesei — poziție/dimensiune
 *  locale, relative la centrul mesh-ului (mesh-ul e deja translatat la centrul piesei). */
function edgeHighlightGeometry(p: PiecePlacement, side: EdgeSide): { position: [number, number, number]; size: [number, number, number] } {
  const dims: Record<Axis3, number> = { x: p.w, y: p.h, z: p.d };
  const t = AXES.reduce((a, b) => (dims[b] < dims[a] ? b : a)); // axa grosimii = dimensiunea minimă
  const { axis: e, sign } = SIDE_DIR[side]; // axa muchiei
  const s = AXES.find((a) => a !== t && a !== e)!; // axa de întindere = a treia
  const size: Record<Axis3, number> = { x: 0, y: 0, z: 0 };
  size[e] = 6 * S;
  size[t] = (dims[t] + 2) * S;
  size[s] = (dims[s] + 2) * S;
  const position: Record<Axis3, number> = { x: 0, y: 0, z: 0 };
  position[e] = sign * (dims[e] / 2) * S;
  return { position: [position.x, position.y, position.z], size: [size.x, size.y, size.z] };
}

/** poziția/rotația marcajului de decor „»»»" pe fața mare a piesei — decorul curge pe axa
 *  care corespunde lungimii de debitare (lengthMm), nu pe axa grosimii. */
function grainMarkTransform(pc: PieceInstance, p: PiecePlacement): { positions: [number, number, number][]; rotation: [number, number, number] } {
  const dims: Record<Axis3, number> = { x: p.w, y: p.h, z: p.d };
  const t = AXES.reduce((a, b) => (dims[b] < dims[a] ? b : a)); // axa grosimii
  const grainAxis = AXES.filter((a) => a !== t).find((a) => Math.abs(dims[a] - pc.lengthMm) < 0.5) ?? AXES.find((a) => a !== t)!;
  // pe AMBELE fețe mari ale piesei, ca direcția să se vadă din orice unghi
  const positions = ([1, -1] as const).map((sign) => {
    const pos: Record<Axis3, number> = { x: 0, y: 0, z: 0 };
    pos[t] = sign * (dims[t] / 2 + 1) * S;
    return [pos.x, pos.y, pos.z] as [number, number, number];
  });
  let rotation: [number, number, number];
  if (t === 'y') rotation = [-Math.PI / 2, 0, grainAxis === 'z' ? -Math.PI / 2 : 0];
  else if (t === 'z') rotation = [0, 0, grainAxis === 'y' ? Math.PI / 2 : 0];
  else rotation = [0, Math.PI / 2, grainAxis === 'y' ? Math.PI / 2 : 0];
  return { positions, rotation };
}

/** Direcția decorului ca „>>>" din geometrie pură (fără fonturi — drei Text/troika nu randează
 *  fiabil aici): 3 chevron-uri din bare subțiri, în planul XY local, cu vârfurile spre +x. */
function GrainArrows({ position, rotation }: {
  position: [number, number, number]; rotation: [number, number, number];
}) {
  const L = 26 * S;   // lungimea unui braț
  const TH = 5 * S;   // grosimea barei
  const D = 1 * S;    // adâncimea (plată, deasupra feței)
  const SP = 24 * S;  // distanța dintre chevron-uri
  const c = (Math.SQRT1_2 * L) / 2; // offsetul centrului brațului față de vârf
  return (
    <group position={position} rotation={rotation}>
      {[-1, 0, 1].map((i) => (
        <group key={i} position={[i * SP, 0, 0]}>
          <mesh position={[-c, c, 0]} rotation={[0, 0, -Math.PI / 4]} raycast={() => null}>
            <boxGeometry args={[L, TH, D]} />
            <meshBasicMaterial color="#3d2f1d" transparent opacity={0.9} />
          </mesh>
          <mesh position={[-c, -c, 0]} rotation={[0, 0, Math.PI / 4]} raycast={() => null}>
            <boxGeometry args={[L, TH, D]} />
            <meshBasicMaterial color="#3d2f1d" transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Ramă vizibilă pe conturul unei piese de sticlă, indiferent de orientarea piesei. */
function GlassFrame({ p }: { p: PiecePlacement }) {
  const dims: Record<Axis3, number> = { x: p.w, y: p.h, z: p.d };
  const thicknessAxis = AXES.reduce((a, b) => (dims[b] < dims[a] ? b : a));
  const [horizontal, vertical] = AXES.filter((axis) => axis !== thicknessAxis);
  const frameMm = Math.max(8, Math.min(30, dims[horizontal] / 4, dims[vertical] / 4));
  const makeBar = (key: string, axis: Axis3, offsetAxis: Axis3, offset: number) => {
    const size: Record<Axis3, number> = {
      x: dims.x * S, y: dims.y * S, z: dims.z * S,
    };
    size[axis] = dims[axis] * S;
    size[offsetAxis] = frameMm * S;
    size[thicknessAxis] = Math.max(dims[thicknessAxis], 12) * S;
    const position: Record<Axis3, number> = { x: 0, y: 0, z: 0 };
    position[offsetAxis] = offset * (dims[offsetAxis] - frameMm) * S / 2;
    return (
      <mesh key={key} position={[position.x, position.y, position.z]} raycast={() => null}>
        <boxGeometry args={[size.x, size.y, size.z]} />
        <meshStandardMaterial color="#616a70" metalness={0.35} roughness={0.35} />
      </mesh>
    );
  };
  return (
    <group>
      {makeBar('frame-a1', horizontal, vertical, -1)}
      {makeBar('frame-a2', horizontal, vertical, 1)}
      {makeBar('frame-b1', vertical, horizontal, -1)}
      {makeBar('frame-b2', vertical, horizontal, 1)}
    </group>
  );
}

function PieceMesh({ pc, kind, color, selected, hovered, hoveredEdge, hasGrain, onSelect, onHover }: {
  pc: PieceInstance; kind: string; color: string; selected: boolean; hovered: boolean;
  hoveredEdge: EdgeSide | null; hasGrain: boolean;
  onSelect: (key: string) => void; onHover: (key: string | null) => void;
}) {
  const p = pc.placement!;
  const edgeHighlight = selected && hoveredEdge && pc.edgeAxis[hoveredEdge] !== undefined
    ? edgeHighlightGeometry(p, hoveredEdge)
    : null;
  const grainMark = hasGrain ? grainMarkTransform(pc, p) : null;
  const isGlass = kind === 'STICLA_RAMA';
  const isGlassShelf = kind === 'STICLA_POLITA';
  const isTransparentGlass = isGlass || isGlassShelf;
  return (
    <mesh
      position={[(p.x + p.w / 2) * S, (p.y + p.h / 2) * S, (p.z + p.d / 2) * S]}
      onClick={(e) => { e.stopPropagation(); onSelect(pc.key); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(pc.key); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
    >
      <boxGeometry args={[p.w * S, p.h * S, p.d * S]} />
      <meshStandardMaterial
        color={selected ? '#5b8def' : hovered ? '#93b3f0' : color}
        transparent opacity={isTransparentGlass ? (selected || hovered ? 0.5 : 0.24) : selected ? 0.95 : 0.92}
        depthWrite={!isTransparentGlass}
      />
      <Edges color={selected || hovered ? '#2b5fd9' : isTransparentGlass ? '#71858d' : '#8a6d45'} lineWidth={selected ? 2 : hovered ? 1.5 : 1} />
      {isGlass && <GlassFrame p={p} />}
      {edgeHighlight && (
        <mesh position={edgeHighlight.position} raycast={() => null}>
          <boxGeometry args={edgeHighlight.size} />
          {/* portocaliu — contrast pe piesa selectată (albastră), nu se pierde ca albastru-pe-albastru */}
          <meshBasicMaterial color="#ff9f1c" />
        </mesh>
      )}
      {grainMark && grainMark.positions.map((pos, i) => (
        <GrainArrows key={i} position={pos} rotation={grainMark.rotation} />
      ))}
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

/** Previzualizarea izolată a unei singure piese (cardul din coloana contextuală):
 *  piesa centrată, rotibilă, cu evidențierea muchiei la hover pe cant și săgețile de fibră. */
export function PiecePreview3D({ piece, kind, hasGrain, hoveredEdge, thicknessMm }: {
  piece: PieceInstance;
  kind: string;
  hasGrain: boolean;
  hoveredEdge?: EdgeSide | null;
  thicknessMm: number; // grosimea materialului — folosită când piesa nu are placement (piesă liberă)
}) {
  // orientarea din corp dacă există; piesele libere se arată culcate (L × grosime × l)
  const p: PiecePlacement = piece.placement
    ?? { x: 0, y: 0, z: 0, w: piece.lengthMm, h: thicknessMm, d: piece.widthMm };
  const maxDim = Math.max(p.w, p.h, p.d) * S;
  const edgeHighlight = hoveredEdge && piece.edgeAxis[hoveredEdge] !== undefined
    ? edgeHighlightGeometry(p, hoveredEdge)
    : null;
  const grainMark = hasGrain ? grainMarkTransform(piece, p) : null;
  const isGlass = kind === 'STICLA_RAMA';
  const isGlassShelf = kind === 'STICLA_POLITA';
  const isTransparentGlass = isGlass || isGlassShelf;
  return (
    <Canvas camera={{ position: [maxDim * 1.1, maxDim * 0.9, maxDim * 1.5], fov: 35 }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <mesh>
        <boxGeometry args={[p.w * S, p.h * S, p.d * S]} />
        <meshStandardMaterial color={KIND_COLORS[kind] ?? '#c9a87c'} transparent opacity={isTransparentGlass ? 0.24 : 0.95} depthWrite={!isTransparentGlass} />
        <Edges color={isTransparentGlass ? '#71858d' : '#8a6d45'} />
        {isGlass && <GlassFrame p={p} />}
        {edgeHighlight && (
          <mesh position={edgeHighlight.position} raycast={() => null}>
            <boxGeometry args={edgeHighlight.size} />
            <meshBasicMaterial color="#ff9f1c" />
          </mesh>
        )}
        {grainMark && grainMark.positions.map((pos, i) => (
          <GrainArrows key={i} position={pos} rotation={grainMark.rotation} />
        ))}
      </mesh>
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}

export default function Scene3D({
  pieces, selectedKey, hoveredKey, hoveredEdge, onSelect, onHover, materialKindById, materialGrainById,
}: {
  pieces: PieceInstance[];
  selectedKey: string | null;
  hoveredKey: string | null;
  hoveredEdge?: EdgeSide | null;
  onSelect: (key: string | null) => void;
  onHover: (key: string | null) => void;
  materialKindById: Record<string, string>;
  materialGrainById?: Record<string, boolean>;
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
            key={pc.key} pc={pc} selected={pc.key === selectedKey} hovered={pc.key === hoveredKey && pc.key !== selectedKey}
            hoveredEdge={pc.key === selectedKey ? (hoveredEdge ?? null) : null}
            hasGrain={materialGrainById?.[pc.materialId] ?? false}
            onSelect={onSelect} onHover={onHover}
            kind={materialKindById[pc.materialId] ?? 'PAL'}
            color={KIND_COLORS[materialKindById[pc.materialId] ?? 'PAL'] ?? '#c9a87c'}
          />
        ))}
      </group>
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
    </Canvas>
  );
}

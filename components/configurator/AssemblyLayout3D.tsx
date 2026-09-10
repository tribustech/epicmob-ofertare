'use client';

// Editor 3D de „Așezare" a corpurilor unui ansamblu: trage pe podea (X/Z) cu snapping la
// pereți/vecini, coliziune fără suprapunere (pe bandă verticală), rotire 90° (R), verticală (↑/↓),
// elemente fixe (grinzi/stâlpi/pereți/cutii), undo/redo și salvare în DB.
// Logica de snapping/coliziune vine din lib/quote/layout (pură, testată).
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Grid, Html, OrbitControls } from '@react-three/drei';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import * as THREE from 'three';
import { saveAssemblyLayout } from '@/lib/quote/actions';
import {
  clampBy, doorSlots, FIXED_KINDS, hasLegs, legDepthPositions, newFixed, overlaps, place, radToDeg, stackSuspended,
  roomWalls, snapGuides, wallOrient, layoutDeleteAction, moveWallTo, parseDimensionDraft, resizeWall, WALL_DIMENSION_STEP,
  type FixedItem, type FixedKind, type LayoutItem, type LayoutRoom, type SnapGuide, type WallSeg,
} from '@/lib/quote/layout';
import type { CabinetType } from '@/lib/engine';

const S = 1 / 1000; // mm → metri
const Q = Math.PI / 2;

type Box = LayoutItem | FixedItem;
const isFixed = (b: Box): b is FixedItem => 'kind' in b;

const COLORS: Record<CabinetType, string> = {
  BAZA: '#c9a87c', SUSPENDAT: '#d8cdb8', INALT: '#b8a888', COLT: '#cfd4d8', BLAT: '#b7c4cc',
};
const FIXED_LABEL: Record<FixedKind, string> = { GRINDA: 'Grindă', STALP: 'Stâlp', PERETE: 'Perete', CUTIE: 'Cutie', GEAM: 'Geam', MASINA_SPALAT: 'Mașină spălat' };

function Legs({ c }: { c: LayoutItem }) {
  const lx = (c.w / 2 - 30) * S, ly = (-c.h / 2 - c.legMm / 2) * S;
  const legZ = legDepthPositions(c.d, !!c.hasPlinth);
  return (
    <>
      {[[lx, legZ.front], [-lx, legZ.front], [lx, legZ.back], [-lx, legZ.back]].map(([x, zMm], i) => (
        <mesh key={i} position={[x, ly, zMm * S]} raycast={() => null}>
          <boxGeometry args={[0.03, c.legMm * S, 0.03]} />
          <meshStandardMaterial color="#4b4b4b" />
        </mesh>
      ))}
    </>
  );
}

function Plinth({ c }: { c: LayoutItem }) {
  if (!c.hasPlinth) return null;
  const heightMm = 100;
  const supportHeight = c.legMm > 0 ? c.legMm : heightMm;
  const y = (-c.h / 2 - supportHeight + heightMm / 2) * S;
  const z = (c.d / 2 - 35) * S;
  return (
    <mesh position={[0, y, z]} raycast={() => null}>
      <boxGeometry args={[c.w * S, heightMm * S, 0.018]} />
      <meshStandardMaterial color={COLORS[c.type] ?? '#c9a87c'} />
      <Edges color="#8a6d45" lineWidth={1} />
    </mesh>
  );
}

// fronturile reale: uși (panouri verticale) sau sertare (benzi orizontale), fiecare cu mâner.
function FrontFace({ c }: { c: LayoutItem }) {
  if (!c.front) return null;
  const z = c.d * S / 2 + 0.005, zH = c.d * S / 2 + 0.009;
  const W = c.w, H = c.h, GAP = 8;
  const panel = (key: string, cx: number, cy: number, pw: number, ph: number, glass = false) => {
    const width = Math.max(20, pw), height = Math.max(20, ph);
    const frame = Math.max(8, Math.min(30, width / 4, height / 4));
    return (
      <group key={key} position={[cx * S, cy * S, z]}>
        <mesh raycast={() => null}>
          <planeGeometry args={[width * S, height * S]} />
          <meshStandardMaterial
            color={glass ? '#b9e5f2' : '#6f5330'} transparent opacity={glass ? 0.24 : 0.92}
            depthWrite={!glass} side={THREE.DoubleSide}
          />
        </mesh>
        {glass && (
          <group position={[0, 0, 0.003]}>
            {[-1, 1].map((side) => (
              <mesh key={`h${side}`} position={[0, side * (height - frame) * S / 2, 0]} raycast={() => null}>
                <boxGeometry args={[width * S, frame * S, 0.014]} />
                <meshStandardMaterial color="#616a70" metalness={0.35} roughness={0.35} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <mesh key={`v${side}`} position={[side * (width - frame) * S / 2, 0, 0]} raycast={() => null}>
                <boxGeometry args={[frame * S, height * S, 0.014]} />
                <meshStandardMaterial color="#616a70" metalness={0.35} roughness={0.35} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    );
  };
  const bar = (key: string, cx: number, cy: number, w: number, h: number) => (
    <mesh key={key} position={[cx * S, cy * S, zH]} raycast={() => null}>
      <boxGeometry args={[w * S, h * S, 0.014]} />
      <meshStandardMaterial color="#e6ddc9" />
    </mesh>
  );
  const parts: React.ReactNode[] = [];
  if (c.front.kind === 'drawers') {
    const n = c.front.count;
    const hs = c.front.heights && c.front.heights.length === n ? c.front.heights : Array(n).fill(H / n);
    const tot = hs.reduce((a, b) => a + b, 0) || H;
    let yTop = H / 2;
    hs.forEach((hh, i) => {
      const ph = (hh / tot) * H, cy = yTop - ph / 2; yTop -= ph;
      parts.push(panel(`d${i}`, 0, cy, W - 2 * GAP, ph - GAP, c.front?.glass));
      parts.push(bar(`dh${i}`, 0, cy + ph / 2 - 55, Math.min(W * 0.5, 300), 14));
    });
  } else {
    const { fals, doors } = doorSlots(W, c.front.count, c.front.falsLeftMm ?? 0, c.front.falsRightMm ?? 0);
    // panouri false: fixe, ca un front, dar fără mâner
    fals.forEach((f, i) => parts.push(panel(`f${i}`, f.cx, 0, f.w - 2 * GAP, H - 2 * GAP)));
    doors.forEach((d, i) => {
      parts.push(panel(`o${i}`, d.cx, 0, d.w - 2 * GAP, H - 2 * GAP, c.front?.glass));
      const hx = d.cx + (d.cx <= 0 ? d.w / 2 - 40 : -(d.w / 2 - 40));
      parts.push(bar(`oh${i}`, hx, 0, 14, Math.min(H * 0.4, 300)));
    });
  }
  return <group>{parts}</group>;
}

// corp fără fronturi: polițe + panou de spate mai închis, ca să se distingă fața de spate.
function OpenBody({ c }: { c: LayoutItem }) {
  const W = c.w, H = c.h, D = c.d;
  const parts: React.ReactNode[] = [
    <mesh key="back" position={[0, 0, -D * S / 2 + 0.004]} raycast={() => null}>
      <planeGeometry args={[Math.max(20, W - 20) * S, Math.max(20, H - 20) * S]} />
      <meshStandardMaterial color="#7a6038" side={THREE.DoubleSide} />
    </mesh>,
  ];
  for (let i = 1; i <= c.shelves; i++) {
    const y = -H / 2 + (i * H) / (c.shelves + 1);
    parts.push(
      <mesh key={`s${i}`} position={[0, y * S, 0]} raycast={() => null}>
        <boxGeometry args={[Math.max(20, W - 24) * S, 18 * S, Math.max(20, D - 24) * S]} />
        <meshStandardMaterial
          color={c.glassShelves ? '#c9edf5' : '#bda06f'} transparent={c.glassShelves}
          opacity={c.glassShelves ? 0.24 : 1} depthWrite={!c.glassShelves}
        />
        {c.glassShelves && <Edges color="#71858d" lineWidth={1} />}
      </mesh>,
    );
  }
  return <group>{parts}</group>;
}

// corp „sub blat" (fără capac): două bare de pazie sus (față + spate), gol între ele.
function Pazii({ c }: { c: LayoutItem }) {
  if (!c.topOpen || !c.pazieWidthMm) return null;
  const pw = c.pazieWidthMm;
  const yTop = (c.h / 2 - 9) * S;
  const bar = (key: string, z: number) => (
    <mesh key={key} position={[0, yTop, z]} raycast={() => null}>
      <boxGeometry args={[Math.max(20, c.w - 24) * S, 18 * S, pw * S]} />
      <meshStandardMaterial color="#bda06f" />
    </mesh>
  );
  return <group>{bar('front', (c.d / 2 - pw / 2) * S)}{bar('back', (-c.d / 2 + pw / 2) * S)}</group>;
}

function CabMesh({ c, hovered, active, interactive, onDown, onHover }: {
  c: LayoutItem; hovered: boolean; active: boolean; interactive: boolean;
  onDown: (e: ThreeEvent<PointerEvent>, b: Box) => void; onHover: (id: string | null) => void;
}) {
  const bodyBottom = c.by + c.legMm;
  const dim = interactive ? 1 : 0.4; // estompare când nu e interactiv (mod editare cameră)
  return (
    <group position={[c.cx * S, (bodyBottom + c.h / 2) * S, c.cz * S]} rotation={[0, c.rot, 0]}>
      {hasLegs(c) && <Legs c={c} />}
      <Plinth c={c} />
      <mesh
        onPointerDown={interactive ? (e) => onDown(e, c) : undefined}
        onPointerOver={interactive ? (e) => { e.stopPropagation(); onHover(c.id); document.body.style.cursor = 'grab'; } : undefined}
        onPointerOut={interactive ? () => { onHover(null); document.body.style.cursor = ''; } : undefined}
      >
        <boxGeometry args={[c.w * S, c.h * S, c.d * S]} />
        <meshStandardMaterial color={active ? '#5b8def' : hovered ? '#93b3f0' : COLORS[c.type] ?? '#c9a87c'} transparent opacity={(c.type === 'BLAT' ? 0.95 : c.topOpen ? 0.32 : c.front ? 0.94 : 0.55) * dim} depthWrite={!c.topOpen} />
        <Edges color={active || hovered ? '#2b5fd9' : '#8a6d45'} lineWidth={active ? 2.5 : 1} />
      </mesh>
      {/* blatul e o placă simplă — fără fronturi, fără polițe/spate */}
      {c.type === 'BLAT' ? null : c.front ? <FrontFace c={c} /> : <OpenBody c={c} />}
      {/* corp fără capac: barele de pazie în locul capacului */}
      <Pazii c={c} />
      {(hovered || active) && (
        <Html center distanceFactor={2.6} position={[0, c.h * S / 2 + 0.05, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-foreground/90 px-2 py-0.5 font-mono text-[11px] text-background shadow">
            {c.label} · {c.w}×{c.h}×{c.d} · {radToDeg(c.rot)}° · jos {Math.round(c.by)} → sus {Math.round(c.by + c.legMm + c.h)}mm
          </div>
        </Html>
      )}
    </group>
  );
}

// element fix (construcție, nu mobilă) — cutie gri, distinctă vizual
function FixedMesh({ f, hovered, active, interactive, onDown, onHover }: {
  f: FixedItem; hovered: boolean; active: boolean; interactive: boolean;
  onDown: (e: ThreeEvent<PointerEvent>, b: Box) => void; onHover: (id: string | null) => void;
}) {
  const glass = f.kind === 'GEAM';
  const appliance = f.kind === 'MASINA_SPALAT';
  const color = active ? '#5b8def'
    : hovered ? (glass ? '#bfe3f2' : appliance ? '#eef1f4' : '#8fa6bd')
    : (glass ? '#bcdcee' : appliance ? '#e2e6ea' : '#9aa7b0');
  const opacity = (glass ? 0.32 : appliance ? 0.92 : 0.6) * (interactive ? 1 : 0.5);
  return (
    <group position={[f.cx * S, (f.by + f.h / 2) * S, f.cz * S]} rotation={[0, f.rot, 0]}>
      <mesh
        onPointerDown={interactive ? (e) => onDown(e, f) : undefined}
        onPointerOver={interactive ? (e) => { e.stopPropagation(); onHover(f.id); document.body.style.cursor = 'grab'; } : undefined}
        onPointerOut={interactive ? () => { onHover(null); document.body.style.cursor = ''; } : undefined}
      >
        <boxGeometry args={[f.w * S, f.h * S, f.d * S]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
        <Edges color={active ? '#2b5fd9' : glass ? '#6aa6c8' : '#5c6670'} lineWidth={active ? 2.5 : 1.2} />
      </mesh>
      {(hovered || active) && (
        <Html center distanceFactor={2.6} position={[0, f.h * S / 2 + 0.05, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-slate-700/90 px-2 py-0.5 font-mono text-[11px] text-white shadow">
            {FIXED_LABEL[f.kind]} · {f.w}×{f.h}×{f.d}
          </div>
        </Html>
      )}
    </group>
  );
}

// un perete-segment independent: inert în modul normal, selectabil + click-dreapta în editare
function Wall({ w, editRoom, selected, hovered, onDown, onSelect, onHover, onContext }: {
  w: WallSeg; editRoom: boolean; selected: boolean; hovered: boolean;
  onDown: (e: ThreeEvent<PointerEvent>, wall: WallSeg) => void;
  onSelect: (id: string) => void; onHover: (id: string | null) => void;
  onContext: (id: string, clientX: number, clientY: number) => void;
}) {
  const len = Math.max(1, w.hi - w.lo), mid = (w.lo + w.hi) / 2;
  const position: [number, number, number] = w.axis === 'x'
    ? [w.at * S, w.h / 2 * S, mid * S]
    : [mid * S, w.h / 2 * S, w.at * S];
  const color = selected ? '#93b3f0' : hovered ? '#cdd7e6' : '#e7e3db';
  return (
    <mesh position={position} rotation={[0, w.axis === 'x' ? Q : 0, 0]}
      onPointerDown={editRoom ? (e) => { e.stopPropagation(); onDown(e, w); } : undefined}
      onContextMenu={editRoom ? (e) => { e.stopPropagation(); e.nativeEvent.preventDefault(); onSelect(w.id); onContext(w.id, e.nativeEvent.clientX, e.nativeEvent.clientY); } : undefined}
      onPointerOver={editRoom ? (e) => { e.stopPropagation(); onHover(w.id); document.body.style.cursor = 'pointer'; } : undefined}
      onPointerOut={editRoom ? () => { onHover(null); document.body.style.cursor = ''; } : undefined}
    >
      <planeGeometry args={[len * S, w.h * S]} />
      {/* depthWrite=false + polygonOffset: peretele nu se mai „bate" (z-fighting) cu spatele corpurilor lipite de el */}
      <meshStandardMaterial color={color} transparent opacity={selected ? 0.5 : 0.22} side={THREE.DoubleSide}
        depthWrite={false} polygonOffset polygonOffsetFactor={2} polygonOffsetUnits={2} />
      <Edges color={selected ? '#2b5fd9' : '#b7b1a6'} lineWidth={selected ? 2 : 1} />
    </mesh>
  );
}

function Walls({ walls, editRoom, selectedWall, onWallDown, onSelectWall, onContext }: {
  walls: WallSeg[]; editRoom: boolean; selectedWall: string | null;
  onWallDown: (e: ThreeEvent<PointerEvent>, wall: WallSeg) => void;
  onSelectWall: (id: string) => void; onContext: (id: string, x: number, y: number) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <>
      {walls.map((w) => (
        <Wall key={w.id} w={w} editRoom={editRoom} selected={w.id === selectedWall}
          hovered={w.id === hover} onDown={onWallDown} onSelect={onSelectWall} onHover={setHover} onContext={onContext} />
      ))}
    </>
  );
}

function Editor({ items, fixed, room, selectedId, onSelect, onSnapshot, onDrag, onWallDrag, editRoom, selectedWall, onSelectWall, onWallContext }: {
  items: LayoutItem[]; fixed: FixedItem[]; room: LayoutRoom;
  selectedId: string | null; onSelect: (id: string | null) => void; onSnapshot: () => void;
  onDrag: (id: string, cx: number, cz: number, rot: number, by: number) => void;
  onWallDrag: (id: string, cx: number, cz: number) => void;
  editRoom: boolean; selectedWall: string | null; onSelectWall: (id: string) => void;
  onWallContext: (id: string, x: number, y: number) => void;
}) {
  const { camera, gl, controls } = useThree();
  const dragRef = useRef<{ kind: 'box' | 'wall'; id: string; offX: number; offZ: number; moved: boolean } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [guides, setGuides] = useState<SnapGuide[]>([]); // linii de aliniere active în timpul tragerii

  // ref mereu la ultima listă combinată — folosită în handlerul de drag (evită closure învechit)
  const boxesRef = useRef<Box[]>([]);
  boxesRef.current = [...items, ...fixed];

  const walls = roomWalls(room);
  const cx0 = room.W / 2, cz0 = room.D / 2;

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const floorPoint = useCallback((clientX: number, clientY: number) => {
    const r = gl.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(plane, hit);
    return { x: hit.x / S + cx0, z: hit.z / S + cz0 };
  }, [camera, gl, ndc, plane, raycaster, hit, cx0, cz0]);

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    if (!d.moved) { d.moved = true; onSnapshot(); }
    const { x, z } = floorPoint(e.clientX, e.clientY);
    const rawCx = x - d.offX, rawCz = z - d.offZ;
    // dacă raza nu a intersectat podeaua sau canvas-ul a raportat 0×0 (reflow) → coordonate non-finite;
    // ignoră cadrul ca să nu propagăm NaN în poziția corpului (ar arunca computeBoundingSphere)
    if (!Number.isFinite(rawCx) || !Number.isFinite(rawCz)) return;
    if (d.kind === 'wall') {
      onWallDrag(d.id, rawCx, rawCz);
      return;
    }
    const me = boxesRef.current.find((b) => b.id === d.id); if (!me) return;
    // corpurile se auto-orientează spate-la-perete; elementele fixe își păstrează rotația
    const rot = isFixed(me) ? me.rot : wallOrient(rawCx, rawCz, room, me.rot);
    // snapping vede toate elementele; coliziunea filtrează intern pe bandă
    const others = boxesRef.current.filter((b) => b.id !== d.id);
    const stack = isFixed(me) ? null : stackSuspended(
      { ...me, rot }, rawCx, rawCz, others.filter((b): b is LayoutItem => !isFixed(b)), room,
    );
    const desired = stack ?? { cx: rawCx, cz: rawCz, by: me.by, rot };
    const moving = { ...me, by: desired.by, rot: desired.rot };
    const s = place(moving, desired.cx, desired.cz, others, room, true, false);
    onDrag(d.id, s.cx, s.cz, desired.rot, desired.by);
    setGuides(snapGuides(moving, s.cx, s.cz, others, room));
  }, [floorPoint, room, onSnapshot, onDrag, onWallDrag]);

  const onUp = useCallback(() => {
    dragRef.current = null;
    setGuides([]);
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [controls, onMove]);

  const onDown = useCallback((e: ThreeEvent<PointerEvent>, b: Box) => {
    e.stopPropagation();
    onSelect(b.id);
    const { x, z } = floorPoint(e.clientX, e.clientY);
    dragRef.current = { kind: 'box', id: b.id, offX: x - b.cx, offZ: z - b.cz, moved: false };
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [controls, floorPoint, onMove, onUp, onSelect]);

  const onWallDown = useCallback((e: ThreeEvent<PointerEvent>, wall: WallSeg) => {
    e.stopPropagation();
    onSelectWall(wall.id);
    const { x, z } = floorPoint(e.clientX, e.clientY);
    const mid = (wall.lo + wall.hi) / 2;
    const cx = wall.axis === 'x' ? wall.at : mid;
    const cz = wall.axis === 'x' ? mid : wall.at;
    dragRef.current = { kind: 'wall', id: wall.id, offX: x - cx, offZ: z - cz, moved: false };
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [controls, floorPoint, onMove, onUp, onSelectWall]);

  return (
    <group position={[-cx0 * S, 0, -cz0 * S]}>
      <Walls walls={walls} editRoom={editRoom} selectedWall={selectedWall}
        onWallDown={onWallDown} onSelectWall={onSelectWall} onContext={onWallContext} />
      {items.map((c) => (
        <CabMesh key={c.id} c={c} hovered={c.id === hoverId && c.id !== selectedId} active={c.id === selectedId}
          interactive={!editRoom} onDown={onDown} onHover={setHoverId} />
      ))}
      {fixed.map((f) => (
        <FixedMesh key={f.id} f={f} hovered={f.id === hoverId && f.id !== selectedId} active={f.id === selectedId}
          interactive={editRoom} onDown={onDown} onHover={setHoverId} />
      ))}
      {/* zonele de intersecție dintre corpuri — roșu, mereu vizibile (semnalează o problemă) */}
      {overlaps([...items, ...fixed]).map((o, i) => (
        <mesh key={i} position={[o.cx * S, (o.by + o.h / 2) * S, o.cz * S]} raycast={() => null}>
          <boxGeometry args={[o.w * S, o.h * S, o.d * S]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.55} depthTest={false} />
        </mesh>
      ))}
      {/* ghidaje de aliniere (stil Figma) — roz, mereu vizibile: pe podea (aceeași bandă) sau verticale (între benzi) */}
      {guides.map((g, i) => {
        if (g.axis === 'v') { // linie verticală: arată că suspendatul e pe aceeași linie cu un corp de jos
          const vh = Math.max(0.001, (g.y1 - g.y0) * S);
          return (
            <mesh key={`g${i}`} raycast={() => null} renderOrder={999} position={[g.x * S, (g.y0 + g.y1) / 2 * S, g.z * S]}>
              <boxGeometry args={[0.012, vh, 0.012]} />
              <meshBasicMaterial color="#ff2d78" transparent opacity={0.9} depthTest={false} />
            </mesh>
          );
        }
        const len = Math.max(0.001, (g.to - g.from) * S), mid = (g.from + g.to) / 2;
        return (
          <mesh key={`g${i}`} raycast={() => null} renderOrder={999}
            position={g.axis === 'x' ? [g.at * S, 0.02, mid * S] : [mid * S, 0.02, g.at * S]}>
            <boxGeometry args={g.axis === 'x' ? [0.01, 0.004, len] : [len, 0.004, 0.01]} />
            <meshBasicMaterial color="#ff2d78" transparent opacity={0.95} depthTest={false} />
          </mesh>
        );
      })}
    </group>
  );
}

type Snap = { items: LayoutItem[]; fixed: FixedItem[]; walls: WallSeg[] };

// separator vertical în bara de acțiuni
const Sep = () => <div className="w-px shrink-0 self-stretch bg-neutral-200" />;
// câmp numeric compact pentru bară (etichetă mică deasupra)
function BarField({ label, value, step = 100, onChange }: {
  label: string; value: number; step?: number; onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  const commit = () => {
    const parsed = parseDimensionDraft(draft);
    if (parsed === null) setDraft(String(value));
    else onChange(String(parsed));
  };
  return (
    <label className="flex shrink-0 flex-col text-[10px] leading-tight text-neutral-500">{label}
      <input type="text" inputMode="numeric" data-step={step} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') { setDraft(String(value)); e.currentTarget.blur(); }
        }}
        className="w-16 rounded border px-1 py-1 text-sm text-neutral-800" />
    </label>
  );
}

export default function AssemblyLayout3D({
  assemblyId, assemblyName, backHref, initialItems, initialRoom, initialFixed,
}: {
  assemblyId: string; assemblyName: string; quoteId: string; backHref: string;
  initialItems: LayoutItem[]; initialRoom: LayoutRoom; initialFixed: FixedItem[];
}) {
  const [items, setItems] = useState<LayoutItem[]>(initialItems);
  const [fixed, setFixed] = useState<FixedItem[]>(initialFixed);
  // pereții sunt materializați concret (chiar și cei impliciți) ca să poată fi editați/șterși
  const [room, setRoom] = useState<LayoutRoom>(() => ({ ...initialRoom, walls: roomWalls(initialRoom) }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState(false);
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [moveStep, setMoveStep] = useState<10 | 100>(10); // pasul joystick-ului (mm)
  const [heldDir, setHeldDir] = useState<string | null>(null); // direcția evidențiată (mouse sau tastă)
  const [past, setPast] = useState<Snap[]>([]);
  const [future, setFuture] = useState<Snap[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSave] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const walls = room.walls ?? [];
  const camDist = Math.max(room.W, room.D) * S;
  const selectedWallSeg = walls.find((w) => w.id === selectedWall) ?? null;
  const touch = () => { setDirty(true); setSaved(false); };
  const allBoxes = useMemo<Box[]>(() => [...items, ...fixed], [items, fixed]);
  const findBox = (id: string | null): Box | undefined => allBoxes.find((b) => b.id === id);
  const selectedFixed = fixed.find((f) => f.id === selectedId) ?? null;
  const selectedBox = findBox(selectedId) ?? null;

  const snap = () => ({ items, fixed, walls });
  const restore = (s: Snap) => { setItems(s.items); setFixed(s.fixed); setRoom((r) => ({ ...r, walls: s.walls })); touch(); };
  const snapshot = useCallback(() => { setPast((p) => [...p.slice(-49), snap()]); setFuture([]); touch(); }, [items, fixed, walls]); // eslint-disable-line react-hooks/exhaustive-deps
  const undo = useCallback(() => {
    setPast((p) => { if (!p.length) return p; setFuture((f) => [snap(), ...f]); restore(p[p.length - 1]); return p.slice(0, -1); });
  }, [items, fixed, walls]); // eslint-disable-line react-hooks/exhaustive-deps
  const redo = useCallback(() => {
    setFuture((f) => { if (!f.length) return f; setPast((p) => [...p, snap()]); restore(f[0]); return f.slice(1); });
  }, [items, fixed]);

  // actualizează poziția/rotația oricărei cutii (corp sau element fix) — no-op pe lista greșită
  const updateBox = useCallback((id: string, patch: Partial<Box>) => {
    setItems((prev) => prev.some((i) => i.id === id) ? prev.map((i) => (i.id === id ? { ...i, ...patch } : i)) : prev);
    setFixed((prev) => prev.some((i) => i.id === id) ? prev.map((i) => (i.id === id ? { ...i, ...patch } as FixedItem : i)) : prev);
  }, []);

  const onDrag = useCallback((id: string, cx: number, cz: number, rot: number, by: number) => {
    updateBox(id, { cx, cz, rot, by });
  }, [updateBox]);

  const rotate = useCallback(() => {
    const me = findBox(selectedId); if (!me) return;
    snapshot();
    const rotated = { ...me, rot: me.rot + Q };
    const others = allBoxes.filter((b) => b.id !== me.id);
    const s = place(rotated, rotated.cx, rotated.cz, others, room, true, false);
    updateBox(me.id, { rot: rotated.rot, cx: s.cx, cz: s.cz });
  }, [selectedId, room, snapshot, updateBox, allBoxes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ref la starea curentă — folosit de ținerea apăsată a joystick-ului (ca să acumuleze corect)
  const liveRef = useRef({ items, fixed, room, selectedId, moveStep });
  liveRef.current = { items, fixed, room, selectedId, moveStep };

  // joystick pe planul peretelui: stânga/dreapta = X (pe podea, cu coliziune), sus/jos = înălțime (Y).
  // Fără Z — adâncimea se face din drag. Nu face snapshot (îl face apelantul).
  const doMove = useCallback((dir: string, step: number) => {
    const { items: it, fixed: fx, room: rm, selectedId: sel } = liveRef.current;
    const all = [...it, ...fx];
    const me = all.find((b) => b.id === sel); if (!me) return;
    if (dir === 'left' || dir === 'right') {
      const others = all.filter((b) => b.id !== me.id);
      const s = place(me, me.cx + (dir === 'right' ? step : -step), me.cz, others, rm, false, false);
      updateBox(me.id, { cx: s.cx, cz: s.cz });
    } else {
      updateBox(me.id, { by: clampBy(me, me.by + (dir === 'up' ? step : -step), rm) });
    }
    touch();
  }, [updateBox]); // eslint-disable-line react-hooks/exhaustive-deps

  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHold = (dir: string) => {
    if (!liveRef.current.selectedId) return;
    snapshot(); setHeldDir(dir);
    const tick = () => doMove(dir, liveRef.current.moveStep);
    tick();
    holdRef.current = setInterval(tick, 90);
  };
  const stopHold = () => { if (holdRef.current) clearInterval(holdRef.current); holdRef.current = null; setHeldDir(null); };
  useEffect(() => () => { if (holdRef.current) clearInterval(holdRef.current); }, []);

  // selecție exclusivă: un perete SAU un corp/element, nu ambele
  const selectBox = (id: string | null) => { setSelectedId(id); setSelectedWall(null); setMenu(null); };
  const selectWall = (id: string) => { setSelectedWall(id); setSelectedId(null); };

  const addFixed = (kind: FixedKind) => {
    snapshot();
    let el = newFixed(kind, room, crypto.randomUUID());
    // geamul se încastrează în peretele selectat (centrat pe planul lui, la parapet)
    if (kind === 'GEAM' && selectedWallSeg) {
      const w = selectedWallSeg, mid = (w.lo + w.hi) / 2;
      el = w.axis === 'z' ? { ...el, cx: mid, cz: w.at, rot: 0 } : { ...el, cx: w.at, cz: mid, rot: Q };
    }
    setFixed((prev) => [...prev, el]);
    selectBox(el.id);
  };
  const deleteFixed = useCallback(() => {
    if (!selectedId || !fixed.some((f) => f.id === selectedId)) return;
    snapshot();
    setFixed((prev) => prev.filter((f) => f.id !== selectedId));
    setSelectedId(null);
  }, [selectedId, fixed, snapshot]);
  const changeFixedDim = (dim: 'w' | 'h' | 'd', v: string) => {
    if (!selectedId) return;
    updateBox(selectedId, { [dim]: num(v, 40, 6000) });
    touch();
  };
  // cotă de jos liberă (mm) pentru elementul/corpul selectat — control fin, nu doar pasul de 50
  const changeBy = (v: string) => {
    const me = findBox(selectedId); if (!me) return;
    updateBox(me.id, { by: clampBy(me, num(v, 0, 10000), room) });
    touch();
  };

  // modul „Editează camera": pereții devin selectabili, mobila inertă
  const toggleEdit = () => { setEditRoom((e) => !e); setSelectedId(null); setSelectedWall(null); setMenu(null); };

  const updateWall = (id: string, patch: Partial<WallSeg>) =>
    setRoom((r) => ({ ...r, walls: (r.walls ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) }));
  const moveWall = useCallback((id: string, cx: number, cz: number) => {
    setRoom((r) => ({
      ...r,
      walls: (r.walls ?? []).map((w) => (w.id === id ? moveWallTo(w, cx, cz) : w)),
    }));
    touch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // fiecare perete e independent: lungimea = întinderea lui (hi−lo), înălțimea = h; nu afectează alt perete
  const changeWallDim = (which: 'len' | 'h', v: string) => {
    if (!selectedWallSeg) return;
    const value = Number(v);
    if (!Number.isFinite(value)) return;
    updateWall(selectedWallSeg.id, resizeWall(selectedWallSeg, which, value));
    touch();
  };
  const deleteWall = (id: string) => { snapshot(); setRoom((r) => ({ ...r, walls: (r.walls ?? []).filter((w) => w.id !== id) })); setSelectedWall(null); setMenu(null); };
  const addWall = () => {
    snapshot();
    const w: WallSeg = { id: crypto.randomUUID(), axis: 'x', at: room.W / 2, lo: 0, hi: room.D, h: room.H };
    setRoom((r) => ({ ...r, walls: [...(r.walls ?? []), w] }));
    selectWall(w.id);
  };
  const wallLen = selectedWallSeg ? selectedWallSeg.hi - selectedWallSeg.lo : 0;

  const save = () => {
    setError(null);
    startSave(async () => {
      const res = await saveAssemblyLayout(assemblyId, {
        room: { W: room.W, D: room.D, H: room.H },
        items: items.map((i) => ({ id: i.id, cx: i.cx, cz: i.cz, by: i.by, rotDeg: radToDeg(i.rot) })),
        fixed: fixed.map((f) => ({ id: f.id, kind: f.kind, w: f.w, h: f.h, d: f.d, cx: f.cx, cz: f.cz, by: f.by, rot: f.rot })),
        walls: walls.map((w) => ({ id: w.id, axis: w.axis, at: w.at, lo: w.lo, hi: w.hi, h: w.h })),
      });
      if ('error' in res) setError(res.error);
      else { setDirty(false); setSaved(true); }
    });
  };

  const KEY_DIR: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      const isEditing = target instanceof HTMLElement && (
        target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      );
      const deleteAction = layoutDeleteAction({
        key: e.key,
        selectedWallId: selectedWall,
        hasSelectedFixed: selectedFixed !== null,
        isEditing,
      });
      if (deleteAction) {
        e.preventDefault();
        if (deleteAction.kind === 'wall') deleteWall(deleteAction.id);
        else deleteFixed();
        return;
      }
      if (isEditing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.key === 'r' || e.key === 'R') rotate();
      // săgețile mută corpul pe podea; Shift = 100mm; o rafală ținută = un singur pas de undo
      const dname = KEY_DIR[e.key];
      if (dname && selectedId) {
        e.preventDefault();
        if (!e.repeat) snapshot();
        setHeldDir(dname);
        doMove(dname, e.shiftKey ? 100 : moveStep);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (KEY_DIR[e.key]) setHeldDir(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 bg-neutral-100">
      {/* titlu discret sus-stânga */}
      <div className="absolute left-4 top-4 z-10 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold shadow">
        Așezare 3D · {assemblyName}
        {dirty && !pending && <span className="ml-2 text-xs font-normal text-amber-600">• nesalvat</span>}
      </div>
      {error && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded bg-red-600 px-3 py-1.5 text-sm text-white shadow">{error}</div>
      )}

      {/* bară de acțiuni floating, jos */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-full items-stretch gap-2 overflow-x-auto rounded-2xl border bg-white/95 p-2 shadow-xl">
          <button onClick={toggleEdit}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${editRoom ? 'bg-slate-700 text-white' : 'border text-slate-700 hover:bg-neutral-50'}`}>
            {editRoom ? '✓ Gata cameră' : '✎ Editează cameră'}
          </button>

          {editRoom && (
            <>
              <Sep />
              <div className="flex shrink-0 items-center gap-1">
                <span className="px-1 text-[10px] leading-tight text-neutral-400">Adaugă<br />în cameră</span>
                {FIXED_KINDS.map(({ kind, label }) => (
                  <button key={kind} onClick={() => addFixed(kind)}
                    className="rounded-lg border px-2 py-2 text-xs hover:bg-neutral-50">{label}</button>
                ))}
                <button onClick={addWall} className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs hover:bg-slate-100" title="Adaugă un perete de cameră">Perete cameră</button>
              </div>

              {selectedWallSeg && (
                <>
                  <Sep />
                  <div className="flex shrink-0 items-end gap-1">
                    <span className="self-center px-1 text-xs font-medium text-slate-600">
                      Perete {selectedWall === 'back' ? 'spate' : selectedWall === 'left' ? 'stânga' : selectedWall === 'right' ? 'dreapta' : ''}
                    </span>
                    <BarField label="lungime" step={WALL_DIMENSION_STEP} value={wallLen} onChange={(v) => changeWallDim('len', v)} />
                    <BarField label="înălțime" step={WALL_DIMENSION_STEP} value={selectedWallSeg.h} onChange={(v) => changeWallDim('h', v)} />
                    <button onClick={() => deleteWall(selectedWallSeg.id)} className="rounded-lg bg-red-50 px-2 py-2 text-xs text-red-600 hover:bg-red-100">Șterge</button>
                  </div>
                </>
              )}

              {selectedFixed && (
                <>
                  <Sep />
                  <div className="flex shrink-0 items-end gap-1">
                    <span className="self-center px-1 text-xs font-medium text-slate-600">{FIXED_LABEL[selectedFixed.kind]}</span>
                    <BarField label="lățime" step={50} value={selectedFixed.w} onChange={(v) => changeFixedDim('w', v)} />
                    <BarField label="înălț." step={50} value={selectedFixed.h} onChange={(v) => changeFixedDim('h', v)} />
                    <BarField label="adânc." step={50} value={selectedFixed.d} onChange={(v) => changeFixedDim('d', v)} />
                    <button onClick={deleteFixed} className="rounded-lg bg-red-50 px-2 py-2 text-xs text-red-600 hover:bg-red-100">Șterge</button>
                  </div>
                </>
              )}
            </>
          )}

          {selectedBox && (
            <>
              <Sep />
              <div className="flex shrink-0 items-end gap-1">
                <BarField label="cotă jos (mm)" step={10} value={Math.round(selectedBox.by)} onChange={changeBy} />
                <button onClick={rotate} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white" title="R">Rotește</button>
              </div>
            </>
          )}

          <Sep />
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={undo} disabled={!past.length} title="Undo (Ctrl+Z)" className="rounded-lg border px-2.5 py-2 disabled:opacity-40">↶</button>
            <button onClick={redo} disabled={!future.length} title="Redo (Ctrl+Shift+Z)" className="rounded-lg border px-2.5 py-2 disabled:opacity-40">↷</button>
          </div>

          <Sep />
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={save} disabled={pending || !dirty}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {pending ? 'Se salvează…' : saved ? '✓ Salvat' : 'Salvează'}
            </button>
            <Link href={backHref} className="rounded-lg border px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">Înapoi</Link>
          </div>
        </div>
      </div>

      {/* joystick de poziționare — apăsat cu mouse-ul (ținut = repetă) sau evidențiat din săgeți */}
      {selectedBox && (
        <div className="absolute bottom-28 right-4 z-10 select-none rounded-2xl border bg-white/95 p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-center gap-1 text-xs">
            <span className="text-neutral-500">Pas</span>
            {([10, 100] as const).map((st) => (
              <button key={st} onClick={() => setMoveStep(st)}
                className={`rounded px-2 py-0.5 ${moveStep === st ? 'bg-blue-600 text-white' : 'border hover:bg-neutral-50'}`}>{st}mm</button>
            ))}
          </div>
          {/* pad pe planul peretelui: ↑↓ = înălțime, ←→ = orizontal */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1">
            {([['', '', ''], ['up', '↑', 'Ridică'], ['', '', ''], ['left', '←', 'Stânga'], ['·', '', ''], ['right', '→', 'Dreapta'], ['', '', ''], ['down', '↓', 'Coboară'], ['', '', '']] as const).map(([dir, label, title], i) =>
              dir && dir !== '·' ? (
                <button key={i} title={title}
                  onPointerDown={(e) => { e.preventDefault(); startHold(dir); }}
                  onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
                  className={`h-11 w-11 rounded-lg text-lg font-bold ${heldDir === dir ? 'bg-blue-600 text-white' : 'border bg-white text-slate-700 hover:bg-neutral-50'}`}>{label}</button>
              ) : <div key={i} className={dir === '·' ? 'flex items-center justify-center text-[9px] text-neutral-300' : ''}>{dir === '·' ? 'mută' : null}</div>,
            )}
          </div>
        </div>
      )}

      {mounted ? (
        <Canvas camera={{ position: [camDist * 0.9, camDist * 0.9, camDist * 1.4], fov: 42 }}
          onPointerMissed={() => { setSelectedId(null); setSelectedWall(null); setMenu(null); }}>
          <ambientLight intensity={0.85} />
          <directionalLight position={[3, 6, 4]} intensity={1.1} />
          <Grid args={[16, 16]} cellSize={0.5} cellColor="#c9c4bb" sectionSize={1} sectionColor="#a8a29a"
            infiniteGrid fadeDistance={20} />
          <Editor items={items} fixed={fixed} room={room} selectedId={selectedId}
            onSelect={selectBox} onSnapshot={snapshot} onDrag={onDrag} onWallDrag={moveWall}
            editRoom={editRoom} selectedWall={selectedWall} onSelectWall={selectWall}
            onWallContext={(id, x, y) => setMenu({ id, x, y })} />
          <OrbitControls makeDefault enableDamping zoomToCursor target={[0, 0.7, 0]} />
        </Canvas>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-neutral-400">Se încarcă scena 3D…</div>
      )}
      {menu && (
        <div className="fixed z-20 min-w-32 overflow-hidden rounded-md border bg-white text-sm shadow-lg"
          style={{ left: menu.x, top: menu.y }}>
          <button onClick={() => deleteWall(menu.id)} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50">Șterge peretele</button>
          <button onClick={() => setMenu(null)} className="block w-full px-3 py-1.5 text-left hover:bg-neutral-50">Anulează</button>
        </div>
      )}
    </div>
  );
}

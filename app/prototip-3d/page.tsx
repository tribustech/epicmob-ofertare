'use client';

// PROTOTIP throwaway — planificator de cameră: setezi pereții (lățime/adâncime/înălțime),
// corpurile se lipesc de pereți/vecini, nu trec prin pereți, se rotesc 90° (click + R),
// se mută pe verticală (săgeți Sus/Jos), au picioare vizibile și undo/redo.
// Nu atinge DB-ul: totul trăiește în state.
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Grid, Html, OrbitControls } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const S = 1 / 1000; // mm → metri
const SNAP_WALL = 200; // prag snap la perete (mm)
const SNAP_NEIGH = 240; // prag snap la vecin (mm)
const LEG = 100; // înălțimea picioarelor
const V_STEP = 50; // pas mișcare verticală (mm)
const Q = Math.PI / 2;

type CabType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT';
type Cab = { id: string; label: string; type: CabType; w: number; h: number; d: number; cx: number; cz: number; by: number; rot: number };
type Room = { W: number; D: number; H: number };

const COLORS: Record<CabType, string> = {
  BAZA: '#c9a87c', SUSPENDAT: '#d8cdb8', INALT: '#b8a888', COLT: '#cfd4d8',
};
const hasLegs = (c: Cab) => c.type !== 'SUSPENDAT';
const totalH = (c: Cab) => c.h + (hasLegs(c) ? LEG : 0); // înălțimea ocupată, cu picioare
const foot = (c: Cab) => (Math.round(c.rot / Q) % 2 === 0 ? { fw: c.w, fd: c.d } : { fw: c.d, fd: c.w });

const INITIAL: Cab[] = [
  { id: 'b1', label: 'Bază 800', type: 'BAZA', w: 800, h: 720, d: 560, cx: 500, cz: 280, by: 0, rot: 0 },
  { id: 'b2', label: 'Bază 600', type: 'BAZA', w: 600, h: 720, d: 560, cx: 1250, cz: 340, by: 0, rot: 0 },
  { id: 'b3', label: 'Chiuvetă 900', type: 'BAZA', w: 900, h: 720, d: 560, cx: 2050, cz: 300, by: 0, rot: 0 },
  { id: 't1', label: 'Înalt 600', type: 'INALT', w: 600, h: 2100, d: 560, cx: 2900, cz: 300, by: 0, rot: 0 },
  { id: 'w1', label: 'Susp. 600', type: 'SUSPENDAT', w: 600, h: 720, d: 320, cx: 500, cz: 200, by: 1400, rot: 0 },
  { id: 'w2', label: 'Susp. 900', type: 'SUSPENDAT', w: 900, h: 720, d: 320, cx: 1300, cz: 200, by: 1400, rot: 0 },
];

function place(me: Cab, cx: number, cz: number, others: Cab[], room: Room) {
  const { fw, fd } = foot(me);
  const hw = fw / 2, hd = fd / 2;

  let bestX: number | null = null, bx = SNAP_WALL;
  const tryX = (delta: number, prag: number) => { if (Math.abs(delta) < Math.min(prag, bx)) { bestX = delta; bx = Math.abs(delta); } };
  let bestZ: number | null = null, bz = SNAP_WALL;
  const tryZ = (delta: number, prag: number) => { if (Math.abs(delta) < Math.min(prag, bz)) { bestZ = delta; bz = Math.abs(delta); } };

  tryX(hw - cx, SNAP_WALL); tryX(room.W - hw - cx, SNAP_WALL);
  tryZ(hd - cz, SNAP_WALL); tryZ(room.D - hd - cz, SNAP_WALL);
  for (const o of others) {
    const of = foot(o);
    const oL = o.cx - of.fw / 2, oR = o.cx + of.fw / 2;
    const oB = o.cz - of.fd / 2, oF = o.cz + of.fd / 2;
    tryX(oL - hw - cx, SNAP_NEIGH); tryX(oR + hw - cx, SNAP_NEIGH);
    tryX(oL + hw - cx, SNAP_NEIGH); tryX(oR - hw - cx, SNAP_NEIGH);
    tryZ(oB - hd - cz, SNAP_NEIGH); tryZ(oF + hd - cz, SNAP_NEIGH);
    tryZ(oB + hd - cz, SNAP_NEIGH); tryZ(oF - hd - cz, SNAP_NEIGH);
  }
  if (bestX !== null) cx += bestX;
  if (bestZ !== null) cz += bestZ;

  cx = Math.min(Math.max(cx, hw), room.W - hw);
  cz = Math.min(Math.max(cz, hd), room.D - hd);
  return { cx, cz };
}

// limitează cota de jos ca să nu iasă prin podea/tavan
const clampBy = (c: Cab, by: number, room: Room) =>
  Math.min(Math.max(by, 0), Math.max(0, room.H - totalH(c)));

function Legs({ c }: { c: Cab }) {
  const lx = (c.w / 2 - 30) * S, lz = (c.d / 2 - 30) * S, ly = (-c.h / 2 - LEG / 2) * S;
  return (
    <>
      {[[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].map(([x, z], i) => (
        <mesh key={i} position={[x, ly, z]} raycast={() => null}>
          <boxGeometry args={[0.03, LEG * S, 0.03]} />
          <meshStandardMaterial color="#4b4b4b" />
        </mesh>
      ))}
    </>
  );
}

function CabMesh({ c, hovered, active, onDown, onHover }: {
  c: Cab; hovered: boolean; active: boolean;
  onDown: (e: ThreeEvent<PointerEvent>, c: Cab) => void; onHover: (id: string | null) => void;
}) {
  const bodyBottom = c.by + (hasLegs(c) ? LEG : 0);
  return (
    <group position={[c.cx * S, (bodyBottom + c.h / 2) * S, c.cz * S]} rotation={[0, c.rot, 0]}>
      {hasLegs(c) && <Legs c={c} />}
      <mesh
        onPointerDown={(e) => onDown(e, c)}
        onPointerOver={(e) => { e.stopPropagation(); onHover(c.id); document.body.style.cursor = 'grab'; }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[c.w * S, c.h * S, c.d * S]} />
        <meshStandardMaterial color={active ? '#5b8def' : hovered ? '#93b3f0' : COLORS[c.type]} transparent opacity={0.94} />
        <Edges color={active || hovered ? '#2b5fd9' : '#8a6d45'} lineWidth={active ? 2.5 : 1} />
      </mesh>
      {/* fața = panou ușă (mai închis) + mâner */}
      <mesh position={[0, 0, c.d * S / 2 + 0.005]} raycast={() => null}>
        <planeGeometry args={[(c.w - 36) * S, (c.h - 36) * S]} />
        <meshStandardMaterial color="#6f5330" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[(c.w / 2 - 70) * S, 0, c.d * S / 2 + 0.008]} raycast={() => null}>
        <boxGeometry args={[0.014, Math.min(c.h * 0.35, 260) * S, 0.014]} />
        <meshStandardMaterial color="#e6ddc9" />
      </mesh>
      {(hovered || active) && (
        <Html center distanceFactor={2.6} position={[0, c.h * S / 2 + 0.05, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded bg-foreground/90 px-2 py-0.5 font-mono text-[11px] text-background shadow">
            {c.label} · {c.w}×{c.h}×{c.d} · {Math.round((c.rot / Q) % 4) * 90}° · h={Math.round(c.by)}mm
          </div>
        </Html>
      )}
    </group>
  );
}

function Walls({ room }: { room: Room }) {
  const { W, D, H } = room;
  const mat = <meshStandardMaterial color="#e7e3db" transparent opacity={0.22} side={THREE.DoubleSide} />;
  return (
    <>
      <mesh position={[W / 2 * S, H / 2 * S, 0]}>
        <planeGeometry args={[W * S, H * S]} />{mat}<Edges color="#b7b1a6" />
      </mesh>
      <mesh position={[0, H / 2 * S, D / 2 * S]} rotation={[0, Q, 0]}>
        <planeGeometry args={[D * S, H * S]} />{mat}<Edges color="#b7b1a6" />
      </mesh>
      <mesh position={[W * S, H / 2 * S, D / 2 * S]} rotation={[0, Q, 0]}>
        <planeGeometry args={[D * S, H * S]} />{mat}<Edges color="#b7b1a6" />
      </mesh>
    </>
  );
}

function Editor({ items, setItems, room, selectedId, onSelect, onSnapshot }: {
  items: Cab[]; setItems: React.Dispatch<React.SetStateAction<Cab[]>>; room: Room;
  selectedId: string | null; onSelect: (id: string | null) => void; onSnapshot: () => void;
}) {
  const { camera, gl, controls } = useThree();
  const dragRef = useRef<{ id: string; offX: number; offZ: number; moved: boolean } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const floorPoint = useCallback((clientX: number, clientY: number) => {
    const r = gl.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(plane, hit);
    return { x: hit.x / S + room.W / 2, z: hit.z / S + room.D / 2 };
  }, [camera, gl, ndc, plane, raycaster, hit, room]);

  const onMove = useCallback((e: PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    if (!d.moved) { d.moved = true; onSnapshot(); }
    const { x, z } = floorPoint(e.clientX, e.clientY);
    setItems((prev) => {
      const me = prev.find((i) => i.id === d.id); if (!me) return prev;
      const s = place(me, x - d.offX, z - d.offZ, prev.filter((i) => i.id !== d.id), room);
      return prev.map((i) => (i.id === d.id ? { ...i, cx: s.cx, cz: s.cz } : i));
    });
  }, [floorPoint, setItems, room, onSnapshot]);

  const onUp = useCallback(() => {
    dragRef.current = null;
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
    document.body.style.cursor = '';
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [controls, onMove]);

  const onDown = useCallback((e: ThreeEvent<PointerEvent>, c: Cab) => {
    e.stopPropagation();
    onSelect(c.id);
    const { x, z } = floorPoint(e.clientX, e.clientY);
    dragRef.current = { id: c.id, offX: x - c.cx, offZ: z - c.cz, moved: false };
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
    document.body.style.cursor = 'grabbing';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [controls, floorPoint, onMove, onUp, onSelect]);

  return (
    <group position={[-room.W / 2 * S, 0, -room.D / 2 * S]}>
      <Walls room={room} />
      {items.map((c) => (
        <CabMesh key={c.id} c={c} hovered={c.id === hoverId && c.id !== selectedId} active={c.id === selectedId}
          onDown={onDown} onHover={setHoverId} />
      ))}
    </group>
  );
}

export default function Prototip3D() {
  const [items, setItems] = useState<Cab[]>(INITIAL);
  const [room, setRoom] = useState<Room>({ W: 3600, D: 2800, H: 2600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<Cab[][]>([]);
  const [future, setFuture] = useState<Cab[][]>([]);
  const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const camDist = Math.max(room.W, room.D) * S;

  const snapshot = useCallback(() => { setPast((p) => [...p.slice(-49), items]); setFuture([]); }, [items]);
  const undo = useCallback(() => {
    setPast((p) => { if (!p.length) return p; setFuture((f) => [items, ...f]); setItems(p[p.length - 1]); return p.slice(0, -1); });
  }, [items]);
  const redo = useCallback(() => {
    setFuture((f) => { if (!f.length) return f; setPast((p) => [...p, items]); setItems(f[0]); return f.slice(1); });
  }, [items]);

  const rotate = useCallback(() => {
    if (!selectedId) return;
    snapshot();
    setItems((prev) => {
      const me = prev.find((i) => i.id === selectedId); if (!me) return prev;
      const rotated = { ...me, rot: me.rot + Q };
      const s = place(rotated, rotated.cx, rotated.cz, prev.filter((i) => i.id !== selectedId), room);
      return prev.map((i) => (i.id === selectedId ? { ...rotated, cx: s.cx, cz: s.cz } : i));
    });
  }, [selectedId, room, snapshot]);

  const nudge = useCallback((dir: 1 | -1) => {
    if (!selectedId) return;
    snapshot();
    setItems((prev) => prev.map((i) => (i.id === selectedId ? { ...i, by: clampBy(i, i.by + dir * V_STEP, room) } : i)));
  }, [selectedId, room, snapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.key === 'r' || e.key === 'R') rotate();
      if (e.key === 'ArrowUp') { e.preventDefault(); nudge(1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); nudge(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotate, nudge, undo, redo]);

  return (
    <div className="fixed inset-0 bg-neutral-100">
      <div className="absolute left-4 top-4 z-10 w-64 rounded-lg bg-white/95 p-3 text-sm shadow">
        <div className="font-semibold">Prototip — cameră + corpuri</div>
        <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-neutral-600">
          {(['W', 'D', 'H'] as const).map((k) => (
            <label key={k} className="flex flex-col">
              {k === 'W' ? 'Lățime' : k === 'D' ? 'Adâncime' : 'Înălțime'}
              <input type="number" step={100} value={room[k]}
                onChange={(e) => setRoom((r) => ({ ...r, [k]: num(e.target.value, k === 'H' ? 2000 : 1000, 8000) }))}
                className="mt-0.5 rounded border px-1 py-0.5" />
            </label>
          ))}
        </div>
        <div className="mt-2 flex gap-1">
          <button onClick={undo} disabled={!past.length} className="flex-1 rounded border px-2 py-1 disabled:opacity-40">↶ Undo</button>
          <button onClick={redo} disabled={!future.length} className="flex-1 rounded border px-2 py-1 disabled:opacity-40">Redo ↷</button>
        </div>
        <div className="mt-1 flex gap-1">
          <button onClick={rotate} disabled={!selectedId} className="flex-1 rounded bg-blue-600 px-2 py-1 text-white disabled:opacity-40">Rotește 90°</button>
          <button onClick={() => nudge(1)} disabled={!selectedId} className="rounded border px-2 py-1 disabled:opacity-40">↑</button>
          <button onClick={() => nudge(-1)} disabled={!selectedId} className="rounded border px-2 py-1 disabled:opacity-40">↓</button>
        </div>
        <ul className="mt-2 list-disc pl-4 text-xs text-neutral-500">
          <li>Click = selectează, trage = mută</li>
          <li>R = rotește · ↑/↓ = urcă/coboară</li>
          <li>Ctrl+Z / Ctrl+Shift+Z = undo/redo</li>
        </ul>
      </div>
      <Canvas camera={{ position: [camDist * 0.9, camDist * 0.9, camDist * 1.4], fov: 42 }}
        onPointerMissed={() => setSelectedId(null)}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} />
        <Grid args={[16, 16]} cellSize={0.5} cellColor="#c9c4bb" sectionSize={1} sectionColor="#a8a29a"
          infiniteGrid fadeDistance={20} />
        <Editor items={items} setItems={setItems} room={room} selectedId={selectedId} onSelect={setSelectedId} onSnapshot={snapshot} />
        <OrbitControls makeDefault enableDamping zoomToCursor target={[0, 0.7, 0]} />
      </Canvas>
    </div>
  );
}

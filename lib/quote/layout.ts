// Logică pură pentru „Așezare 3D" a unui ansamblu: snapping la pereți/vecini, coliziune
// (corpul rămâne în cameră), auto-aranjare inițială și dimensiuni implicite de cameră.
// Fără dependențe de three sau prisma — testabilă izolat, refolosită de editorul 3D.
import type { CabinetType } from '@/lib/engine';

export const SNAP_WALL = 200; // prag snap la perete (mm)
export const SNAP_NEIGH = 240; // prag snap la vecin din aceeași bandă (mm)
export const SNAP_CROSS = 100; // prag snap mai blând la aliniere între benzi (suspendat peste bază) (mm)
export const AUTO_ORIENT = 600; // sub această distanță de un perete, corpul se orientează cu spatele la el (mm)
export const DEFAULT_MOUNT = 1400; // cota implicită de jos a corpurilor suspendate (mm)
export const BLAT_MOUNT = 820; // cota implicită de jos a blatului — înălțime tipică de blat (leg+bază), NU calculată din corpuri (mm)
const Q = Math.PI / 2;

// perete ca segment independent: linie axabilă la `at`, întinsă pe [lo,hi] pe cealaltă axă, înălțime h
export type WallSeg = { id: string; axis: 'x' | 'z'; at: number; lo: number; hi: number; h: number };
export type LayoutRoom = { W: number; D: number; H: number; walls?: WallSeg[] };
export const WALL_DIMENSION_STEP = 1;

export function parseDimensionDraft(raw: string): number | null {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function moveWallTo(wall: WallSeg, cx: number, cz: number): WallSeg {
  const half = (wall.hi - wall.lo) / 2;
  return wall.axis === 'x'
    ? { ...wall, at: cx, lo: cz - half, hi: cz + half }
    : { ...wall, at: cz, lo: cx - half, hi: cx + half };
}

export function resizeWall(wall: WallSeg, dimension: 'len' | 'h', value: number): WallSeg {
  const mm = Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
  return dimension === 'h' ? { ...wall, h: mm } : { ...wall, hi: wall.lo + mm };
}

export type LayoutDeleteAction = { kind: 'wall'; id: string } | { kind: 'fixed' } | null;

export function layoutDeleteAction({
  key, selectedWallId, hasSelectedFixed, isEditing,
}: {
  key: string; selectedWallId: string | null; hasSelectedFixed: boolean; isEditing: boolean;
}): LayoutDeleteAction {
  if (isEditing) return null;
  if (key === 'Backspace') return selectedWallId ? { kind: 'wall', id: selectedWallId } : null;
  if (key === 'Delete') {
    if (selectedWallId) return { kind: 'wall', id: selectedWallId };
    if (hasSelectedFixed) return { kind: 'fixed' };
  }
  return null;
}

// pereții impliciți (spate/stânga/dreapta) generați din dreptunghiul W×D
export function defaultWalls(W: number, D: number, H: number): WallSeg[] {
  return [
    { id: 'back', axis: 'z', at: 0, lo: 0, hi: W, h: H },
    { id: 'left', axis: 'x', at: 0, lo: 0, hi: D, h: H },
    { id: 'right', axis: 'x', at: W, lo: 0, hi: D, h: H },
  ];
}
export const roomWalls = (room: LayoutRoom): WallSeg[] => room.walls ?? defaultWalls(room.W, room.D, room.H);

// partea „dinspre cameră" a unui perete (spre centru) — pt. lipire și orientare
const wallInner = (w: WallSeg, cx: number, cz: number): 1 | -1 =>
  w.axis === 'x' ? (w.at < cx ? 1 : -1) : (w.at < cz ? 1 : -1);

// dreptunghiul care încadrează toți pereții — pt. clamp corpuri + încadrare cameră
export function wallsBounds(walls: WallSeg[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const xs: number[] = [], zs: number[] = [];
  for (const w of walls) {
    if (w.axis === 'x') { xs.push(w.at); zs.push(w.lo, w.hi); }
    else { zs.push(w.at); xs.push(w.lo, w.hi); }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}
// fronturile reale ale corpului (din inputJson): null = fără fronturi, deci nu desenăm nimic.
// falsLeftMm/falsRightMm = fronturi false (panouri fixe, ex. panoul orb de COLȚ) — ocupă din
// lățime înaintea ușilor, ca la calculul real; 0/lipsă = fără fals pe latura respectivă.
export type Front =
  | { kind: 'doors'; count: number; falsLeftMm?: number; falsRightMm?: number; glass?: boolean }
  | { kind: 'drawers'; count: number; heights?: number[]; glass?: boolean }
  | null;

// împarte fața unui corp cu uși în panouri false (fixe, la margini) + uși (restul lățimii, egal).
// x în [-W/2, W/2], din față. Fără fals ⇒ ușile umplu toată lățimea (comportamentul dinainte).
export function doorSlots(
  W: number, count: number, falsLeftMm = 0, falsRightMm = 0,
): { fals: { cx: number; w: number }[]; doors: { cx: number; w: number }[] } {
  const fL = Math.max(0, falsLeftMm), fR = Math.max(0, falsRightMm);
  const fals: { cx: number; w: number }[] = [];
  if (fL > 0) fals.push({ cx: -W / 2 + fL / 2, w: fL });
  if (fR > 0) fals.push({ cx: W / 2 - fR / 2, w: fR });
  const n = Math.max(1, count);
  const areaW = Math.max(0, W - fL - fR);
  const dw = areaW / n;
  const x0 = -W / 2 + fL;
  const doors = Array.from({ length: n }, (_, i) => ({ cx: x0 + dw * (i + 0.5), w: dw }));
  return { fals, doors };
}
export type LayoutItem = {
  id: string;
  label: string;
  type: CabinetType;
  w: number; h: number; d: number;
  legMm: number;   // înălțimea picioarelor (0 = fără — corpuri suspendate)
  hasPlinth?: boolean;
  front: Front;    // uși/sertare/nimic
  shelves: number; // nr. polițe (arătate doar la corpurile fără fronturi, ca să se vadă fața)
  glassShelves?: boolean; // polițe din sticlă clară, randate transparent
  cx: number; cz: number; by: number; // centru X/Z + cota de jos (mm)
  rot: number;     // radiani, multiplu de 90°
  topOpen?: boolean;     // corp „sub blat"/pazii: fără capac plin — se randează cu vârful deschis
  pazieWidthMm?: number; // lățimea barelor de pazie (când topOpen din pazii); lipsă = capac absent
};

export function legDepthPositions(depthMm: number, hasPlinth: boolean): { front: number; back: number } {
  const regularInset = Math.max(0, depthMm / 2 - 30);
  const front = hasPlinth
    ? Math.max(-regularInset, depthMm / 2 - 55)
    : regularInset;
  return { front, back: -regularInset };
}

// peretele cel mai apropiat de (cx,cz) în raza `maxDist`, cu partea dinspre cameră (inner)
export function nearestWall(
  cx: number, cz: number, room: LayoutRoom, maxDist = AUTO_ORIENT,
): { wall: WallSeg; inner: 1 | -1 } | null {
  const b = wallsBounds(roomWalls(room));
  const ccx = (b.minX + b.maxX) / 2, ccz = (b.minZ + b.maxZ) / 2;
  let best: WallSeg | null = null, bestDist = maxDist;
  for (const w of roomWalls(room)) {
    const within = w.axis === 'x' ? cz >= w.lo && cz <= w.hi : cx >= w.lo && cx <= w.hi;
    if (!within) continue;
    const dist = w.axis === 'x' ? Math.abs(cx - w.at) : Math.abs(cz - w.at);
    if (dist < bestDist) { bestDist = dist; best = w; }
  }
  return best ? { wall: best, inner: wallInner(best, ccx, ccz) } : null;
}

// orientarea „spate la perete": sub AUTO_ORIENT de cel mai apropiat perete (oricare, inclusiv
// adăugat), corpul se întoarce ca spatele să fie pe acel perete; altfel păstrează rotația.
export function wallOrient(cx: number, cz: number, room: LayoutRoom, fallback: number): number {
  const nw = nearestWall(cx, cz, room, AUTO_ORIENT);
  if (!nw) return fallback;
  const { wall, inner } = nw;
  return wall.axis === 'z' ? (inner === 1 ? 0 : 2 * Q) : (inner === 1 ? Q : 3 * Q);
}

// lipește spatele corpului de peretele cel mai apropiat (oricât de departe): axa perpendiculară pe
// perete e fixată la el, cealaltă rămâne liberă. Pentru suspendate — „alunecă pe perete".
export function wallPin(
  me: Pick<LayoutItem, 'w' | 'd' | 'rot'>, cx: number, cz: number, room: LayoutRoom,
): { cx: number; cz: number } {
  const nw = nearestWall(cx, cz, room, Infinity);
  if (!nw) return { cx, cz };
  const { fw, fd } = foot(me);
  const { wall, inner } = nw;
  return wall.axis === 'z'
    ? { cx, cz: wall.at + inner * (fd / 2) }   // perete spate/față: fixăm adâncimea (Z), X liber
    : { cx: wall.at + inner * (fw / 2), cz };   // perete lateral: fixăm X, Z liber
}

// elemente fixe de construcție (nu mobilă): se trag și se lipesc ca un corp, dar sunt obstacole.
// legMm e mereu 0, ca să fie compatibile cu place()/bandsOverlap (aceleași câmpuri geometrice).
export type FixedKind = 'GRINDA' | 'STALP' | 'PERETE' | 'CUTIE' | 'GEAM';
export type FixedItem = {
  id: string; kind: FixedKind;
  w: number; h: number; d: number; legMm: 0;
  cx: number; cz: number; by: number; rot: number;
};
export const FIXED_KINDS: { kind: FixedKind; label: string }[] = [
  { kind: 'GRINDA', label: 'Grindă' },
  { kind: 'STALP', label: 'Stâlp' },
  { kind: 'PERETE', label: 'Perete' },
  { kind: 'GEAM', label: 'Geam' },
  { kind: 'CUTIE', label: 'Cutie' },
];
export const SILL = 900; // cota implicită de parapet a geamului (mm)

// dimensiuni + poziție implicite pentru un element fix nou (raportate la cameră)
export function newFixed(kind: FixedKind, room: LayoutRoom, id: string): FixedItem {
  const base = { id, kind, legMm: 0 as const, cx: room.W / 2, rot: 0 };
  switch (kind) {
    case 'GRINDA': return { ...base, w: 1000, h: 300, d: 400, cz: 250, by: Math.max(0, room.H - 300) };
    case 'STALP': return { ...base, w: 300, h: room.H, d: 300, cz: 200, by: 0 };
    case 'PERETE': return { ...base, w: 100, h: room.H, d: 600, cz: 300, by: 0 };
    case 'GEAM': return { ...base, w: 1200, h: 1200, d: 80, cz: 0, by: SILL }; // încastrat în peretele din spate
    case 'CUTIE': return { ...base, w: 300, h: 600, d: 300, cz: 200, by: 0 };
  }
}

export const hasLegs = (c: Pick<LayoutItem, 'legMm'>) => c.legMm > 0;
export const totalH = (c: Pick<LayoutItem, 'h' | 'legMm'>) => c.h + c.legMm;

// amprenta pe podea ține cont de rotație: la 90°/270° lățimea și adâncimea se schimbă între ele
export function foot(c: Pick<LayoutItem, 'w' | 'd' | 'rot'>): { fw: number; fd: number } {
  return Math.round(c.rot / Q) % 2 === 0 ? { fw: c.w, fd: c.d } : { fw: c.d, fd: c.w };
}

export type StackPlacement = { cx: number; cz: number; by: number; rot: number; targetId: string };

// Când un suspendat este tras peste alt suspendat, îl stivuiește fără gol: întâi deasupra,
// apoi dedesubt dacă nu încape. Spatele urmează exact planul vecinului, iar pe lățime se
// aliniază la muchia cea mai apropiată (sau la centru).
export function stackSuspended(
  me: LayoutItem, rawCx: number, rawCz: number, others: LayoutItem[], room: LayoutRoom,
): StackPlacement | null {
  if (me.type !== 'SUSPENDAT') return null;
  const candidates: Array<StackPlacement & { score: number }> = [];
  const meHeight = totalH(me);

  for (const target of others) {
    if (target.type !== 'SUSPENDAT' || target.id === me.id) continue;
    const quarter = ((Math.round(target.rot / Q) % 4) + 4) % 4;
    const sideRaw = quarter % 2 === 0 ? rawCx : rawCz;
    const depthRaw = quarter % 2 === 0 ? rawCz : rawCx;
    const sideTarget = quarter % 2 === 0 ? target.cx : target.cz;
    const depthTarget = quarter % 2 === 0 ? target.cz : target.cx;
    if (Math.abs(sideRaw - sideTarget) >= (me.w + target.w) / 2) continue;
    if (Math.abs(depthRaw - depthTarget) >= (me.d + target.d) / 2) continue;

    const sidePositions = [
      sideTarget,
      sideTarget - target.w / 2 + me.w / 2,
      sideTarget + target.w / 2 - me.w / 2,
    ];
    const snappedSide = sidePositions.reduce((best, value) =>
      Math.abs(value - sideRaw) < Math.abs(best - sideRaw) ? value : best,
    );
    const targetBack = depthTarget + (quarter === 0 || quarter === 1 ? -target.d / 2 : target.d / 2);
    const snappedDepth = targetBack + (quarter === 0 || quarter === 1 ? me.d / 2 : -me.d / 2);
    const cx = quarter % 2 === 0 ? snappedSide : snappedDepth;
    const cz = quarter % 2 === 0 ? snappedDepth : snappedSide;
    const score = Math.hypot(cx - rawCx, cz - rawCz);
    if (score > SNAP_NEIGH) continue;

    const verticalOptions = [target.by + totalH(target), target.by - meHeight];
    for (const by of verticalOptions) {
      if (by < 0 || by + meHeight > room.H) continue;
      const placed = { ...me, cx, cz, by, rot: target.rot };
      if (others.some((other) => other.id !== target.id && overlapBox(placed, other) !== null)) continue;
      candidates.push({ cx, cz, by, rot: target.rot, targetId: target.id, score });
      break;
    }
  }

  candidates.sort((a, b) => a.score - b.score || b.by - a.by);
  const best = candidates[0];
  return best ? { cx: best.cx, cz: best.cz, by: best.by, rot: best.rot, targetId: best.targetId } : null;
}

// snapping (perete + vecini, cap-la-cap și aliniere pe ambele axe) + coliziune cu pereții.
// snap=false: doar coliziune + clamp (pentru nudge fin cu săgețile, fără lipire).
// Snapping-ul vede TOATE elementele (blatul se aliniază la bazele de sub el, chiar din altă
// bandă), dar coliziunea împinge doar elementele din aceeași bandă verticală (blatul stă peste).
export function place(
  me: Pick<LayoutItem, 'w' | 'd' | 'rot' | 'by' | 'h' | 'legMm'>, cx: number, cz: number,
  others: Pick<LayoutItem, 'w' | 'd' | 'rot' | 'cx' | 'cz' | 'by' | 'h' | 'legMm'>[], room: LayoutRoom,
  snap = true, constrainToWalls = true,
): { cx: number; cz: number } {
  const { fw, fd } = foot(me);
  const hw = fw / 2, hd = fd / 2;
  const b0 = wallsBounds(roomWalls(room));

  if (snap) {
    let bestX: number | null = null, bx = SNAP_WALL;
    const tryX = (delta: number, prag: number) => { if (Math.abs(delta) < Math.min(prag, bx)) { bestX = delta; bx = Math.abs(delta); } };
    let bestZ: number | null = null, bz = SNAP_WALL;
    const tryZ = (delta: number, prag: number) => { if (Math.abs(delta) < Math.min(prag, bz)) { bestZ = delta; bz = Math.abs(delta); } };

    // lipire la fiecare perete (segment) — doar dacă corpul se suprapune cu întinderea peretelui
    const ccx = (b0.minX + b0.maxX) / 2, ccz = (b0.minZ + b0.maxZ) / 2;
    for (const w of roomWalls(room)) {
      const inner = w.axis === 'x' ? (w.at < ccx ? 1 : -1) : (w.at < ccz ? 1 : -1);
      if (w.axis === 'x') {
        if (cz + hd > w.lo && cz - hd < w.hi) tryX((inner === 1 ? w.at + hw : w.at - hw) - cx, SNAP_WALL);
      } else if (cx + hw > w.lo && cx - hw < w.hi) {
        tryZ((inner === 1 ? w.at + hd : w.at - hd) - cz, SNAP_WALL);
      }
    }
    for (const o of others) {
      const of = foot(o);
      const oL = o.cx - of.fw / 2, oR = o.cx + of.fw / 2;
      const oB = o.cz - of.fd / 2, oF = o.cz + of.fd / 2;
      // vecin din aceeași bandă/stivuit → magnet ferm; între benzi (suspendat peste bază) → magnet blând
      const prag = bandsNear(me, o) ? SNAP_NEIGH : SNAP_CROSS;
      tryX(oL - hw - cx, prag); tryX(oR + hw - cx, prag);
      tryX(oL + hw - cx, prag); tryX(oR - hw - cx, prag);
      tryZ(oB - hd - cz, prag); tryZ(oF + hd - cz, prag);
      tryZ(oB + hd - cz, prag); tryZ(oF - hd - cz, prag);
    }
    if (bestX !== null) cx += bestX;
    if (bestZ !== null) cz += bestZ;
  }

  // coliziune: împinge corpul afară din suprapunerile cu alte elemente (amprentă AABB),
  // pe axa cu pătrunderea minimă; câteva iterații ca să se așeze între mai mulți vecini
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    for (const o of others) {
      if (!bandsOverlap(me, o)) continue; // stau în benzi diferite (ex. blat peste bază) → nu se împing
      const of = foot(o);
      const ox = hw + of.fw / 2 - Math.abs(cx - o.cx);
      const oz = hd + of.fd / 2 - Math.abs(cz - o.cz);
      if (ox > 0.5 && oz > 0.5) { // se suprapun
        // panourile subțiri (geam/perete) împing corpul pe axa lor LUNGĂ (de-a lungul peretelui),
        // ca să fie dat lateral, nu împins în față/spate; restul — pe pătrunderea minimă
        const thin = Math.min(of.fw, of.fd) < 0.4 * Math.max(of.fw, of.fd);
        const alongX = thin ? of.fw >= of.fd : ox <= oz;
        if (alongX) cx += cx >= o.cx ? ox : -ox;
        else cz += cz >= o.cz ? oz : -oz;
        pushed = true;
      }
    }
    if (!pushed) break;
  }

  if (constrainToWalls) {
    cx = Math.min(Math.max(cx, b0.minX + hw), b0.maxX - hw);
    cz = Math.min(Math.max(cz, b0.minZ + hd), b0.maxZ - hd);
  }
  return { cx, cz };
}

// ghidaj de aliniere (stil Figma). Pe podea: axis='x' ⇒ linie de-a lungul Z (aliniere stânga/dreapta),
// axis='z' ⇒ de-a lungul X. Vertical: axis='v' ⇒ plumb la (x,z) de la y0 la y1 (aliniere între benzi,
// ex. suspendat peste bază — arată că sunt pe aceeași linie verticală).
export type SnapGuide =
  | { axis: 'x' | 'z'; at: number; from: number; to: number }
  | { axis: 'v'; x: number; z: number; y0: number; y1: number };
export const GUIDE_TOL = 1.5; // mm — muchii mai apropiate de atât se consideră aliniate

// liniile de aliniere active pentru `me` la (cx,cz): muchiile lui care coincid (±GUIDE_TOL) cu fața
// unui perete sau cu o muchie a unui vecin. Oglindește țintele de snap din place(), deci apar exact
// când corpul e „lipit". Vecin din aceeași bandă/stivuit ⇒ linie pe podea; între benzi ⇒ linie verticală.
export function snapGuides(
  me: Pick<LayoutItem, 'w' | 'd' | 'rot' | 'by' | 'h' | 'legMm'>, cx: number, cz: number,
  others: Pick<LayoutItem, 'w' | 'd' | 'rot' | 'cx' | 'cz' | 'by' | 'h' | 'legMm'>[], room: LayoutRoom,
): SnapGuide[] {
  const { fw, fd } = foot(me);
  const hw = fw / 2, hd = fd / 2;
  const xEdges = [cx - hw, cx + hw], zEdges = [cz - hd, cz + hd];
  const meY0 = me.by, meY1 = me.by + totalH(me);
  const raw: SnapGuide[] = [];

  for (const w of roomWalls(room)) {
    if (w.axis === 'x') {
      if (cz + hd > w.lo && cz - hd < w.hi)
        for (const xe of xEdges) if (Math.abs(xe - w.at) <= GUIDE_TOL) raw.push({ axis: 'x', at: w.at, from: cz - hd, to: cz + hd });
    } else if (cx + hw > w.lo && cx - hw < w.hi) {
      for (const ze of zEdges) if (Math.abs(ze - w.at) <= GUIDE_TOL) raw.push({ axis: 'z', at: w.at, from: cx - hw, to: cx + hw });
    }
  }

  for (const o of others) {
    const of = foot(o);
    const oL = o.cx - of.fw / 2, oR = o.cx + of.fw / 2;
    const oB = o.cz - of.fd / 2, oF = o.cz + of.fd / 2;
    if (bandsNear(me, o)) {
      // același nivel → ghidaje pe podea, pe ambele axe, întinse peste ambele elemente
      for (const xe of xEdges) for (const oe of [oL, oR]) if (Math.abs(xe - oe) <= GUIDE_TOL)
        raw.push({ axis: 'x', at: oe, from: Math.min(cz - hd, oB), to: Math.max(cz + hd, oF) });
      for (const ze of zEdges) for (const oe of [oB, oF]) if (Math.abs(ze - oe) <= GUIDE_TOL)
        raw.push({ axis: 'z', at: oe, from: Math.min(cx - hw, oL), to: Math.max(cx + hw, oR) });
    } else {
      // benzi separate (suspendat peste bază) → linie verticală la muchia X aliniată
      const oY1 = o.by + totalH(o);
      for (const xe of xEdges) for (const oe of [oL, oR]) if (Math.abs(xe - oe) <= GUIDE_TOL)
        raw.push({ axis: 'v', x: oe, z: cz, y0: Math.min(meY0, o.by), y1: Math.max(meY1, oY1) });
    }
  }

  // unește ghidajele de pe aceeași linie, extinzând întinderea
  const merged: SnapGuide[] = [];
  for (const g of raw) {
    if (g.axis === 'v') {
      const m = merged.find((x): x is Extract<SnapGuide, { axis: 'v' }> =>
        x.axis === 'v' && Math.abs(x.x - g.x) <= GUIDE_TOL && Math.abs(x.z - g.z) <= GUIDE_TOL);
      if (m) { m.y0 = Math.min(m.y0, g.y0); m.y1 = Math.max(m.y1, g.y1); } else merged.push({ ...g });
    } else {
      const m = merged.find((x): x is Extract<SnapGuide, { axis: 'x' | 'z' }> =>
        x.axis === g.axis && Math.abs(x.at - g.at) <= GUIDE_TOL);
      if (m) { m.from = Math.min(m.from, g.from); m.to = Math.max(m.to, g.to); } else merged.push({ ...g });
    }
  }
  return merged;
}

// volumul de intersecție dintre două corpuri (null dacă nu se suprapun) — pentru semnalul roșu
export type OverlapBox = { cx: number; cz: number; by: number; w: number; d: number; h: number };
type Solid = Pick<LayoutItem, 'w' | 'd' | 'rot' | 'cx' | 'cz' | 'by' | 'h' | 'legMm'>;
export function overlapBox(a: Solid, b: Solid): OverlapBox | null {
  const fa = foot(a), fb = foot(b);
  const x0 = Math.max(a.cx - fa.fw / 2, b.cx - fb.fw / 2), x1 = Math.min(a.cx + fa.fw / 2, b.cx + fb.fw / 2);
  const z0 = Math.max(a.cz - fa.fd / 2, b.cz - fb.fd / 2), z1 = Math.min(a.cz + fa.fd / 2, b.cz + fb.fd / 2);
  const y0 = Math.max(a.by, b.by), y1 = Math.min(a.by + totalH(a), b.by + totalH(b));
  if (x1 - x0 <= 1 || z1 - z0 <= 1 || y1 - y0 <= 1) return null; // toleranță 1mm (atingerea nu contează)
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, by: y0, w: x1 - x0, d: z1 - z0, h: y1 - y0 };
}
// toate zonele de intersecție dintr-o listă de corpuri
export function overlaps(solids: Solid[]): OverlapBox[] {
  const out: OverlapBox[] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const o = overlapBox(solids[i], solids[j]);
      if (o) out.push(o);
    }
  }
  return out;
}

// două elemente se ciocnesc doar dacă benzile lor verticale se suprapun (un corp suspendat
// și unul de bază pot avea aceeași amprentă fără să se atingă). Folosit ca filtru pentru place().
export function bandsOverlap(
  a: Pick<LayoutItem, 'by' | 'h' | 'legMm'>, b: Pick<LayoutItem, 'by' | 'h' | 'legMm'>,
): boolean {
  return a.by < b.by + totalH(b) && b.by < a.by + totalH(a);
}

export const SNAP_STACK_GAP = 120; // mm — sub acest gol vertical între benzi, elementele încă se aliniază (blat peste bază)
// benzile verticale se suprapun SAU sunt la cel mult `gap` una de alta (stau ~stivuite). Filtru pentru
// SNAPPING (nu coliziune): un suspendat NU se lipește de bazele de pe podea (gol ~580mm), dar blatul da.
export function bandsNear(
  a: Pick<LayoutItem, 'by' | 'h' | 'legMm'>, b: Pick<LayoutItem, 'by' | 'h' | 'legMm'>, gap = SNAP_STACK_GAP,
): boolean {
  return a.by <= b.by + totalH(b) + gap && b.by <= a.by + totalH(a) + gap;
}

// limitează cota de jos ca să nu iasă corpul prin podea/tavan
export function clampBy(c: Pick<LayoutItem, 'h' | 'legMm'>, by: number, room: LayoutRoom): number {
  return Math.min(Math.max(by, 0), Math.max(0, room.H - totalH(c)));
}

export const degToRad = (deg: number) => (deg * Math.PI) / 180;
export const radToDeg = (rot: number) => ((Math.round(rot / Q) % 4) + 4) % 4 * 90;

// dimensiuni implicite de cameră când ansamblul n-are încă valori setate
export function defaultRoom(items: Pick<LayoutItem, 'w' | 'd' | 'legMm'>[]): LayoutRoom {
  const floorWidth = items.filter((i) => hasLegs(i)).reduce((s, i) => s + i.w, 0);
  const W = Math.min(8000, Math.max(2400, floorWidth + 600));
  return { W, D: 2800, H: 2600 };
}

// așază corpurile fără poziție salvată într-un rând pe peretele din spate, în ordine,
// începând după corpurile deja poziționate
// `blatTopMm` = fața de sus a blatului (înălțime corpuri bază); când e dat, blatul se așază cu
// VÂRFUL acolo (fund = blatTopMm − grosime), ca să stea exact pe corpurile de jos.
export function autoLayout(
  positioned: LayoutItem[], loose: LayoutItem[], room: LayoutRoom, blatTopMm?: number | null,
): LayoutItem[] {
  let x = positioned.reduce((mx, c) => Math.max(mx, c.cx + foot(c).fw / 2), 0);
  return loose.map((c) => {
    const { fw, fd } = foot(c);
    const cx = clampX(x + fw / 2, fw, room);
    x += fw;
    // blatul stă peste bazele standard; alte corpuri fără picioare = suspendate
    const by = hasLegs(c)
      ? 0
      : c.type === 'BLAT'
        ? (blatTopMm != null ? Math.max(0, blatTopMm - c.h) : BLAT_MOUNT)
        : DEFAULT_MOUNT;
    return { ...c, cx, cz: fd / 2, by: clampBy(c, by, room) };
  });
}

/** Cota de jos implicită a unui blat: dacă ansamblul are „înălțime corpuri bază", vârful
 *  blatului stă acolo (fund = baseHeight − grosime); altfel cota tipică BLAT_MOUNT. */
export function blatBottomFor(thicknessMm: number, blatTopMm?: number | null): number {
  return blatTopMm != null ? Math.max(0, blatTopMm - thicknessMm) : BLAT_MOUNT;
}

const clampX = (cx: number, fw: number, room: LayoutRoom) =>
  Math.min(Math.max(cx, fw / 2), room.W - fw / 2);

import { describe, expect, it } from 'vitest';
import * as layoutModule from '../layout';
import { AUTO_ORIENT, autoLayout, bandsOverlap, BLAT_MOUNT, clampBy, defaultRoom, defaultWalls, doorSlots, foot, overlapBox, place, radToDeg, snapGuides, wallOrient, wallPin, wallsBounds, type LayoutItem, type LayoutRoom } from '../layout';

type DeleteAction = { kind: 'wall'; id: string } | { kind: 'fixed' } | null;
type DeleteArgs = { key: string; selectedWallId: string | null; hasSelectedFixed: boolean; isEditing: boolean };
const layoutDeleteAction = (args: DeleteArgs): DeleteAction | undefined =>
  (layoutModule as unknown as { layoutDeleteAction?: (value: DeleteArgs) => DeleteAction }).layoutDeleteAction?.(args);
type WallSeg = { id: string; axis: 'x' | 'z'; at: number; lo: number; hi: number; h: number };
const moveWallTo = (wall: WallSeg, cx: number, cz: number): WallSeg | undefined =>
  (layoutModule as unknown as { moveWallTo?: (value: WallSeg, x: number, z: number) => WallSeg }).moveWallTo?.(wall, cx, cz);
const resizeWall = (wall: WallSeg, dimension: 'len' | 'h', value: number): WallSeg | undefined =>
  (layoutModule as unknown as { resizeWall?: (w: WallSeg, d: 'len' | 'h', v: number) => WallSeg }).resizeWall?.(wall, dimension, value);
const parseDimensionDraft = (raw: string): number | null | undefined =>
  (layoutModule as unknown as { parseDimensionDraft?: (value: string) => number | null }).parseDimensionDraft?.(raw);

describe('layoutDeleteAction — ștergere din tastatură', () => {
  it('Backspace șterge peretele selectat', () => {
    expect(layoutDeleteAction({
      key: 'Backspace', selectedWallId: 'wall-1', hasSelectedFixed: false, isEditing: false,
    })).toEqual({ kind: 'wall', id: 'wall-1' });
  });

  it('Backspace nu șterge corpuri sau elemente fixe', () => {
    expect(layoutDeleteAction({
      key: 'Backspace', selectedWallId: null, hasSelectedFixed: true, isEditing: false,
    })).toBeNull();
  });

  it('Backspace nu șterge peretele când utilizatorul editează un câmp', () => {
    expect(layoutDeleteAction({
      key: 'Backspace', selectedWallId: 'wall-1', hasSelectedFixed: false, isEditing: true,
    })).toBeNull();
  });

  it('Delete păstrează ștergerea existentă pentru perete și element fix', () => {
    expect(layoutDeleteAction({
      key: 'Delete', selectedWallId: 'wall-1', hasSelectedFixed: false, isEditing: false,
    })).toEqual({ kind: 'wall', id: 'wall-1' });
    expect(layoutDeleteAction({
      key: 'Delete', selectedWallId: null, hasSelectedFixed: true, isEditing: false,
    })).toEqual({ kind: 'fixed' });
  });
});

describe('poziționare liberă în editorul 3D', () => {
  it('permite unui corp să rămână în afara conturului format de pereți', () => {
    expect(place(base(), -900, 3500, [], room, false, false)).toEqual({ cx: -900, cz: 3500 });
  });

  it('mută un perete pe X/Z păstrând axa și lungimea', () => {
    expect(moveWallTo({ id: 'w', axis: 'x', at: 0, lo: 100, hi: 900, h: 2600 }, 1400, 1800))
      .toEqual({ id: 'w', axis: 'x', at: 1400, lo: 1400, hi: 2200, h: 2600 });
    expect(moveWallTo({ id: 'w', axis: 'z', at: 0, lo: 100, hi: 900, h: 2600 }, 1400, 1800))
      .toEqual({ id: 'w', axis: 'z', at: 1800, lo: 1000, hi: 1800, h: 2600 });
  });
});

describe('dimensiuni pereți la milimetru', () => {
  it('păstrează dimensiuni exacte care nu sunt rotunjite la sute', () => {
    const wall = { id: 'w', axis: 'x' as const, at: 0, lo: 100, hi: 900, h: 2600 };
    expect(resizeWall(wall, 'len', 2737)).toEqual({ ...wall, hi: 2837 });
    expect(resizeWall(wall, 'h', 2487)).toEqual({ ...wall, h: 2487 });
    expect((layoutModule as unknown as { WALL_DIMENSION_STEP?: number }).WALL_DIMENSION_STEP).toBe(1);
  });

  it('permite golirea temporară a câmpului înainte de introducerea unei valori', () => {
    expect(parseDimensionDraft('')).toBeNull();
    expect(parseDimensionDraft('2737')).toBe(2737);
    expect(parseDimensionDraft('abc')).toBeNull();
  });
});

const base = (over: Partial<LayoutItem> = {}): LayoutItem => ({
  id: 'x', label: 'B', type: 'BAZA', w: 600, h: 720, d: 560, legMm: 100, front: null, shelves: 0,
  cx: 300, cz: 280, by: 0, rot: 0, ...over,
});
const room: LayoutRoom = { W: 3600, D: 2800, H: 2600 };

describe('doorSlots — uși + fronturi false', () => {
  it('fără fals: ușile umplu toată lățimea (ca înainte)', () => {
    const { fals, doors } = doorSlots(600, 2);
    expect(fals).toEqual([]);
    expect(doors.map((d) => d.w)).toEqual([300, 300]);
    expect(doors.map((d) => d.cx)).toEqual([-150, 150]);
  });
  it('COLȚ fals stânga 370 + 2 uși pe 1200: falsul ia din lățime, ușile împart restul', () => {
    const { fals, doors } = doorSlots(1200, 2, 370, 0);
    expect(fals).toEqual([{ cx: -415, w: 370 }]);
    expect(doors.map((d) => d.w)).toEqual([415, 415]); // (1200-370)/2
    // ușile încep imediat după fals (de la x=-230)
    expect(doors[0].cx).toBeCloseTo(-22.5);
    expect(doors[1].cx).toBeCloseTo(392.5);
  });
  it('fals pe ambele laturi', () => {
    const { fals, doors } = doorSlots(1450, 2, 370, 250);
    expect(fals).toEqual([{ cx: -540, w: 370 }, { cx: 600, w: 250 }]);
    expect(doors.map((d) => d.w)).toEqual([415, 415]); // (1450-370-250)/2
  });
});

describe('foot — amprenta rotită', () => {
  it('la 0° păstrează lățime×adâncime', () => expect(foot(base())).toEqual({ fw: 600, fd: 560 }));
  it('la 90° schimbă lățimea cu adâncimea', () => expect(foot(base({ rot: Math.PI / 2 }))).toEqual({ fw: 560, fd: 600 }));
});

describe('place — snapping și coliziune', () => {
  it('lipește spatele de peretele din spate (z=0)', () => {
    const r = place(base(), 800, 250, [], room); // hd=280, aproape de perete
    expect(r.cz).toBe(280);
  });
  it('lipește latura stânga de peretele din stânga (x=0)', () => {
    const r = place(base(), 260, 280, [], room); // hw=300
    expect(r.cx).toBe(300);
  });
  it('nu lasă corpul să iasă prin perete (coliziune)', () => {
    const r = place(base(), -500, 280, [], room);
    expect(r.cx).toBe(300); // clamp la hw
  });
  it('lipește cap-la-cap două corpuri pe adâncime (rând pe perete lateral)', () => {
    const a = base({ id: 'a', rot: Math.PI / 2, cx: 280, cz: 300 }); // rotit: fw=560, fd=600
    const b = base({ id: 'b', rot: Math.PI / 2 });
    // b tras aproape de fața lui a (a.cz+fd/2 = 600) — ar trebui să se lipească
    const r = place(b, 280, 900 - 50, [a], room); // fd=600, hd=300; țintă spate b la fața a (z=600)
    expect(r.cz).toBe(900); // spate b (900-300) = 600 = fața a
  });
});

describe('place — snap cross-band, coliziune pe bandă (blat peste bază)', () => {
  it('blatul se aliniază pe X la muchia unei baze de dedesubt, fără să fie împins', () => {
    const baza = base({ id: 'b', cx: 1000, cz: 300, by: 0, h: 720, legMm: 100 }); // muchia stângă la 700
    const blat = { w: 600, d: 600, rot: 0, by: 820, h: 28, legMm: 0 }; // altă bandă (820..848)
    const r = place(blat, 1010, 300, [baza], room); // tras cu muchia stângă (710) lângă 700
    expect(r.cx).toBe(1000);       // muchia stângă lipită la 700 (700 + hw 300)
  });
  it('blatul NU e împins de bază chiar când e direct peste ea (benzi diferite)', () => {
    const baza = base({ id: 'b', cx: 1000, cz: 300, by: 0, h: 720, legMm: 100 });
    const blat = { w: 600, d: 600, rot: 0, by: 820, h: 28, legMm: 0 };
    const r = place(blat, 1000, 300, [baza], room, false); // fix peste, fără snap
    expect(r.cx).toBe(1000);       // rămâne peste, nu e dat lateral
  });
  it('suspendatul se aliniază ușor pe X la o bază de dedesubt când e aproape (magnet blând)', () => {
    const baza = base({ id: 'b', cx: 1000, cz: 300, by: 0, h: 720, legMm: 100 }); // muchie stg 700
    const susp = { w: 600, d: 320, rot: 0, by: 1400, h: 720, legMm: 0 };          // sus, gol ~580mm
    const r = place(susp, 1010, 900, [baza], room); // muchia stg (710) la 10mm de 700 (< prag blând 100)
    expect(r.cx).toBe(1000);       // se aliniază vertical (700 + hw 300)
  });
  it('suspendatul NU se lipește de bază dacă e departe (peste pragul blând)', () => {
    const baza = base({ id: 'b', cx: 1000, cz: 300, by: 0, h: 720, legMm: 100 }); // muchie stg 700
    const susp = { w: 600, d: 320, rot: 0, by: 1400, h: 720, legMm: 0 };
    const r = place(susp, 1160, 900, [baza], room); // muchia stg (860) la 160mm de 700 (> 100)
    expect(r.cx).toBe(1160);       // liber — nu-l trage de la distanță
  });
});

describe('place — coliziune fără suprapunere', () => {
  it('împinge corpul afară dintr-un altul suprapus (nu rămân încălecate)', () => {
    const a = base({ id: 'a', cx: 1000, cz: 280 });
    const r = place(base({ id: 'b' }), 1040, 300, [a], room); // aproape peste a
    const ox = 300 + 300 - Math.abs(r.cx - a.cx);
    const oz = 280 + 280 - Math.abs(r.cz - a.cz);
    expect(ox <= 0.6 || oz <= 0.6).toBe(true); // separate pe cel puțin o axă
  });
  it('corpuri lipite cap-la-cap rămân neschimbate (fără împingere)', () => {
    const a = base({ id: 'a', cx: 1000, cz: 280 });
    const r = place(base({ id: 'b' }), 1600, 280, [a], room); // exact lipit la dreapta
    expect(r.cx).toBe(1600);
  });
});

describe('geam — panou subțire pe perete', () => {
  const geam = { w: 1200, h: 1200, d: 80, rot: 0, cx: 1000, cz: 40, by: 0, legMm: 0 };
  it('împinge corpul lateral (X), nu în față', () => {
    // corp (w=600) tras exact peste geam, în aceeași bandă verticală
    const r = place({ w: 600, d: 320, rot: 0, by: 0, h: 800, legMm: 0 }, 1000, 160, [geam], room);
    const ox = 300 + 600 - Math.abs(r.cx - 1000); // pătrundere X rămasă
    expect(ox).toBeLessThanOrEqual(0.6); // clar de geam pe X (dat lateral)
    expect(Math.abs(r.cz - 160)).toBeLessThan(50); // rămâne lipit de perete (Z ~ neschimbat)
  });
  it('baza NU se ciocnește cu geamul — trece pe sub (benzi verticale)', () => {
    expect(bandsOverlap({ by: 0, h: 720, legMm: 100 }, { by: 900, h: 1200, legMm: 0 })).toBe(false);
  });
});

describe('overlapBox — zona de intersecție (semnal roșu)', () => {
  it('întoarce volumul de intersecție a două corpuri suprapuse', () => {
    const a = base({ cx: 1000, cz: 280, by: 0 });          // 600×720×560, ocupă 700..1300 pe X
    const b = base({ cx: 1400, cz: 280, by: 0 });          // ocupă 1100..1700 pe X → intersecție 1100..1300
    const o = overlapBox(a, b);
    expect(o).not.toBeNull();
    expect(o!.w).toBeCloseTo(200, 1); // 1300 − 1100
    expect(o!.cx).toBeCloseTo(1200, 1);
  });
  it('null când doar se ating (fără suprapunere reală)', () => {
    const a = base({ cx: 1000 }), b = base({ cx: 1600 }); // lipite exact la 1300
    expect(overlapBox(a, b)).toBeNull();
  });
  it('null când sunt în benzi verticale diferite (bază vs suspendat)', () => {
    const a = base({ by: 0, h: 720, legMm: 100 });
    const b = base({ by: 1400, h: 720, legMm: 0, cx: 300, cz: 280 });
    expect(overlapBox(a, b)).toBeNull();
  });
});

describe('bandsOverlap — bandă verticală', () => {
  it('bază și suspendat NU se ciocnesc (înălțimi diferite)', () => {
    const baza = base({ by: 0, h: 720, legMm: 100 }); // ocupă 0..820
    const susp = base({ type: 'SUSPENDAT', by: 1400, h: 720, legMm: 0 }); // 1400..2120
    expect(bandsOverlap(baza, susp)).toBe(false);
  });
  it('două corpuri de bază se ciocnesc (aceeași bandă)', () => {
    expect(bandsOverlap(base(), base())).toBe(true);
  });
});

describe('clampBy — verticală', () => {
  it('nu urcă peste tavan', () => {
    expect(clampBy(base(), 5000, room)).toBe(room.H - 820); // 2600 - (720+100)
  });
  it('nu coboară sub podea', () => expect(clampBy(base(), -100, room)).toBe(0));
});

describe('autoLayout — rând pe peretele din spate', () => {
  it('înșiră corpurile fără poziție, lipite pe spate, în ordine', () => {
    const items = [base({ id: 'a', w: 800 }), base({ id: 'b', w: 600 })];
    const out = autoLayout([], items, room);
    expect(out[0].cx).toBe(400); // 800/2
    expect(out[1].cx).toBe(800 + 300); // după primul + jumătate din al doilea
    expect(out.every((c) => c.cz === 280)).toBe(true); // toate cu spatele pe perete
  });
  it('suspendatele pornesc la cota de montaj', () => {
    const susp = base({ id: 's', type: 'SUSPENDAT', legMm: 0, h: 720 });
    const out = autoLayout([], [susp], room);
    expect(out[0].by).toBe(1400);
  });
  it('blatul pornește la cota de blat (~820), nu la cea de suspendat', () => {
    const blat = base({ id: 'bl', type: 'BLAT', legMm: 0, h: 38 });
    const out = autoLayout([], [blat], room);
    expect(out[0].by).toBe(BLAT_MOUNT);
  });
});

describe('wallPin — suspendatul alunecă pe perete', () => {
  it('lipește spatele de peretele din spate (Z = adâncime/2), X liber', () => {
    const r = wallPin({ w: 600, d: 320, rot: 0 }, 1500, 1200, room);
    expect(r.cx).toBe(1500); // X rămâne unde e cursorul
    expect(r.cz).toBe(160);  // spate la z=0 (fd/2)
  });
  it('lipește de peretele lateral cel mai apropiat (X fixat), Z liber', () => {
    const r = wallPin({ w: 600, d: 320, rot: Math.PI / 2 }, 100, 1400, room); // lângă x=0, rotit spre el
    expect(r.cz).toBe(1400); // Z rămâne unde e cursorul
    expect(r.cx).toBe(160);  // lipit de x=0 (fw/2 după rotire = 320/2)
  });
});

describe('snapGuides — ghidaje de aliniere (stil Figma)', () => {
  it('linie pe X când muchia stângă coincide cu a unui vecin, întinsă peste ambele pe Z', () => {
    const o = base({ cx: 1000, cz: 280 });   // X 700..1300, Z 0..560
    const me = base({ cx: 1000, cz: 900 });   // aceeași muchie stângă (700), în față (Z 620..1180)
    const g = snapGuides(me, me.cx, me.cz, [o], room);
    const gx = g.find((x) => x.axis === 'x' && Math.abs(x.at - 700) < 2);
    expect(gx).toBeTruthy();
    if (gx?.axis !== 'x') throw new Error('ghidaj X lipsă');
    expect(gx.from).toBeLessThanOrEqual(0);      // spatele lui o (0)
    expect(gx.to).toBeGreaterThanOrEqual(1180);  // fața lui me (1180)
  });
  it('linie pe Z când spatele corpului atinge peretele din spate', () => {
    const me = base({ cx: 800, cz: 280 });    // d=560 ⇒ zB = 0 (lipit de peretele spate)
    const g = snapGuides(me, me.cx, me.cz, [], room);
    expect(g.some((x) => x.axis === 'z' && Math.abs(x.at) < 2)).toBe(true);
  });
  it('niciun ghidaj când nimic nu e aliniat', () => {
    const o = base({ cx: 1000, cz: 280 });
    const me = base({ cx: 1650, cz: 900 });   // muchii care nu coincid cu o sau cu pereții
    expect(snapGuides(me, me.cx, me.cz, [o], room)).toHaveLength(0);
  });
  it('ghidaj VERTICAL (nu pe podea) când un suspendat se aliniază X cu o bază de dedesubt', () => {
    const baza = base({ cx: 1000, cz: 300, by: 0, h: 720, legMm: 100 });
    const susp = base({ cx: 1000, cz: 300, by: 1400, h: 720, legMm: 0 }); // aceleași muchii X, dar sus
    const g = snapGuides(susp, susp.cx, susp.cz, [baza], room);
    expect(g.some((x) => x.axis === 'v')).toBe(true);  // linie verticală (aceeași linie)
    expect(g.some((x) => x.axis === 'x')).toBe(false); // NU linie pe podea
  });
});

describe('pereți independenți (segmente)', () => {
  it('lipește de un perete cu poziție/întindere custom', () => {
    const custom: LayoutRoom = { W: 3600, D: 2800, H: 2600, walls: [
      { id: 'w1', axis: 'x', at: 1500, lo: 0, hi: 2800, h: 2600 }, // perete vertical la x=1500
    ] };
    const r = place(base(), 1250, 1400, [], custom); // corp la stânga peretelui, aproape
    expect(r.cx).toBe(1500 - 300); // muchia dreaptă lipită de perete (room center e la stânga lui)
  });
  it('nu se lipește dacă e în afara întinderii peretelui', () => {
    const custom: LayoutRoom = { W: 3600, D: 2800, H: 2600, walls: [
      { id: 'w1', axis: 'z', at: 0, lo: 0, hi: 800, h: 2600 }, // perete spate scurt (doar x∈[0,800])
    ] };
    const r = place(base({ cx: 2000 }), 2000, 250, [], custom); // corp la x=2000, în afara [0,800]
    expect(r.cz).not.toBe(280); // nu se lipește de peretele scurt
  });
  it('wallsBounds încadrează pereții', () => {
    const w = defaultWalls(3600, 2800, 2600);
    expect(wallsBounds(w)).toEqual({ minX: 0, maxX: 3600, minZ: 0, maxZ: 2800 });
  });
});

describe('wallOrient — auto-orientare spate la perete', () => {
  const Q = Math.PI / 2;
  it('spate la peretele din spate când e aproape de z=0', () => {
    expect(wallOrient(1800, 100, room, 0)).toBe(0);
  });
  it('spate la peretele din stânga când e aproape de x=0', () => {
    expect(wallOrient(100, 1400, room, 0)).toBe(Q);
  });
  it('spate la peretele din dreapta când e aproape de x=W', () => {
    expect(wallOrient(room.W - 100, 1400, room, 0)).toBe(3 * Q);
  });
  it('păstrează rotația curentă departe de orice perete', () => {
    expect(wallOrient(1800, AUTO_ORIENT + 500, room, Q)).toBe(Q);
  });
});

describe('defaultRoom și radToDeg', () => {
  it('camera implicită acoperă lățimea corpurilor de podea', () => {
    expect(defaultRoom([base({ w: 1500 }), base({ w: 1500 })]).W).toBe(1500 + 1500 + 600);
  });
  it('camera implicită are o lățime minimă', () => {
    expect(defaultRoom([base({ w: 600 })]).W).toBe(2400);
  });
  it('radToDeg normalizează rotația', () => {
    expect(radToDeg(0)).toBe(0);
    expect(radToDeg(Math.PI / 2)).toBe(90);
    expect(radToDeg(3 * Math.PI)).toBe(180);
  });
});

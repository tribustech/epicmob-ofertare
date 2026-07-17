# Configurator piese 3D — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurare per piesă pe orice corp (cant per muchie per bucată, material, dimensiuni manuale, capac plin/pazii/absent, piese libere), cu un configurator 3D permanent ca bottom sheet în editorul corpului.

**Architecture:** Motorul rămâne sursa adevărului: expand-erele emit bucăți individuale (`PieceInstance` cu cheie stabilă, muchii semantice și plasare 3D), override-urile din `CabinetInput.pieces` se aplică post-generare, iar un adaptor (`toParts`) regrupează bucățile identice în `Part[]`-ul existent — cutlist/nesting/costing/feronerie nu se ating. UI-ul (listă + viewport react-three-fiber + panou) citește `ExpandedCabinet.pieces` și scrie abateri în starea `piecesCfg`, salvată prin `piecesJson` în același submit cu formularul.

**Tech Stack:** TypeScript, Next.js 15, zod, Vitest (suita existentă), three + @react-three/fiber + @react-three/drei (client-only, `next/dynamic`).

**Spec:** `docs/superpowers/specs/2026-07-17-configurator-piese-3d-design.md`

## Global Constraints

- Branch: `feat/configurator-piese` (există; main e la `1641bac`).
- **FĂRĂ fișiere de test noi** (directiva 2026-07-14): se adaptează DOAR testele existente din `lib/engine/__tests__/` și `lib/quote/__tests__/`. Gate per task: `npx tsc --noEmit` + `npx vitest run` verzi; gate de fază: + `rm -rf .next && npm run build`.
- NU omorî serverul `next dev` al utilizatorului (rulează pe :3000/:3002). Buildul de producție DOAR cu `rm -rf .next` întâi.
- Fără migrare/fallback: `pieces` intră în `inputJson` (fără coloană Prisma nouă); inputurile vechi fără `pieces` = comportamentul de azi.
- Etichete UI în română; stil identic cu formularul existent (`fieldLabelCls`, shadcn/ui, mono pentru cifre).
- Motorul rămâne pur (fără Date.now/Math.random; id-urile pieselor libere se generează în UI, nu în motor).
- Deviere documentată față de spec: `Part` NU se șterge — rămâne exact ca azi ca „rând de debitare" (cutlist CSV are nevoie de l1/l2/w1/w2). `PieceInstance` e nivelul nou de deasupra; `toParts` face maparea semantic→debitare. `PieceInstance.name` rămâne numele canonic de azi („Ușă", „Laterală") pentru că `FRONT_PART_NAMES` filtrează pe el; eticheta de afișare e câmpul nou `label`.

---

## Faza 1 — Motorul

### Task 1: Tipuri noi + constantă + adaptorul `toParts`

**Files:**
- Modify: `lib/engine/types.ts` (după `PartEdges`, ~linia 139)
- Modify: `lib/engine/constants.ts`
- Create: `lib/engine/pieces.ts`

**Interfaces:**
- Produces: `EdgeSide`, `EDGE_SIDES`, `PieceKey`, `PieceOverride`, `FreePiece`, `PiecesConfig`, `PiecePlacement`, `PieceInstance`, `CabinetInput.pieces?`, `ConstructionConstants.pazieDefaultWidthMm`, `toParts(pieces: PieceInstance[]): Part[]` — folosite de toate task-urile următoare.

- [ ] **Step 1: Adaugă tipurile în `lib/engine/types.ts`** (după interfața `PartEdges`; `Part` rămâne neatins):

```ts
/** Laturi semantice; fiecare piesă folosește exact 4, după orientare:
 *  laterală = fata/spate/sus/jos; blat/fund/poliță/pazie = fata/spate/stanga/dreapta;
 *  front/spate corp = sus/jos/stanga/dreapta. */
export type EdgeSide = 'fata' | 'spate' | 'sus' | 'jos' | 'stanga' | 'dreapta';

export const EDGE_SIDES: EdgeSide[] = ['fata', 'spate', 'sus', 'jos', 'stanga', 'dreapta'];

export const EDGE_SIDE_LABELS: Record<EdgeSide, string> = {
  fata: 'Față', spate: 'Spate', sus: 'Sus', jos: 'Jos', stanga: 'Stânga', dreapta: 'Dreapta',
};

/** Cheie stabilă de bucată: 'laterala:0', 'blat-corp', 'pazie-fata', 'polita:2',
 *  'usa:0', 'front-sertar:1', 'panou-orb', 'sertar:0:laterala:1', 'libera:<id>'. */
export type PieceKey = string;

export interface PieceOverride {
  edges?: Partial<Record<EdgeSide, string | null>>; // id EdgeBand; null = fără cant
  materialId?: string;
  lengthMm?: number;   // override manual; lipsă = auto
  widthMm?: number;
  removed?: boolean;   // piesa nu se generează (nici în cutlist)
}

export interface FreePiece {
  id: string;          // generat în UI la adăugare (crypto.randomUUID)
  name: string;
  lengthMm: number;    // fixe — nu se recalculează la redimensionarea corpului
  widthMm: number;
  qty: number;
  materialId: string;
  edges?: Partial<Record<EdgeSide, string | null>>;
}

export interface PiecesConfig {
  /** slot capac; default PLIN. Pazii = 2 traverse orizontale față+spate,
   *  lățime default cc.pazieDefaultWidthMm. */
  top?: { variant: 'PLIN' | 'PAZII' | 'ABSENT'; pazieWidthMm?: number };
  overrides?: Record<PieceKey, PieceOverride>;
  free?: FreePiece[];
}

/** mm; x: 0→W stânga→dreapta, y: 0→înălțimea carcasei jos→sus (0 = baza carcasei,
 *  sub picior nu se randează), z: 0→D spate→față (fronturile ies la z=D). */
export interface PiecePlacement {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
}

export interface PieceInstance {
  key: PieceKey;
  cabinetLabel: string;
  name: string;   // numele canonic de debitare ('Laterală', 'Ușă') — filtrat de FRONT_PART_NAMES
  label: string;  // eticheta de afișare ('Laterală stânga', 'Ușă 1')
  lengthMm: number;
  widthMm: number;
  materialId: string;
  edges: Partial<Record<EdgeSide, string>>;          // doar muchiile cu cant
  edgeAxis: Partial<Record<EdgeSide, 'L' | 'W'>>;    // cele 4 laturi aplicabile → latura de debitare
  manual?: { lengthMm?: boolean; widthMm?: boolean; material?: boolean; edges?: EdgeSide[] };
  calc?: { length?: DimCalc; width?: DimCalc };
  placement?: PiecePlacement; // lipsă la piese libere și BLAT — nu se randează în 3D
  free?: boolean;
}
```

- [ ] **Step 2: `CabinetInput` primește câmpul** — în interfața `CabinetInput`, după `blat?: …`:

```ts
  /** configurarea pieselor (configurator 3D): slot capac, override-uri per bucată, piese libere */
  pieces?: PiecesConfig;
```

- [ ] **Step 3: Constanta pazie** — în `ConstructionConstants` (types.ts) după `frontExtensionDefaultMm`:

```ts
  pazieDefaultWidthMm: number;       // lățimea implicită a paziilor (capac tip pazii)
```

și în `lib/engine/constants.ts` în `DEFAULT_CONSTRUCTION`:

```ts
  pazieDefaultWidthMm: 100,
```

(`parseConstruction` din `lib/catalog/convert.ts` face `{ ...DEFAULT_CONSTRUCTION, ...parsed }`, deci setările vechi din DB primesc automat defaultul — nu se atinge.)

- [ ] **Step 4: Creează `lib/engine/pieces.ts` cu adaptorul:**

```ts
import { EDGE_SIDES, type EdgeSide, type Part, type PartEdges, type PieceInstance } from './types';

/** Regrupează bucățile identice în rânduri de debitare (Part cu qty), mapând
 *  muchiile semantice pe laturile l1/l2/w1/w2 după edgeAxis. Ordinea laturilor
 *  e EDGE_SIDES — prima muchie cu axă L devine l1, a doua l2; la fel w1/w2. */
export function toParts(pieces: PieceInstance[]): Part[] {
  const out: Part[] = [];
  for (const pc of pieces) {
    const edges: PartEdges = {};
    for (const side of EDGE_SIDES) {
      const band = pc.edges[side];
      const axis = pc.edgeAxis[side];
      if (!band || !axis) continue;
      if (axis === 'L') {
        if (!edges.l1) edges.l1 = band;
        else edges.l2 = band;
      } else {
        if (!edges.w1) edges.w1 = band;
        else edges.w2 = band;
      }
    }
    const sig = (e: PartEdges) => `${e.l1 ?? ''}|${e.l2 ?? ''}|${e.w1 ?? ''}|${e.w2 ?? ''}`;
    const same = out.find(
      (q) => q.cabinetLabel === pc.cabinetLabel && q.name === pc.name
        && q.lengthMm === pc.lengthMm && q.widthMm === pc.widthMm
        && q.materialId === pc.materialId && sig(q.edges) === sig(edges),
    );
    if (same) same.qty += 1;
    else out.push({
      cabinetLabel: pc.cabinetLabel, name: pc.name,
      lengthMm: pc.lengthMm, widthMm: pc.widthMm, qty: 1,
      materialId: pc.materialId, edges,
      ...(pc.calc ? { calc: pc.calc } : {}),
    });
  }
  return out;
}
```

- [ ] **Step 5: Verifică** — `npx tsc --noEmit` și `npx vitest run` (nimic nu e încă legat; totul verde).

- [ ] **Step 6: Commit** — `git add lib/engine && git commit -m "feat(engine): tipuri PieceInstance/PiecesConfig + adaptor toParts"`

### Task 2: `expandCarcass` emite bucăți individuale + slotul de capac (plin/pazii/absent)

**Files:**
- Modify: `lib/engine/carcass.ts` (rescrie corpul lui `expandCarcass`)
- Modify: `lib/engine/templates.ts`
- Modify: `lib/engine/types.ts` (`ExpandedCabinet`)
- Test: `lib/engine/__tests__/carcass.test.ts` (adaptare asserts existente)

**Interfaces:**
- Consumes: `PieceInstance`, `toParts` (Task 1).
- Produces: `expandCarcass(input, catalogs, cc, legHeightMm?): { pieces: PieceInstance[]; warnings: Warning[] }`; chei: `laterala:0`, `laterala:1`, `blat-corp`, `fund-corp`, `pazie-fata`, `pazie-spate`, `polita:<i>`, `spate`. `ExpandedCabinet` capătă `pieces: PieceInstance[]` (în acest task doar carcasa; fronturile/sertarele intră la Task 3).

- [ ] **Step 1: Rescrie generarea din `expandCarcass`** — păstrează neschimbate calculele existente (sideH, panelDepth, panelW, calc-uri); înlocuiește array-ul `parts` cu `pieces`. Axele: laterală `{fata:'L', spate:'L', sus:'W', jos:'W'}`; blat/fund/poliță LR/pazie `{fata:'L', spate:'L', stanga:'W', dreapta:'W'}`; poliță FB `{fata:'W', spate:'W', stanga:'L', dreapta:'L'}`; spate `{sus:'L', jos:'L', stanga:'W', dreapta:'W'}` (spatele nu are cant default):

```ts
const SIDE_AXES_VERT: PieceInstance['edgeAxis'] = { fata: 'L', spate: 'L', sus: 'W', jos: 'W' };
const SIDE_AXES_HORIZ: PieceInstance['edgeAxis'] = { fata: 'L', spate: 'L', stanga: 'W', dreapta: 'W' };

const pieces: PieceInstance[] = [];
(['stânga', 'dreapta'] as const).forEach((pos, i) => {
  pieces.push({
    key: `laterala:${i}`, cabinetLabel: label,
    name: 'Laterală', label: `Laterală ${pos}`,
    lengthMm: sideH, widthMm: panelDepth, materialId: carcass.id,
    edges: { fata: fe }, edgeAxis: SIDE_AXES_VERT,
    calc: { length: sideHCalc, width: depthCalc },
  });
});

const topVariant = input.pieces?.top?.variant ?? 'PLIN';
if (topVariant === 'PLIN') {
  pieces.push({
    key: 'blat-corp', cabinetLabel: label, name: 'Blat corp', label: 'Blat corp',
    lengthMm: panelW(mountTop), widthMm: panelDepth, materialId: carcass.id,
    edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
    calc: { length: panelWCalc(mountTop), width: depthCalc },
  });
} else if (topVariant === 'PAZII') {
  const pazieW = input.pieces?.top?.pazieWidthMm ?? cc.pazieDefaultWidthMm;
  assertPositiveDim(pazieW, 'lățime pazie', label);
  const pazieCalc = {
    length: panelWCalc(mountTop),
    width: dim('Adâncime', [{ label: 'lățime pazie', valueMm: pazieW }]),
  };
  pieces.push(
    {
      key: 'pazie-fata', cabinetLabel: label, name: 'Pazie', label: 'Pazie față',
      lengthMm: panelW(mountTop), widthMm: pazieW, materialId: carcass.id,
      edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ, calc: pazieCalc,
    },
    {
      key: 'pazie-spate', cabinetLabel: label, name: 'Pazie', label: 'Pazie spate',
      lengthMm: panelW(mountTop), widthMm: pazieW, materialId: carcass.id,
      edges: {}, edgeAxis: SIDE_AXES_HORIZ, calc: pazieCalc,
    },
  );
} // ABSENT: nimic

pieces.push({
  key: 'fund-corp', cabinetLabel: label, name: 'Fund corp', label: 'Fund corp',
  lengthMm: panelW(mountBottom), widthMm: panelDepth, materialId: carcass.id,
  edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
  calc: { length: panelWCalc(mountBottom), width: depthCalc },
});
```

Polițele (păstrează calculele `shelfW`/`interiorCalc`/`shelfDepthCalc` existente):

```ts
for (let i = 0; i < input.shelves; i++) {
  if (input.shelf?.decorAxis === 'FB') {
    pieces.push({
      key: `polita:${i}`, cabinetLabel: label, name: 'Poliță', label: `Poliță ${i + 1}`,
      lengthMm: shelfW, widthMm: innerW, materialId: shelfMat.id,
      edges: { fata: fe },
      edgeAxis: { fata: 'W', spate: 'W', stanga: 'L', dreapta: 'L' },
      calc: { length: shelfDepthCalc, width: interiorCalc },
    });
  } else {
    pieces.push({
      key: `polita:${i}`, cabinetLabel: label, name: 'Poliță', label: `Poliță ${i + 1}`,
      lengthMm: innerW, widthMm: shelfW, materialId: shelfMat.id,
      edges: { fata: fe }, edgeAxis: SIDE_AXES_HORIZ,
      calc: { length: interiorCalc, width: shelfDepthCalc },
    });
  }
}
```

Spatele (păstrează calculele existente):

```ts
pieces.push({
  key: 'spate', cabinetLabel: label, name: 'Spate', label: 'Spate',
  lengthMm: /* ca azi */, widthMm: /* ca azi */, materialId: backMat.id,
  edges: {}, edgeAxis: { sus: 'W', jos: 'W', stanga: 'L', dreapta: 'L' },
  calc: /* ca azi */,
});
```

(Atenție la axe: spatele are lengthMm = înălțimea → stânga/dreapta merg pe lungime `'L'`, sus/jos pe lățime `'W'`.)

Returnează `{ pieces, warnings }`. Notă: dispare gruparea „Blat corp / Fund corp" qty 2 — CSV-ul va avea două rânduri de qty 1 în loc de unul cu qty 2 când montajele coincid (`toParts` nu le unește pentru că numele diferă) — acceptat.

- [ ] **Step 2: `templates.ts`** — în `expandCabinet`:

```ts
const carcass = input.type === 'BLAT' ? { pieces: [], warnings: [] } : expandCarcass(...);
// fronts/boxes rămân pe Part[] până la Task 3:
const pieces = [...carcass.pieces];
return {
  input,
  pieces,
  parts: [...toParts(pieces), ...fronts.parts, ...boxes.parts],
  hardware: hardware.suggestions,
  warnings: [...],
};
```

(verifică întâi dacă `expandCabinet` are ramură BLAT — tipul BLAT nu trece azi prin `expandCarcass`; dacă blatul e calculat separat în `computeBlat`, lasă cum e). `ExpandedCabinet` în types.ts:

```ts
export interface ExpandedCabinet {
  input: CabinetInput;
  pieces: PieceInstance[];
  parts: Part[];
  hardware: HardwareSuggestion[];
  warnings: Warning[];
}
```

- [ ] **Step 3: Adaptează `lib/engine/__tests__/carcass.test.ts`** — testele apelează `expandCarcass(...).parts`; înlocuiește cu `toParts(expandCarcass(...).pieces)` (import `toParts` din `../pieces`) ca assert-urile pe dimensiuni/qty/edges să rămână valabile. Unde se verifică `edges.l1`, valorile rămân identice prin mapare (`fata`→`l1`).

- [ ] **Step 4: Rulează** `npx tsc --noEmit && npx vitest run` — adaptează până e verde (se pot atinge și `integration.test.ts`/`needs.test.ts` dacă compară nume „Blat corp / Fund corp" — actualizează la numele noi).

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): expandCarcass emite bucăți individuale + slot capac plin/pazii/absent"`

### Task 3: `expandFronts` + `expandDrawerBoxes` emit bucăți individuale

**Files:**
- Modify: `lib/engine/fronts.ts`, `lib/engine/drawers.ts`, `lib/engine/templates.ts`
- Test: adaptare `lib/engine/__tests__/fronts.test.ts`, `cutlist.test.ts`, `costing.test.ts`, `needs.test.ts`, `integration.test.ts`, `lib/quote/__tests__/*` după caz

**Interfaces:**
- Produces: `expandFronts(...): { pieces: PieceInstance[]; fronts: FrontInfo[]; warnings: Warning[] }`; `expandDrawerBoxes(...): { pieces: PieceInstance[]; warnings: Warning[] }`. Chei: `panou-orb`, `usa:<i>`, `front-sertar:<i>`, `sertar:<i>:laterala:<0|1>`, `sertar:<i>:fata`, `sertar:<i>:spate`, `sertar:<i>:fund`.

- [ ] **Step 1: `fronts.ts`** — axe front (piesă verticală cu fața spre tine; lengthMm = înălțimea): `{ sus: 'W', jos: 'W', stanga: 'L', dreapta: 'L' }`. Perimetrul cu cant devine:

```ts
const FRONT_AXES: PieceInstance['edgeAxis'] = { sus: 'W', jos: 'W', stanga: 'L', dreapta: 'L' };
const perim = bandId
  ? { sus: bandId, jos: bandId, stanga: bandId, dreapta: bandId }
  : {};
```

Panou orb → o piesă `key:'panou-orb'`, `name:'Panou orb'`, `label:'Panou orb'`. Ușile — bucla existentă devine per bucată:

```ts
for (let i = 0; i < input.doors; i++) {
  pieces.push({
    key: `usa:${i}`, cabinetLabel: input.label, name: 'Ușă',
    label: input.doors > 1 ? `Ușă ${i + 1}` : 'Ușă',
    lengthMm: frontH, widthMm: doorW, materialId: material.id,
    edges: perim, edgeAxis: FRONT_AXES,
  });
  fronts.push({ kind: 'USA', widthMm: doorW, heightMm: frontH });
}
```

Fronturile de sertar: dispare gruparea pe înălțimi identice (o face `toParts`); per index:

```ts
adjusted.forEach((h, i) => {
  pieces.push({
    key: `front-sertar:${i}`, cabinetLabel: input.label, name: 'Front sertar',
    label: `Front sertar ${i + 1}`,
    lengthMm: h, widthMm: usableW, materialId: material.id,
    edges: perim, edgeAxis: FRONT_AXES,
  });
  fronts.push({ kind: 'SERTAR', widthMm: usableW, heightMm: h });
});
```

- [ ] **Step 2: `drawers.ts`** — dispare `push`-ul cu dedupe; per sertar `i` (cantul rămâne pe aceeași muchie fizică ca azi — latura lungă, semantic `sus` pentru laterale/fața-spatele cutiei):

```ts
const BOX_SIDE_AXES: PieceInstance['edgeAxis'] = { sus: 'L', jos: 'L', fata: 'W', spate: 'W' };
for (let j = 0; j < 2; j++) {
  pieces.push({
    key: `sertar:${i}:laterala:${j}`, cabinetLabel: input.label,
    name: 'Laterală sertar', label: `Sertar ${i + 1} · laterală ${j === 0 ? 'stânga' : 'dreapta'}`,
    lengthMm: nominalMm, widthMm: boxH, materialId: carcass.id,
    edges: { sus: fe }, edgeAxis: BOX_SIDE_AXES,
  });
}
(['fata', 'spate'] as const).forEach((pos) => {
  pieces.push({
    key: `sertar:${i}:${pos}`, cabinetLabel: input.label,
    name: 'Față/Spate cutie sertar', label: `Sertar ${i + 1} · ${pos === 'fata' ? 'față' : 'spate'} cutie`,
    lengthMm: boxInnerW, widthMm: boxH, materialId: carcass.id,
    edges: { sus: fe }, edgeAxis: { sus: 'L', jos: 'L', stanga: 'W', dreapta: 'W' },
  });
});
pieces.push({
  key: `sertar:${i}:fund`, cabinetLabel: input.label,
  name: 'Fund sertar', label: `Sertar ${i + 1} · fund`,
  lengthMm: nominalMm, widthMm: boxW, materialId: bottom.id,
  edges: {}, edgeAxis: SIDE_AXES_HORIZ_LIKE, // { fata:'L', spate:'L', stanga:'W', dreapta:'W' }
});
```

(bucla `for (const frontH of heights)` capătă index `i`.)

- [ ] **Step 3: `templates.ts`** — acum totul e pe pieces:

```ts
const pieces = [...carcass.pieces, ...fronts.pieces, ...boxes.pieces];
return { input, pieces, parts: toParts(pieces), hardware: ..., warnings: ... };
```

- [ ] **Step 4: Adaptează testele** — `fronts.test.ts` (`.parts` → `toParts(.pieces)`); verifică că `cutlist.test.ts`/`costing.test.ts`/`needs.test.ts`/`integration.test.ts` trec — regruparea `toParts` trebuie să producă aceleași rânduri ca azi la uși identice (qty 2) și fronturi de sertar cu înălțimi egale. Rulează `npx vitest run` și corectează.

- [ ] **Step 5: Commit** — `git commit -am "feat(engine): fronturi + cutii sertar ca bucăți individuale cu muchii semantice"`

### Task 4: Aplicarea `PiecesConfig` (override-uri, removed, piese libere)

**Files:**
- Modify: `lib/engine/pieces.ts` (adaugă `applyPiecesConfig`)
- Modify: `lib/engine/templates.ts`
- Modify: `lib/engine/index.ts` (export)
- Test: adaptare minimă dacă tsc o cere

**Interfaces:**
- Consumes: `PiecesConfig`, `PieceInstance`, `Catalogs`.
- Produces: `applyPiecesConfig(pieces: PieceInstance[], cfg: PiecesConfig | undefined, catalogs: Catalogs, cabinetLabel: string): PieceInstance[]` — apelat din `expandCabinet` DUPĂ asamblare, ÎNAINTE de `toParts`.

- [ ] **Step 1: Implementare în `pieces.ts`:**

```ts
import type { Catalogs, EdgeSide, PiecesConfig } from './types';

function assertBand(catalogs: Catalogs, id: string) {
  if (!catalogs.edgeBands.some((b) => b.id === id)) {
    throw new Error(`Cant inexistent în catalog: ${id}`);
  }
}

/** Aplică abaterile utilizatorului: canturi/material/dimensiuni/eliminare per bucată
 *  + piesele libere. Cheile care nu mai există se ignoră silențios. */
export function applyPiecesConfig(
  pieces: PieceInstance[],
  cfg: PiecesConfig | undefined,
  catalogs: Catalogs,
  cabinetLabel: string,
): PieceInstance[] {
  if (!cfg) return pieces;
  const out: PieceInstance[] = [];
  for (const pc of pieces) {
    const ov = cfg.overrides?.[pc.key];
    if (!ov) { out.push(pc); continue; }
    if (ov.removed) continue;
    const next: PieceInstance = { ...pc, edges: { ...pc.edges }, manual: { ...pc.manual } };
    if (ov.edges) {
      const touched: EdgeSide[] = [];
      for (const [side, band] of Object.entries(ov.edges) as [EdgeSide, string | null][]) {
        if (next.edgeAxis[side] === undefined) continue; // latură neaplicabilă piesei
        if (band === null) delete next.edges[side];
        else { assertBand(catalogs, band); next.edges[side] = band; }
        touched.push(side);
      }
      if (touched.length > 0) next.manual = { ...next.manual, edges: touched };
    }
    if (ov.materialId) {
      if (!catalogs.materials.some((m) => m.id === ov.materialId)) {
        throw new Error(`Material inexistent în catalog: ${ov.materialId}`);
      }
      next.materialId = ov.materialId;
      next.manual = { ...next.manual, material: true };
    }
    if (ov.lengthMm !== undefined) {
      if (ov.lengthMm <= 0) throw new Error(`Corpul ${cabinetLabel}: lungime manuală imposibilă (${ov.lengthMm}mm)`);
      next.lengthMm = ov.lengthMm;
      next.manual = { ...next.manual, lengthMm: true };
      delete next.calc; // formula nu mai descrie valoarea manuală
    }
    if (ov.widthMm !== undefined) {
      if (ov.widthMm <= 0) throw new Error(`Corpul ${cabinetLabel}: lățime manuală imposibilă (${ov.widthMm}mm)`);
      next.widthMm = ov.widthMm;
      next.manual = { ...next.manual, widthMm: true };
      delete next.calc;
    }
    out.push(next);
  }
  for (const fp of cfg.free ?? []) {
    if (!catalogs.materials.some((m) => m.id === fp.materialId)) {
      throw new Error(`Material inexistent în catalog: ${fp.materialId}`);
    }
    const edges: PieceInstance['edges'] = {};
    for (const [side, band] of Object.entries(fp.edges ?? {}) as [EdgeSide, string | null][]) {
      if (band) { assertBand(catalogs, band); edges[side] = band; }
    }
    for (let i = 0; i < Math.max(1, Math.trunc(fp.qty)); i++) {
      out.push({
        key: `libera:${fp.id}${fp.qty > 1 ? `:${i}` : ''}`,
        cabinetLabel, name: fp.name,
        label: fp.qty > 1 ? `${fp.name} ${i + 1}` : fp.name,
        lengthMm: fp.lengthMm, widthMm: fp.widthMm, materialId: fp.materialId,
        edges, edgeAxis: { fata: 'L', spate: 'L', stanga: 'W', dreapta: 'W' },
        free: true,
      });
    }
  }
  return out;
}
```

Notă: dimensiunile manuale șterg `calc` (formula ar minți); UI-ul arată valoarea + marcajul „manual".

- [ ] **Step 2: `templates.ts`** — între asamblare și return:

```ts
const assembled = [...carcass.pieces, ...fronts.pieces, ...boxes.pieces];
const pieces = applyPiecesConfig(assembled, input.pieces, catalogs, input.label);
```

- [ ] **Step 3: `index.ts`** — adaugă la exporturi: `export { toParts, applyPiecesConfig } from './pieces';` (tipurile ies prin `export * from './types'`).

- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run` verde. **Commit:** `git commit -am "feat(engine): applyPiecesConfig — override-uri per bucată + piese libere"`

### Task 5: Plasarea 3D (`lib/engine/placement.ts`)

**Files:**
- Create: `lib/engine/placement.ts`
- Modify: `lib/engine/templates.ts`, `lib/engine/index.ts`
- Test: doar dacă tsc/vitest o cer

**Interfaces:**
- Consumes: `PieceInstance`, `CabinetInput`, `Catalogs`, `ConstructionConstants`, `drawerFrontHeights` (din `./fronts`), `pickSlideNominal` (din `./drawers`), `findMaterial`, `LEGGED_TYPES`.
- Produces: `assignPlacements(pieces: PieceInstance[], input: CabinetInput, catalogs: Catalogs, cc: ConstructionConstants, legHeightMm?: number): void` — atașează `placement` pe bucățile cu poziție semantică; piesele libere și tipul BLAT rămân fără.

- [ ] **Step 1: Implementare.** Sistem de coordonate: vezi `PiecePlacement` (Task 1). Grosimea piesei = `thicknessMm` al materialului EI (respectă override-ul de material). Nu recalcula dimensiuni — folosește `pc.lengthMm/widthMm` (respectă override-urile), doar pozițiile vin din formulele de mai jos:

```ts
import { LEGGED_TYPES } from './constants';
import { findMaterial } from './carcass';
import { drawerFrontHeights } from './fronts';
import { pickSlideNominal } from './drawers';
import { FRONT_THICKNESS_MM } from './costing';
import type { CabinetInput, Catalogs, ConstructionConstants, PieceInstance } from './types';

export function assignPlacements(
  pieces: PieceInstance[], input: CabinetInput, catalogs: Catalogs,
  cc: ConstructionConstants, legHeightMm?: number,
): void {
  if (input.type === 'BLAT') return;
  const { widthMm: W, heightMm: H, depthMm: D } = input;
  const t = findMaterial(catalogs, input.carcassMaterialId).thicknessMm;
  const legDeduct = legHeightMm && LEGGED_TYPES.has(input.type) ? legHeightMm : 0;
  const carcassH = H - legDeduct;
  const mountTop = input.mount?.top ?? 'INCADRAT';
  const mountBottom = input.mount?.bottom ?? 'INCADRAT';
  const aplicatBottom = mountBottom === 'APLICAT' ? t : 0;
  const backMat = input.back.enabled && input.back.materialId
    ? findMaterial(catalogs, input.back.materialId) : null;
  const hasPfl = backMat?.kind === 'PFL';
  const zBack = (hasPfl ? backMat!.thicknessMm : 0) + (hasPfl ? cc.screwAllowanceMm : 0);
  const g = cc.outerGapMm;
  const thick = (pc: PieceInstance) => findMaterial(catalogs, pc.materialId).thicknessMm;

  // geometria fronturilor (aceeași logică ca lib/iso/geometry.ts, redusă la poziții)
  const isVopsit = input.frontKind === 'MDF_VOPSIT' && !!input.mdfFront;
  const hasFronts = (input.frontMaterialId !== null || isVopsit)
    && (input.doors > 0 || (input.drawers?.count ?? 0) > 0);
  const blindW = input.type === 'COLT' && hasFronts
    ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const frontX0 = g + blindW;
  const isGola = input.handle?.type === 'GOLA';
  const frontTopY = carcassH - g - (isGola ? cc.golaFrontDeductMm : 0);

  for (const pc of pieces) {
    const th = thick(pc);
    switch (true) {
      case pc.key === 'laterala:0':
        pc.placement = { x: 0, y: aplicatBottom, z: zBack, w: th, h: pc.lengthMm, d: pc.widthMm };
        break;
      case pc.key === 'laterala:1':
        pc.placement = { x: W - th, y: aplicatBottom, z: zBack, w: th, h: pc.lengthMm, d: pc.widthMm };
        break;
      case pc.key === 'blat-corp':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'pazie-fata':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: D - pc.widthMm,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'pazie-spate':
        pc.placement = {
          x: mountTop === 'APLICAT' ? 0 : t, y: carcassH - th, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case pc.key === 'fund-corp':
        pc.placement = {
          x: mountBottom === 'APLICAT' ? 0 : t, y: 0, z: zBack,
          w: pc.lengthMm, h: th, d: pc.widthMm,
        };
        break;
      case /^polita:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        const n = input.shelves;
        const isFB = input.shelf?.decorAxis === 'FB';
        pc.placement = {
          x: t, y: (carcassH * (i + 1)) / (n + 1), z: zBack,
          w: isFB ? pc.widthMm : pc.lengthMm, h: th, d: isFB ? pc.lengthMm : pc.widthMm,
        };
        break;
      }
      case pc.key === 'spate':
        pc.placement = {
          x: (W - pc.widthMm) / 2, y: 0, z: 0,
          w: pc.widthMm, h: pc.lengthMm, d: th,
        };
        break;
      case pc.key === 'panou-orb':
        pc.placement = { x: g, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
        break;
      case /^usa:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        pc.placement = {
          x: frontX0 + i * (pc.widthMm + cc.frontGapMm),
          y: frontTopY - pc.lengthMm, z: D,
          w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM,
        };
        break;
      }
      case /^front-sertar:\d+$/.test(pc.key): {
        const i = Number(pc.key.split(':')[1]);
        const heights = drawerFrontHeights(input, cc);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        if (isGola) topY -= cc.golaFrontDeductMm; // profilul fiecărui sertar e deasupra frontului
        pc.placement = {
          x: frontX0, y: topY - pc.lengthMm, z: D,
          w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM,
        };
        break;
      }
      case pc.key.startsWith('sertar:'): {
        const i = Number(pc.key.split(':')[1]);
        const heights = drawerFrontHeights(input, cc);
        let topY = carcassH - g;
        for (let k = 0; k < i; k++) topY -= heights[k] + cc.frontGapMm;
        const boxBottom = Math.max(0, topY - heights[i] + 20); // cutia stă pe glisieră, aproximativ
        const { nominalMm } = pickSlideNominal(D, cc);
        const part = pc.key.split(':')[2];
        if (part === 'laterala') {
          const j = Number(pc.key.split(':')[3]);
          const x = j === 0 ? t + cc.palBoxSlideAllowanceMm / 2 : W - t - cc.palBoxSlideAllowanceMm / 2 - th;
          pc.placement = { x, y: boxBottom, z: D - nominalMm, w: th, h: pc.widthMm, d: pc.lengthMm };
        } else if (part === 'fata' || part === 'spate') {
          pc.placement = {
            x: t + cc.palBoxSlideAllowanceMm / 2 + th, y: boxBottom,
            z: part === 'fata' ? D - th : D - nominalMm,
            w: pc.lengthMm, h: pc.widthMm, d: th,
          };
        } else { // fund
          pc.placement = {
            x: t + cc.palBoxSlideAllowanceMm / 2, y: boxBottom, z: D - nominalMm,
            w: pc.widthMm, h: th, d: pc.lengthMm,
          };
        }
        break;
      }
      // piese libere: fără placement
    }
  }
}
```

- [ ] **Step 2: `templates.ts`** — după `applyPiecesConfig`: `assignPlacements(pieces, input, catalogs, cc, legHeightMm);`. `index.ts`: `export { assignPlacements } from './placement';`.

- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run` verde. **Commit:** `git commit -am "feat(engine): plasare 3D per bucată (placement.ts)"`

### Task 6: Persistența — schema zod + round-trip prin formular

**Files:**
- Modify: `lib/quote/cabinet-form.ts`
- Modify: `lib/quote/actions.ts` (`updateCabinetData`)
- Test: `lib/quote/__tests__/compute.test.ts` doar dacă tsc o cere

**Interfaces:**
- Produces: `piecesConfigSchema` (zod, exportat), `toCabinetInput(d, pieces?)` cu al doilea parametru opțional `PiecesConfig`. Serverul acceptă `data.piecesJson` (string JSON) în `updateCabinetData`, ca `hardwareAdjustmentsJson`.

- [ ] **Step 1: `cabinet-form.ts`** — sub `extraPartSchema`:

```ts
const edgeSideEnum = z.enum(['fata', 'spate', 'sus', 'jos', 'stanga', 'dreapta']);
const edgeOverrides = z.record(edgeSideEnum, z.string().nullable());

export const piecesConfigSchema = z.object({
  top: z.object({
    variant: z.enum(['PLIN', 'PAZII', 'ABSENT']),
    pazieWidthMm: posNum.optional(),
  }).optional(),
  overrides: z.record(z.string(), z.object({
    edges: edgeOverrides.optional(),
    materialId: z.string().optional(),
    lengthMm: posNum.optional(),
    widthMm: posNum.optional(),
    removed: z.boolean().optional(),
  })).optional(),
  free: z.array(z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    lengthMm: posNum,
    widthMm: posNum,
    qty: z.coerce.number().int().min(1),
    materialId: z.string().min(1),
    edges: edgeOverrides.optional(),
  })).optional(),
});
export type PiecesConfigForm = z.infer<typeof piecesConfigSchema>;

/** Config gol (fără abateri) → undefined, ca inputJson să rămână curat. */
export function prunePiecesConfig(cfg: PiecesConfigForm | undefined): PiecesConfigForm | undefined {
  if (!cfg) return undefined;
  const overrides = Object.fromEntries(
    Object.entries(cfg.overrides ?? {}).filter(([, ov]) =>
      ov.removed || ov.materialId || ov.lengthMm !== undefined || ov.widthMm !== undefined
      || Object.keys(ov.edges ?? {}).length > 0),
  );
  const out: PiecesConfigForm = {
    ...(cfg.top && cfg.top.variant !== 'PLIN' ? { top: cfg.top } : {}),
    ...(Object.keys(overrides).length > 0 ? { overrides } : {}),
    ...((cfg.free?.length ?? 0) > 0 ? { free: cfg.free } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}
```

`toCabinetInput` primește parametrul: `export function toCabinetInput(d: CabinetFormData, pieces?: PiecesConfigForm): CabinetInput` și în obiectul returnat: `...(pieces ? { pieces: pieces as CabinetInput['pieces'] } : {}),`.

- [ ] **Step 2: `actions.ts`** — în `updateCabinetData`, după parse-ul formularului:

```ts
const pieces = data.piecesJson !== undefined && data.piecesJson !== ''
  ? prunePiecesConfig(piecesConfigSchema.parse(JSON.parse(data.piecesJson)))
  : undefined;
const input = toCabinetInput(d, pieces);
```

(importă `piecesConfigSchema, prunePiecesConfig` din `./cabinet-form`.)

- [ ] **Step 3: Gate Faza 1** — `npx tsc --noEmit && npx vitest run && rm -rf .next && npm run build` toate verzi. **Commit:** `git commit -am "feat(quote): PiecesConfig prin formular (piecesJson) + schema zod"`

---

## Faza 2 — UI: bottom sheet + 3D + panou

### Task 7: Dependințe 3D + scheletul bottom sheet-ului integrat în editor

**Files:**
- Modify: `package.json` (deps noi)
- Create: `components/configurator/ConfiguratorSheet.tsx`
- Modify: `components/CabinetEditorForm.tsx`

**Interfaces:**
- Produces: `<ConfiguratorSheet pieces={PieceInstance[]} materials={...} edgeBands={...} cfg={PiecesConfigForm} onCfgChange={(next) => void} corpLabel={string} />` — componentă client cu stare `open`, peek bar + overlay full-screen cu 3 zone (deocamdată placeholder pe zona 3D și panou; lista vine la Task 8). `CabinetEditorForm` ține `const [piecesCfg, setPiecesCfg] = useState<PiecesConfigForm>(...)`, îl bagă în `toCabinetInput(parsed.data, piecesCfg)` din memo-ul `live` și în submit: `save({ ...values, hardwareAdjustmentsJson: ..., piecesJson: JSON.stringify(piecesCfg ?? {}) })`.

- [ ] **Step 1:** `npm i three @react-three/fiber @react-three/drei && npm i -D @types/three`

- [ ] **Step 2: `ConfiguratorSheet.tsx`** — schelet:

```tsx
'use client';
import { useEffect, useState } from 'react';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';

export interface ConfiguratorCatalogItem { id: string; name: string; thicknessMm?: number; kind?: string }

export function ConfiguratorSheet(props: {
  corpLabel: string;
  pieces: PieceInstance[];
  materials: ConfiguratorCatalogItem[];
  edgeBands: ConfiguratorCatalogItem[];
  cfg: PiecesConfigForm;
  onCfgChange: (next: PiecesConfigForm) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const overrideCount = Object.keys(props.cfg.overrides ?? {}).length
    + (props.cfg.free?.length ?? 0)
    + (props.cfg.top && props.cfg.top.variant !== 'PLIN' ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent-blue bg-card/95 px-6 py-2 text-left shadow-lg backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1340px] items-center gap-3">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/40" />
          <span className="text-sm font-bold">Configurator piese · {props.corpLabel}</span>
          <span className="text-xs text-muted-foreground">
            {props.pieces.length} piese{overrideCount > 0 ? ` · ${overrideCount} cu modificări` : ''} · click pentru deschidere ↑
          </span>
        </div>
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-6 py-2">
        <span className="text-sm font-bold">Configurator piese · {props.corpLabel}</span>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">Închide ✕</button>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_360px]">
        <div className="overflow-y-auto border-r border-border p-3">{/* Task 8: PieceList */}</div>
        <div className="relative">{/* Task 9: Scene3D */}</div>
        <div className="overflow-y-auto border-l border-border p-4">{/* Task 10: PiecePanel */}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrarea în `CabinetEditorForm.tsx`:**
  - Props noi în `CabinetEditorFormProps`: `initialPieces?: PiecesConfigForm` (pagina corpului îl citește din `input.pieces` — modifică `app/proiecte/[id]/corp/[cabinetId]/page.tsx` să paseze `initialPieces={input.pieces}`).
  - Stare: `const [piecesCfg, setPiecesCfg] = useState<PiecesConfigForm>(initialPieces ?? {});`
  - În memo-ul `live` (linia ~275): `toCabinetInput(parsed.data, prunePiecesConfig(piecesCfg))` + adaugă `piecesCfg` la dependențe; expune `pieces: expanded.pieces` în obiectul returnat.
  - În submit (linia ~367): `await save({ ...values, hardwareAdjustmentsJson: JSON.stringify(hw), piecesJson: JSON.stringify(prunePiecesConfig(piecesCfg) ?? {}) })`.
  - Randare, la finalul return-ului (frate cu formularul): `{live && !live.expandError && <ConfiguratorSheet corpLabel={values.label || 'corp'} pieces={live.pieces} materials={...} edgeBands={snapshot.edgeBands} cfg={piecesCfg} onCfgChange={setPiecesCfg} />}` + un `pb-16` pe container ca peek-ul să nu acopere conținutul.

- [ ] **Step 4:** `npx tsc --noEmit` verde; verifică în browserul de dev (serverul utilizatorului) că peek-ul apare și sheet-ul se deschide/închide. **Commit:** `git commit -am "feat(ui): schelet ConfiguratorSheet (peek + full-screen) în editorul corpului"`

### Task 8: Lista pieselor (zona stângă)

**Files:**
- Create: `components/configurator/PieceList.tsx`
- Modify: `components/configurator/ConfiguratorSheet.tsx`

**Interfaces:**
- Produces: `<PieceList pieces cfg selectedKey onSelect(key) onAddFree() />` — rând per bucată: `label`, `L×l`, punct albastru dacă `manual` există sau cheia are override; rând „eliminat" (opacity + „↺" restaurare via `onRestore(key)`); buton „+ piesă liberă". Selecția vine din starea `selectedKey` a sheet-ului.

- [ ] **Step 1: `PieceList.tsx`:**

```tsx
'use client';
import type { PieceInstance } from '@/lib/engine';
import type { PiecesConfigForm } from '@/lib/quote/cabinet-form';

const fmt = (n: number) => String(Math.round(n * 10) / 10);

export function PieceList(props: {
  pieces: PieceInstance[];
  cfg: PiecesConfigForm;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onRestore: (key: string) => void;
  onAddFree: () => void;
}) {
  const removed = Object.entries(props.cfg.overrides ?? {})
    .filter(([, ov]) => ov.removed).map(([k]) => k);
  return (
    <div className="space-y-0.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Piese</div>
      {props.pieces.map((pc) => (
        <button
          key={pc.key} type="button" onClick={() => props.onSelect(pc.key)}
          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${props.selectedKey === pc.key ? 'bg-accent-blue/10 ring-1 ring-accent-blue' : ''}`}
        >
          <span className="flex items-center gap-1.5">
            {(pc.manual && Object.keys(pc.manual).length > 0) && <span className="h-1.5 w-1.5 rounded-full bg-accent-blue" />}
            {pc.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{fmt(pc.lengthMm)}×{fmt(pc.widthMm)}</span>
        </button>
      ))}
      {removed.map((key) => (
        <div key={key} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-muted-foreground opacity-60">
          <span className="line-through">{key}</span>
          <button type="button" className="text-accent-blue" onClick={() => props.onRestore(key)}>↺</button>
        </div>
      ))}
      <button type="button" onClick={props.onAddFree}
        className="mt-2 w-full rounded border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
        ＋ Piesă liberă
      </button>
    </div>
  );
}
```

- [ ] **Step 2:** montează în `ConfiguratorSheet` (zona stângă): `onRestore` șterge override-ul: `onCfgChange({ ...cfg, overrides: omit(cfg.overrides, key) })` (scrie helperul `omit` local: `const omit = (o, k) => { const { [k]: _, ...rest } = o ?? {}; return rest; }`); `onAddFree` deschide panoul în modul „piesă liberă nouă" (stare `addingFree: boolean` în sheet — formularul propriu-zis la Task 10).

- [ ] **Step 3:** verificare vizuală în dev + `npx tsc --noEmit`. **Commit:** `git commit -am "feat(ui): PieceList — lista bucăților cu selecție și restaurare"`

### Task 9: Viewport-ul 3D (react-three-fiber)

**Files:**
- Create: `components/configurator/Scene3D.tsx`
- Modify: `components/configurator/ConfiguratorSheet.tsx`

**Interfaces:**
- Consumes: `PieceInstance.placement` (Task 5).
- Produces: `<Scene3D pieces selectedKey onSelect(key|null) />` — importat cu `next/dynamic` (`ssr: false`) în ConfiguratorSheet. Click pe piesă selectează; click pe fundal deselectează; piesa selectată e albastră cu cote „L × l × g" într-un `Html` deasupra ei.

- [ ] **Step 1: `Scene3D.tsx`:**

```tsx
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
```

- [ ] **Step 2: în `ConfiguratorSheet`:** `const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Se încarcă 3D…</div> });` (import `dynamic` din `next/dynamic`, declarat LA NIVEL DE MODUL, nu în componentă). `materialKindById` construit din props.materials.

- [ ] **Step 3:** verificare în dev: corpul se randează, rotire/zoom OK, click selectează + cote vizibile, click pe gol deselectează. `npx tsc --noEmit`. **Commit:** `git commit -am "feat(ui): Scene3D — viewport react-three-fiber cu selecție și cote"`

### Task 10: Panoul de configurare (zona dreaptă)

**Files:**
- Create: `components/configurator/PiecePanel.tsx`
- Modify: `components/configurator/ConfiguratorSheet.tsx`

**Interfaces:**
- Consumes: `PieceInstance` selectat, `cfg`, cataloagele.
- Produces: `<PiecePanel piece cfg onCfgChange materials edgeBands topSlot />`. Editările scriu DOAR abateri în `cfg.overrides[piece.key]` / `cfg.top`; ștergerea unei abateri readuce automatul (motorul recalculează prin memo-ul `live`).

- [ ] **Step 1: `PiecePanel.tsx`** — secțiuni:
  1. **Antet:** `piece.label` + dacă `piece.free` un buton „Șterge piesa" (scoate din `cfg.free`).
  2. **Slot capac** (doar când `piece.key` e `blat-corp`/`pazie-fata`/`pazie-spate` sau nu există selecție și corpul are slotul): `SegmentedControl` cu `PLIN | PAZII | ABSENT` → `cfg.top = { variant }`; la `PAZII` un input „Lățime pazie (mm)" → `pazieWidthMm` (gol = default 100).
  3. **Material:** select cu materialele active; valoare = `cfg.overrides[key]?.materialId ?? ''` (gol = automat, arată numele materialului curent ca primă opțiune „Automat — {nume}").
  4. **Canturi pe muchii:** pentru fiecare `side` din `Object.keys(piece.edgeAxis)` (exact cele 4 aplicabile), un select cu: „Automat — {nume sau —}" (value `''`), „Fără cant" (value `'null'`), plus fiecare cant din catalog. La schimbare: `''` → șterge `edges[side]` din override; `'null'` → `edges[side] = null`; altfel `edges[side] = id`.
  5. **Dimensiuni:** două inputuri numerice (Lungime/Lățime) cu `placeholder` = valoarea curentă calculată și `value` = override-ul dacă există; sub ele, dacă `piece.calc` există, formula desfăcută (refolosește helperul `fmtDimCalc` — mută-l din `CabinetEditorForm.tsx` în `lib/quote/format.ts` DOAR dacă e exportabil ușor; altfel duplică 5 liniile local cu un comentariu). Buton „↺ auto" per câmp când override există.
  6. **Sugestii (chips):**
     - „ABS 0,4 peste tot" → setează toate laturile aplicabile la cantul cu `thicknessMm` minim din catalog;
     - „2 mm pe față" → `edges.fata` (sau `sus` la fronturi) = cantul cu `|thicknessMm − 2|` minim;
     - „Fără cant" → toate laturile `null`;
     - „Elimină piesa" → `removed: true` (cu excepția pieselor libere, care se șterg direct).
  7. **Piesă liberă nouă** (modul `addingFree` din sheet): inputuri nume/L/l/buc/material + „Adaugă" → `cfg.free.push({ id: crypto.randomUUID(), ... })`.

Helper central în ConfiguratorSheet, pasat în jos:

```tsx
const setOverride = (key: string, patch: Partial<PieceOverride>) => {
  props.onCfgChange({
    ...props.cfg,
    overrides: { ...props.cfg.overrides, [key]: { ...props.cfg.overrides?.[key], ...patch } },
  });
};
```

(la ștergerea unei chei din `edges`/override gol, curăță obiectul — `prunePiecesConfig` de la Task 6 face curățenia finală la submit oricum.)

- [ ] **Step 2:** leagă totul în `ConfiguratorSheet` (selectedKey → piesa din `props.pieces`), verifică fluxul end-to-end în dev: schimbi cantul pe „Laterală dreapta" față → ABS 2 → lista de piese + tabelul „Piese generate" + estimarea de preț se actualizează live; capac → PAZII → apar 2 pazii în 3D; elimină o poliță → dispare din 3D și cutlist.

- [ ] **Step 3:** `npx tsc --noEmit`. **Commit:** `git commit -am "feat(ui): PiecePanel — canturi per muchie, material, dimensiuni, sugestii, slot capac"`

### Task 11: Round-trip complet + gate final

**Files:**
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (pasează `initialPieces`)
- Modify: ce mai iese la iveală din smoke

- [ ] **Step 1:** în pagina corpului: `initialPieces={input.pieces}` pe `CabinetEditorForm` (inputul e deja normalizat acolo).

- [ ] **Step 2: Smoke manual pe serverul de dev al utilizatorului** (NU porni alt server dacă :3000/:3002 răspunde; folosește argent conform `argent-test-ui-flow` — atenție la `window.confirm` din DeleteButton, se acceptă prin CDP):
  1. Deschide un corp de bază cu uși + polițe → peek-ul apare jos.
  2. Deschide sheet-ul → 3 zone, corpul în 3D.
  3. Click „Laterală dreapta" → față = ABS 2; „Blat corp" → slot PAZII, lățime 100.
  4. Adaugă piesă liberă „Rigidizare" 500×80, PAL, 1 buc.
  5. Salvează → reintră în corp → toate abaterile persistă (piesele + 3D identice).
  6. Verifică tabelul „Piese generate": pazii prezente, blat absent; CSV-ul de debitare al proiectului reflectă canturile noi.
  7. Elimină o poliță → dispare; „↺" o readuce.
- [ ] **Step 3: Gate final:** `npx tsc --noEmit && npx vitest run && rm -rf .next && npm run build` — toate verzi.
- [ ] **Step 4: Commit final** — `git commit -am "feat: configurator piese 3D — round-trip complet"`. NU merge în main fără OK-ul lui Andrew (criteriul lui de validare: comparația cu oferta manuală reală e încă deschisă).

---

## Self-review (rulat la scriere)

- **Acoperire spec:** modelul de date (T1), bucăți+chei (T2–T3), pazii (T2), override-uri+piese libere (T4), placement (T5), persistență fără migrare (T6), bottom sheet peek/full (T7), listă (T8), 3D+cote (T9), panou+sugestii+dimensiuni manuale (T10), smoke pe cazurile din intrebari.md (T11). Neacoperit intenționat (backlog, conform spec): retragere poliță configurabilă ca setare globală, suport ventuză (feronerie), drag fizic pe peek (click e suficient în v1).
- **Tipuri consistente:** `PieceInstance.label` vs `name` folosite consecvent; `piecesConfigSchema` oglindește `PiecesConfig`; `toCabinetInput(d, pieces?)` în T6/T7.
- **Fără placeholders:** pseudo-citările „ca azi" din T2 se referă explicit la valorile existente păstrate din `carcass.ts` (citite de implementator din fișier la locul indicat).

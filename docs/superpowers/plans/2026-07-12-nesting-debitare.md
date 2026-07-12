# Nesting Debitare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Numărul real de plăci per material (nesting guillotine pe rafturi) în loc de euristica yieldFactor, plus pagină vizuală „Plan debitare" cu plăcile desenate în SVG.

**Architecture:** Algoritm pur `nestParts` în `lib/engine/nesting.ts` (shelf First-Fit Decreasing, fără rotație — lungimea piesei mereu pe lungimea plăcii). `computeMaterialNeeds` îl folosește pentru materialele `PER_SHEET` (înlocuiește yieldFactor); `BoardNeed` capătă `wastePct` și `layout` pentru pagina vizuală. Kerf + margine de curățare sunt setări noi în `AppSettings`, curg prin snapshot → `computeQuote`. Pagina `plan-debitare` randează SVG server-side, printabilă ca oferta.

**Tech Stack:** TypeScript pur în motor, Vitest, Prisma 6 + SQLite, Next.js 15 App Router, shadcn/ui, SVG inline.

**Spec:** `docs/superpowers/specs/2026-07-12-nesting-debitare-design.md`

## Global Constraints

- **Fără teste UI** (directivă utilizator 2026-07-12) — doar logica pură primește teste; UI = build + smoke.
- **Nu omorî procesul `next dev` al utilizatorului de pe :3000.** Build de producție DOAR în Task 7, cu `rm -rf .next` întâi (dev și build împart `.next`).
- Fără rotația pieselor: lungimea piesei e mereu paralelă cu lungimea plăcii.
- Nesting DOAR pentru `pricing.mode === 'PER_SHEET'`; `PER_SQM` rămâne pe arie.
- Default-uri: kerf 4 mm, margine de curățare (trim) 10 mm per latură.
- `yieldFactor` rămâne DOAR pentru estimarea orientativă per corp (`lib/quote/estimate.ts`) — dispare din `computeCosts`/`computeMaterialNeeds`/`QuoteInput`.
- Unități: mm în motor; copy UI în română; identificatori în engleză; comentarii în stilul existent (română, doar unde codul nu se explică singur).
- Pierderea % se calculează pe aria plăcii ÎNTREGI (aia se plătește), nu pe aria utilă.
- Commit după fiecare task; mesaje `feat:`/`chore:` ca în istoric.

---

### Task 1: `nestParts` — plasare pe o singură placă

**Files:**
- Create: `lib/engine/nesting.ts`
- Test: `lib/engine/__tests__/nesting.test.ts`

**Interfaces:**
- Produces (folosite de Task 2, 3, 5, 6):

```ts
export interface NestParams { kerfMm: number; trimMm: number }
export interface NestPiece { label: string; lengthMm: number; widthMm: number }
export interface PlacedPiece extends NestPiece { x: number; y: number } // colț stânga-sus, mm de la marginea plăcii
export interface SheetLayout { pieces: PlacedPiece[] }
export interface NestResult { sheets: SheetLayout[]; wastePct: number }
export const DEFAULT_NEST_PARAMS: NestParams = { kerfMm: 4, trimMm: 10 };
export function nestParts(pieces: NestPiece[], sheetLengthMm: number, sheetWidthMm: number, params: NestParams): NestResult
```

Convenție axe: `x` de-a lungul LUNGIMII plăcii (piesa ocupă `lengthMm` pe x), `y` de-a lungul LĂȚIMII (piesa ocupă `widthMm` pe y).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/engine/__tests__/nesting.test.ts
import { describe, expect, it } from 'vitest';
import { nestParts, type NestPiece } from '../nesting';

// Placă de test 1000×500, trim 10, kerf 4 → arie utilă 980×480.
const P = { kerfMm: 4, trimMm: 10 };
const piece = (label: string, lengthMm: number, widthMm: number): NestPiece =>
  ({ label, lengthMm, widthMm });

describe('nestParts — plasare pe o placă', () => {
  it('două piese pe același raft, cu kerf între ele și trim la margini', () => {
    const r = nestParts([piece('A', 488, 480), piece('B', 488, 480)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    expect(r.sheets[0].pieces).toEqual([
      { label: 'A', lengthMm: 488, widthMm: 480, x: 10, y: 10 },
      { label: 'B', lengthMm: 488, widthMm: 480, x: 502, y: 10 }, // 10 + 488 + 4
    ]);
  });

  it('raft nou sub primul, cu kerf între rafturi', () => {
    const r = nestParts([piece('A', 980, 238), piece('B', 980, 238)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    expect(r.sheets[0].pieces).toEqual([
      { label: 'A', lengthMm: 980, widthMm: 238, x: 10, y: 10 },
      { label: 'B', lengthMm: 980, widthMm: 238, x: 10, y: 252 }, // 10 + 238 + 4
    ]);
  });

  it('sortare FFD: piesa mai lată deschide primul raft, cea îngustă intră după', () => {
    // dată în ordine inversă — sortarea descrescătoare după lățime o pune pe cea de 400 prima
    const r = nestParts([piece('mic', 300, 100), piece('mare', 500, 400)], 1000, 500, P);
    expect(r.sheets).toHaveLength(1);
    const mare = r.sheets[0].pieces.find((p) => p.label === 'mare')!;
    const mic = r.sheets[0].pieces.find((p) => p.label === 'mic')!;
    expect(mare).toMatchObject({ x: 10, y: 10 });
    expect(mic).toMatchObject({ x: 514, y: 10 }); // pe același raft: 10 + 500 + 4
  });

  it('fără rotație: piesă 480×700 (lungime < lățime) NU se rotește ca să încapă', () => {
    // 480 ≤ 980 pe lungime, dar 700 > 480 pe lățime → nu încape, deși rotită ar încăpea
    expect(() => nestParts([piece('X', 480, 700)], 1000, 500, P)).toThrow(/X/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/engine/__tests__/nesting.test.ts`
Expected: FAIL — `Cannot find module '../nesting'` (sau echivalent).

- [ ] **Step 3: Write the implementation**

```ts
// lib/engine/nesting.ts
// Nesting guillotine pe rafturi (shelf First-Fit Decreasing), fără rotație:
// lungimea piesei e mereu paralelă cu lungimea plăcii (fibra e pe lungime).
// Unități: mm. Coordonate: x pe lungimea plăcii, y pe lățime, origine colțul plăcii.

export interface NestParams { kerfMm: number; trimMm: number }
export interface NestPiece { label: string; lengthMm: number; widthMm: number }
export interface PlacedPiece extends NestPiece { x: number; y: number }
export interface SheetLayout { pieces: PlacedPiece[] }
export interface NestResult { sheets: SheetLayout[]; wastePct: number }

export const DEFAULT_NEST_PARAMS: NestParams = { kerfMm: 4, trimMm: 10 };

interface Shelf { y: number; heightMm: number; usedLengthMm: number }
interface WorkSheet { shelves: Shelf[]; pieces: PlacedPiece[] }

export function nestParts(
  pieces: NestPiece[],
  sheetLengthMm: number,
  sheetWidthMm: number,
  params: NestParams,
): NestResult {
  const usableL = sheetLengthMm - 2 * params.trimMm;
  const usableW = sheetWidthMm - 2 * params.trimMm;

  for (const p of pieces) {
    if (p.lengthMm > usableL || p.widthMm > usableW) {
      throw new Error(
        `Piesa „${p.label}" (${p.lengthMm}×${p.widthMm} mm) nu încape pe placa de ` +
        `${sheetLengthMm}×${sheetWidthMm} mm (arie utilă ${usableL}×${usableW} mm, fără rotație)`,
      );
    }
  }

  const sorted = [...pieces].sort((a, b) =>
    b.widthMm - a.widthMm || b.lengthMm - a.lengthMm || a.label.localeCompare(b.label));

  const sheets: WorkSheet[] = [];
  for (const p of sorted) {
    if (!placeOnExistingSheets(sheets, p, usableL, usableW, params)) {
      sheets.push({
        shelves: [{ y: 0, heightMm: p.widthMm, usedLengthMm: p.lengthMm }],
        pieces: [{ ...p, x: params.trimMm, y: params.trimMm }],
      });
    }
  }

  const pieceArea = pieces.reduce((s, p) => s + p.lengthMm * p.widthMm, 0);
  const usedArea = sheets.length * sheetLengthMm * sheetWidthMm;
  return {
    sheets: sheets.map((s) => ({ pieces: s.pieces })),
    wastePct: sheets.length === 0 ? 0 : (1 - pieceArea / usedArea) * 100,
  };
}

function placeOnExistingSheets(
  sheets: WorkSheet[], p: NestPiece,
  usableL: number, usableW: number, params: NestParams,
): boolean {
  for (const sheet of sheets) {
    for (const shelf of sheet.shelves) {
      const x = shelf.usedLengthMm + params.kerfMm;
      if (p.widthMm <= shelf.heightMm && x + p.lengthMm <= usableL) {
        sheet.pieces.push({ ...p, x: params.trimMm + x, y: params.trimMm + shelf.y });
        shelf.usedLengthMm = x + p.lengthMm;
        return true;
      }
    }
    const last = sheet.shelves[sheet.shelves.length - 1];
    const y = last.y + last.heightMm + params.kerfMm;
    if (y + p.widthMm <= usableW) {
      sheet.shelves.push({ y, heightMm: p.widthMm, usedLengthMm: p.lengthMm });
      sheet.pieces.push({ ...p, x: params.trimMm, y: params.trimMm + y });
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/engine/__tests__/nesting.test.ts`
Expected: PASS (4 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/nesting.ts lib/engine/__tests__/nesting.test.ts
git commit -m "feat(engine): nestParts — nesting guillotine pe rafturi, plasare pe o placă"
```

---

### Task 2: `nestParts` — plăci multiple, pierdere %, determinism

**Files:**
- Modify: `lib/engine/__tests__/nesting.test.ts` (adaugă un `describe` nou)
- Modify: `lib/engine/nesting.ts` (doar dacă un test pică — implementarea din Task 1 ar trebui să acopere tot)

**Interfaces:**
- Consumes: `nestParts`, `NestPiece` din Task 1. Nu schimbă semnături.

- [ ] **Step 1: Write the failing/confirming tests**

Adaugă în `lib/engine/__tests__/nesting.test.ts`:

```ts
describe('nestParts — plăci multiple, pierdere, determinism', () => {
  it('a treia piesă lată deschide a doua placă', () => {
    // 3 × (980×238): rafturile 1+2 ocupă 238+4+238 = 480 = lățimea utilă → a 3-a nu mai are loc
    const r = nestParts([piece('A', 980, 238), piece('B', 980, 238), piece('C', 980, 238)], 1000, 500, P);
    expect(r.sheets).toHaveLength(2);
    expect(r.sheets[1].pieces).toEqual([{ label: 'C', lengthMm: 980, widthMm: 238, x: 10, y: 10 }]);
  });

  it('piesă mai mare decât aria utilă → eroare cu numele piesei', () => {
    expect(() => nestParts([piece('Laterală L2', 981, 100)], 1000, 500, P))
      .toThrow(/Laterală L2/);
  });

  it('pierderea % pe aria plăcii întregi', () => {
    // o piesă 500×250 pe placă 1000×500 → 1 − 125000/500000 = 75%
    const r = nestParts([piece('A', 500, 250)], 1000, 500, P);
    expect(r.wastePct).toBeCloseTo(75, 5);
  });

  it('fără piese → zero plăci, pierdere 0', () => {
    const r = nestParts([], 1000, 500, P);
    expect(r).toEqual({ sheets: [], wastePct: 0 });
  });

  it('determinist: ordinea din input nu schimbă rezultatul', () => {
    const a = [piece('A', 400, 300), piece('B', 700, 200), piece('C', 300, 300), piece('D', 900, 100)];
    const b = [a[3], a[1], a[0], a[2]];
    expect(nestParts(a, 1000, 500, P)).toEqual(nestParts(b, 1000, 500, P));
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run lib/engine/__tests__/nesting.test.ts`
Expected: PASS toate (implementarea Task 1 le acoperă). Dacă vreunul pică, corectează `nesting.ts` minim până trec toate.

- [ ] **Step 3: Commit**

```bash
git add lib/engine/__tests__/nesting.test.ts lib/engine/nesting.ts
git commit -m "test(engine): nestParts — plăci multiple, pierdere %, determinism"
```

---

### Task 3: Integrare în motor — `needs.ts`, `costing.ts`, `index.ts`

**Files:**
- Modify: `lib/engine/needs.ts`
- Modify: `lib/engine/costing.ts` (liniile 33–43: args)
- Modify: `lib/engine/index.ts` (ProjectInput, apel computeCosts, export nesting)
- Modify: `lib/engine/__tests__/needs.test.ts`, `lib/engine/__tests__/costing.test.ts`, `lib/engine/__tests__/integration.test.ts` (înlocuiește `yieldFactor: 0.8` cu `nesting`)
- Test: cele de mai sus

**Interfaces:**
- Consumes: `nestParts`, `NestParams`, `SheetLayout`, `DEFAULT_NEST_PARAMS` din `./nesting`.
- Produces (folosite de Task 5, 6):

```ts
// needs.ts
export interface BoardNeed {
  materialId: string;
  totalAreaSqm: number;
  sheets: number | null;      // PER_SHEET: din nesting; PER_SQM: null
  wastePct: number | null;    // PER_SHEET: din nesting; PER_SQM: null
  layout: SheetLayout[] | null; // PER_SHEET: plăcile cu piesele plasate; PER_SQM: null
}
export function computeMaterialNeeds(parts: Part[], catalogs: Catalogs, nesting: NestParams): { boards: BoardNeed[]; edging: EdgingNeed[] }

// costing.ts — în args-ul computeCosts: `yieldFactor: number` devine `nesting: NestParams`
// index.ts — ProjectInput: `yieldFactor: number` devine `nesting: NestParams`
```

- [ ] **Step 1: Update the tests first (failing)**

În `lib/engine/__tests__/needs.test.ts`:
- Înlocuiește al 3-lea argument `0.8` cu `{ kerfMm: 4, trimMm: 10 }` (ambele apeluri).
- Testul `material PER_SQM → sheets null` (linia ~28): extinde asserția la `toMatchObject({ materialId: 'mdf-vopsit', sheets: null, wastePct: null, layout: null })`.
- Adaugă test nou:

```ts
it('PER_SHEET: sheets/wastePct/layout vin din nesting', () => {
  // 4 piese 1380×560 pe PAL 2800×2070 (util 2780×2050, kerf 4):
  // raft 1: 1380 + 4 + 1380 = 2764 ≤ 2780 → 2 piese; raft 2 la y = 10+560+4: încă 2 → 1 placă
  const parts: Part[] = Array.from({ length: 4 }, (_, i) => ({
    cabinetLabel: 'B1', name: `Piesă ${i + 1}`, lengthMm: 1380, widthMm: 560, qty: 1,
    materialId: 'pal-alb', edges: {},
  }));
  const { boards } = computeMaterialNeeds(parts, TEST_CATALOGS, { kerfMm: 4, trimMm: 10 });
  const pal = boards.find((b) => b.materialId === 'pal-alb')!;
  expect(pal.sheets).toBe(1);
  expect(pal.layout).toHaveLength(1);
  expect(pal.layout![0].pieces).toHaveLength(4);
  expect(pal.layout![0].pieces[0].label).toBe('B1 · Piesă 1');
  expect(pal.wastePct).toBeGreaterThan(0);
});
```

În `costing.test.ts` și `integration.test.ts`: înlocuiește fiecare `yieldFactor: 0.8` cu `nesting: { kerfMm: 4, trimMm: 10 }` (grep: `grep -n "yieldFactor" lib/engine/__tests__/*.ts`).

Run: `npx vitest run lib/engine` → Expected: FAIL (semnături vechi).

- [ ] **Step 2: Rewrite `lib/engine/needs.ts`**

```ts
import { findMaterial } from './carcass';
import { nestParts, type NestParams, type NestPiece, type SheetLayout } from './nesting';
import type { Catalogs, Part } from './types';

export interface BoardNeed {
  materialId: string;
  totalAreaSqm: number;
  sheets: number | null;
  wastePct: number | null;
  layout: SheetLayout[] | null;
}

export interface EdgingNeed {
  edgeBandId: string;
  totalMl: number;
}

export function computeMaterialNeeds(
  parts: Part[],
  catalogs: Catalogs,
  nesting: NestParams,
): { boards: BoardNeed[]; edging: EdgingNeed[] } {
  const areaByMaterial = new Map<string, number>();
  const piecesByMaterial = new Map<string, NestPiece[]>();
  const mlByBand = new Map<string, number>();

  for (const p of parts) {
    const area = (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty;
    areaByMaterial.set(p.materialId, (areaByMaterial.get(p.materialId) ?? 0) + area);

    const pieces = piecesByMaterial.get(p.materialId) ?? [];
    for (let i = 0; i < p.qty; i++) {
      pieces.push({ label: `${p.cabinetLabel} · ${p.name}`, lengthMm: p.lengthMm, widthMm: p.widthMm });
    }
    piecesByMaterial.set(p.materialId, pieces);

    const addMl = (bandId: string | undefined, mm: number) => {
      if (!bandId) return;
      mlByBand.set(bandId, (mlByBand.get(bandId) ?? 0) + (mm / 1000) * p.qty);
    };
    addMl(p.edges.l1, p.lengthMm);
    addMl(p.edges.l2, p.lengthMm);
    addMl(p.edges.w1, p.widthMm);
    addMl(p.edges.w2, p.widthMm);
  }

  const boards: BoardNeed[] = [...areaByMaterial.entries()].map(([materialId, totalAreaSqm]) => {
    const material = findMaterial(catalogs, materialId);
    if (material.pricing.mode === 'PER_SQM') {
      return { materialId, totalAreaSqm, sheets: null, wastePct: null, layout: null };
    }
    const nested = nestParts(
      piecesByMaterial.get(materialId) ?? [],
      material.sheetLengthMm, material.sheetWidthMm, nesting,
    );
    return {
      materialId, totalAreaSqm,
      sheets: nested.sheets.length,
      wastePct: nested.wastePct,
      layout: nested.sheets,
    };
  });

  const edging: EdgingNeed[] = [...mlByBand.entries()].map(([edgeBandId, totalMl]) => ({
    edgeBandId, totalMl,
  }));

  return { boards, edging };
}
```

- [ ] **Step 3: Update `lib/engine/costing.ts`**

- Import: `import type { NestParams } from './nesting';`
- În args-ul `computeCosts` (linia ~39): `yieldFactor: number;` → `nesting: NestParams;`
- Apelul (linia ~43): `computeMaterialNeeds(args.parts, catalogs, args.nesting)`.
- Restul funcției neschimbat.

- [ ] **Step 4: Update `lib/engine/index.ts`**

- `ProjectInput`: `yieldFactor: number;` → `nesting: NestParams;` (import type din `./nesting`).
- În apelul `computeCosts`: `yieldFactor: project.yieldFactor,` → `nesting: project.nesting,`.
- La exporturile publice adaugă:

```ts
export { nestParts, DEFAULT_NEST_PARAMS } from './nesting';
export type { NestParams, NestPiece, PlacedPiece, SheetLayout, NestResult } from './nesting';
```

- [ ] **Step 5: Run the engine suite**

Run: `npx vitest run lib/engine`
Expected: PASS. Așteptările existente de 1 foaie PAL / 1 foaie PFL pentru corpul B1 (600×720×560) rămân valabile — piesele unui singur corp încap lejer pe o placă 2800×2070. Dacă vreo cifră de cost diferă, recalculează manual (plăci × preț) și corectează DOAR valoarea așteptată din test, nu implementarea, documentând în mesajul de commit.

- [ ] **Step 6: Commit**

```bash
git add lib/engine
git commit -m "feat(engine): numărul de plăci vine din nesting, nu din yieldFactor; BoardNeed capătă wastePct + layout"
```

---

### Task 4: Setări kerf + trim — Prisma, seed, zod, pagina Setări

**Files:**
- Modify: `prisma/schema.prisma` (model AppSettings)
- Create: migrare via `npx prisma migrate dev --name cut_kerf_trim`
- Modify: `prisma/seed.ts` (~linia 63)
- Modify: `lib/catalog/schemas.ts` (settingsSchema, ~linia 57)
- Modify: `lib/catalog/actions.ts` (updateSettings, ~linia 102)
- Modify: `lib/catalog/convert.ts` (SettingsRow, ~linia 19)
- Modify: `app/setari/page.tsx` (~linia 50)
- Test: `lib/catalog/__tests__/schemas.test.ts`

**Interfaces:**
- Produces (folosit de Task 5): `SettingsRow` capătă `cutKerfMm?: number | null; cutTrimMm?: number | null` — OPȚIONALE, pentru că snapshot-urile înghețate vechi (JSON) nu au câmpurile.

- [ ] **Step 1: Write the failing test**

În `lib/catalog/__tests__/schemas.test.ts`, lângă testele settingsSchema existente (~linia 29):

```ts
it('settingsSchema acceptă kerf și trim numerice și respinge negativ', () => {
  const ok = settingsSchema.parse({
    markupPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '4', cutTrimMm: '10',
  });
  expect(ok.cutKerfMm).toBe(4);
  expect(ok.cutTrimMm).toBe(10);
  expect(() => settingsSchema.parse({
    markupPct: '30', sheetYieldFactor: '0.8', cutKerfMm: '-1', cutTrimMm: '10',
  })).toThrow();
});
```

Run: `npx vitest run lib/catalog` → Expected: FAIL (câmpuri necunoscute/lipsă).

- [ ] **Step 2: Schema Prisma + migrare + seed**

În `prisma/schema.prisma`, în `model AppSettings` după `sheetYieldFactor`:

```prisma
  cutKerfMm        Float   @default(4)
  cutTrimMm        Float   @default(10)
```

Rulează: `npx prisma migrate dev --name cut_kerf_trim`
Expected: migrare aplicată pe `dev.db`, client regenerat. (NU șterge baza; default-urile completează rândul existent.)

În `prisma/seed.ts`, în obiectul de settings (lângă `sheetYieldFactor: 0.8`): adaugă `cutKerfMm: 4, cutTrimMm: 10,`.

- [ ] **Step 3: Zod + action + SettingsRow + UI**

`lib/catalog/schemas.ts` — în `settingsSchema` după `sheetYieldFactor`:

```ts
  cutKerfMm: num.nonnegative(),
  cutTrimMm: num.nonnegative(),
```

`lib/catalog/actions.ts` — în `updateSettings`, în `data`: adaugă `cutKerfMm: d.cutKerfMm, cutTrimMm: d.cutTrimMm,`.

`lib/catalog/convert.ts` — în `SettingsRow`: adaugă `cutKerfMm?: number | null; cutTrimMm?: number | null;` cu comentariul `// opționale: snapshot-urile înghețate dinainte de nesting nu le au`.

`app/setari/page.tsx` — în grid-ul cu `sheetYieldFactor` (linia ~50):
- Schimbă eticheta existentă în `label="Factor utilizare foaie (doar estimarea per corp)"`.
- Adaugă:

```tsx
<NumberInput name="cutKerfMm" label="Kerf pânză (mm)" defaultValue={settings.cutKerfMm} step="0.1" />
<NumberInput name="cutTrimMm" label="Margine curățare placă (mm)" defaultValue={settings.cutTrimMm} step="1" />
```

(și schimbă containerul din `grid-cols-2` în `grid-cols-2 md:grid-cols-4` ca să încapă 4 câmpuri).

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/catalog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma lib/catalog app/setari
git commit -m "feat(setari): kerf pânză + margine de curățare pentru nesting (AppSettings, zod, UI)"
```

---

### Task 5: `computeQuote` folosește nesting-ul; curățare yieldFactor din fluxul de cost

**Files:**
- Modify: `lib/quote/compute.ts` (QuoteInput, computeQuote)
- Modify: `lib/quote/load.ts` (toQuoteInput, ~liniile 52–68)
- Modify: `scripts/smoke-quote.ts` (~linia 32)
- Modify: `lib/quote/__tests__/compute.test.ts`, `lib/quote/__tests__/fixtures.ts`
- Modify: `app/proiecte/[id]/page.tsx` (linia ~156, eticheta yieldFactor)
- Test: `lib/quote/__tests__/`

**Interfaces:**
- Consumes: `DEFAULT_NEST_PARAMS`, `NestParams` din `@/lib/engine`; `SettingsRow.cutKerfMm/cutTrimMm` din Task 4.
- Produces: `QuoteInput` FĂRĂ `yieldFactor` (câmpul dispare). `Project.yieldFactor` din DB rămâne — îl folosește DOAR `lib/quote/estimate.ts` (estimarea per corp, neatinsă).

- [ ] **Step 1: Update tests first (failing)**

`lib/quote/__tests__/fixtures.ts` — în settings-ul din `makeSnapshot()`: adaugă `cutKerfMm: 4, cutTrimMm: 10,`.
`lib/quote/__tests__/compute.test.ts` — în `baseQuote()`: șterge `yieldFactor: 0.8,`.

Adaugă în `compute.test.ts`:

```ts
it('snapshot vechi fără kerf/trim → default-uri (4/10), nu crash', () => {
  const snap = makeSnapshot();
  delete (snap.settings as Record<string, unknown>).cutKerfMm;
  delete (snap.settings as Record<string, unknown>).cutTrimMm;
  const r = computeQuote(baseQuote(), snap);
  const pal = r.costs.needs.boards.find((b) => b.materialId === 'pal-alb')!;
  expect(pal.sheets).toBe(1);
  expect(pal.layout).not.toBeNull();
});
```

Run: `npx vitest run lib/quote` → Expected: FAIL (QuoteInput încă cere yieldFactor).

- [ ] **Step 2: Update `lib/quote/compute.ts`**

- Din `QuoteInput` șterge `yieldFactor: number;`.
- Import: adaugă `DEFAULT_NEST_PARAMS` și `type NestParams` la importurile din `@/lib/engine`.
- În `computeQuote`, înainte de apelul `computeCosts`:

```ts
  // snapshot-urile înghețate dinainte de nesting nu au kerf/trim — cad pe default-uri
  const nesting: NestParams = {
    kerfMm: snap.settings.cutKerfMm ?? DEFAULT_NEST_PARAMS.kerfMm,
    trimMm: snap.settings.cutTrimMm ?? DEFAULT_NEST_PARAMS.trimMm,
  };
```

- În apelul `computeCosts`: `yieldFactor: q.yieldFactor,` → `nesting,`.

- [ ] **Step 3: Update callers**

- `lib/quote/load.ts` `toQuoteInput`: șterge `yieldFactor` din tipul parametrului `project` (rămâne `{ markupPct: number; freeLinesJson: string }`) și din obiectul returnat.
- `scripts/smoke-quote.ts` linia ~32: șterge `yieldFactor: 0.8,` din obiectul QuoteInput (crearea proiectului cu `yieldFactor: 0.8` la linia ~24 RĂMÂNE — e câmp de DB folosit de estimare).
- `app/proiecte/[id]/page.tsx` linia ~156: eticheta devine `label="Factor utilizare foaie (doar estimarea per corp)"`.
- Verifică că nu a rămas nimic: `grep -rn "yieldFactor" lib app scripts --include="*.ts" --include="*.tsx" | grep -v estimate | grep -v node_modules` — rezultatele rămase trebuie să fie doar: DB/schema zod pentru project settings (`lib/quote/actions.ts`), crearea/duplicarea proiectului, seed, editorul de corp care pasează la estimare, `app/setari` (sheetYieldFactor) și `lib/catalog` (schema/convert). Dacă apare altceva, actualizează-l.

- [ ] **Step 4: Run the full pure-logic suite**

Run: `npx vitest run`
Expected: PASS (toate; cifrele de referință 836.16 / 1087.01 rămân — 1 foaie PAL + 1 foaie PFL, la fel ca înainte). La diferențe, recalculează manual și ajustează doar valorile așteptate, cu explicație în commit.

- [ ] **Step 5: Smoke pe DB reală**

Run: `npx tsx scripts/smoke-quote.ts`
Expected: `SMOKE OK: …`. (Necesită `dev.db` migrat + seed — dacă lipsește: `npm run db:migrate && npm run db:seed`.)

- [ ] **Step 6: Commit**

```bash
git add lib/quote scripts/smoke-quote.ts app/proiecte
git commit -m "feat(quote): costul plăcilor pe nesting real (kerf/trim din snapshot); yieldFactor rămâne doar la estimarea per corp"
```

---

### Task 6: Pagina „Plan debitare" + pierdere % în rezumat

**Files:**
- Create: `components/CuttingLayoutSvg.tsx`
- Create: `app/proiecte/[id]/plan-debitare/page.tsx`
- Modify: `app/proiecte/[id]/page.tsx` (rezumat: linia ~257 lista de plăci; linia ~277 butoanele de export)

**Interfaces:**
- Consumes: `BoardNeed.layout/wastePct/sheets` (Task 3), `SheetLayout`/`PlacedPiece` din `@/lib/engine`, patternul de pagină din `app/proiecte/[id]/oferta/page.tsx` (loadProject → getQuoteBasis → tryComputeQuote), `PrintButton` din `@/components/PrintButton`, `fmtNum` din `@/lib/format`.

- [ ] **Step 1: Create `components/CuttingLayoutSvg.tsx`**

```tsx
import type { SheetLayout } from '@/lib/engine';

// Desenul unei plăci: fundal hașurat = pierdere, dreptunghiuri albe = piese.
// viewBox e în mm, deci coordonatele pieselor se folosesc direct.
export function CuttingLayoutSvg({ layout, sheetLengthMm, sheetWidthMm }: {
  layout: SheetLayout;
  sheetLengthMm: number;
  sheetWidthMm: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${sheetLengthMm} ${sheetWidthMm}`}
      className="w-full rounded border"
      role="img"
    >
      <defs>
        <pattern id="rest" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="40" height="40" fill="#f5f5f4" />
          <line x1="0" y1="0" x2="0" y2="40" stroke="#d6d3d1" strokeWidth="12" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={sheetLengthMm} height={sheetWidthMm} fill="url(#rest)" stroke="#78716c" strokeWidth="4" />
      {layout.pieces.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y} width={p.lengthMm} height={p.widthMm} fill="#ffffff" stroke="#57534e" strokeWidth="3" />
          <text x={p.x + 14} y={p.y + 44} fontSize="36" fill="#44403c">{p.label}</text>
          <text x={p.x + 14} y={p.y + 84} fontSize="32" fill="#78716c">{p.lengthMm}×{p.widthMm}</text>
        </g>
      ))}
    </svg>
  );
}
```

- [ ] **Step 2: Create `app/proiecte/[id]/plan-debitare/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { legHeightByCabinet, loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { getQuoteBasis } from '@/lib/quote/basis';
import { CuttingLayoutSvg } from '@/components/CuttingLayoutSvg';
import { PrintButton } from '@/components/PrintButton';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PlanDebitarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, assemblies, cabinets } = data;

  const basis = await getQuoteBasis(project);
  if (basis.kind === 'MISSING') {
    return (
      <p className="text-sm">
        Proiectul e într-o stare înghețată dar nu are un calcul salvat — <Link href={`/proiecte/${id}`} className="underline">înapoi la proiect</Link>.
      </p>
    );
  }
  const snapshot = basis.snapshot;
  const { quote, error } = tryComputeQuote(toQuoteInput(project, cabinets, legHeightByCabinet(assemblies, cabinets)), snapshot);
  if (!quote) return <p className="text-sm text-red-700">Eroare de calcul: {error}</p>;

  const nested = quote.costs.needs.boards.filter((b) => b.layout !== null);

  return (
    <div className="mx-auto max-w-4xl space-y-8 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan debitare — {project.name}</h1>
          <p className="text-sm text-neutral-600">{new Date().toLocaleDateString('ro-RO')} · doar materialele la placă; cele la m² nu se optimizează</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <Link href={`/proiecte/${id}`} className="text-sm underline">Înapoi la proiect</Link>
        </div>
      </div>

      {nested.length === 0 && <p className="text-sm">Niciun material la placă în acest proiect.</p>}

      {nested.map((b) => {
        const material = snapshot.materials.find((m) => m.id === b.materialId);
        const name = material?.name ?? b.materialId;
        return (
          <section key={b.materialId} className="space-y-4 break-inside-avoid">
            <h2 className="font-semibold">
              {name} — {b.sheets} {b.sheets === 1 ? 'placă' : 'plăci'} ({material?.sheetLengthMm}×{material?.sheetWidthMm} mm) · pierdere {fmtNum(b.wastePct ?? 0, 1)}%
            </h2>
            {b.layout!.map((sheet, i) => (
              <figure key={i} className="space-y-1 break-inside-avoid">
                <figcaption className="text-xs text-neutral-600">Placa {i + 1} din {b.sheets}</figcaption>
                <CuttingLayoutSvg layout={sheet} sheetLengthMm={material?.sheetLengthMm ?? 2800} sheetWidthMm={material?.sheetWidthMm ?? 2070} />
              </figure>
            ))}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Link + pierdere % în pagina proiectului**

În `app/proiecte/[id]/page.tsx`:
- Lista „Necesar de materiale" (linia ~257–261): rândul devine

```tsx
{quote.costs.needs.boards.map((b) => (
  <li key={b.materialId}>
    {materialName(b.materialId)}: {fmtNum(b.totalAreaSqm)} m²
    {b.sheets !== null ? ` → ${b.sheets} plăci (pierdere ${fmtNum(b.wastePct ?? 0, 1)}%)` : ' (la m²)'}
  </li>
))}
```

- În blocul de butoane (după butonul „Ofertă pentru client", linia ~280):

```tsx
<Button asChild variant="outline" size="sm">
  <Link href={`/proiecte/${project.id}/plan-debitare`}>Plan debitare (print/PDF)</Link>
</Button>
```

- [ ] **Step 4: Verify manually against the dev server**

Utilizatorul are `next dev` pe :3000 (NU-l porni/omorî tu; dacă nu răspunde, sari peste pasul vizual).
Run: `curl -s http://localhost:3000/proiecte | grep -o "<h1[^>]*>[^<]*" | head -2` pentru sanity, apoi deschide în listă un proiect existent și:
`curl -s http://localhost:3000/proiecte/<id>/plan-debitare | grep -c "<svg"` → Expected: număr > 0 (câte un SVG per placă).

- [ ] **Step 5: Commit**

```bash
git add components/CuttingLayoutSvg.tsx app/proiecte
git commit -m "feat(ui): pagina Plan debitare (SVG per placă, printabilă) + pierdere % în rezumat"
```

---

### Task 7: Verificare finală — suite + build

**Files:** niciunul nou.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: PASS, ≥ 107 + testele noi (nesting ~9, needs +1, schemas +1, compute +1).

- [ ] **Step 2: Production build**

ATENȚIE: utilizatorul rulează `next dev` pe :3000 care împarte `.next` cu build-ul.
Run: `rm -rf .next && npm run build`
Expected: build OK, ruta `/proiecte/[id]/plan-debitare` listată. (După build, dev-ul utilizatorului își va regenera `.next` singur la următorul request.)

- [ ] **Step 3: Smoke final**

Run: `npx tsx scripts/smoke-quote.ts`
Expected: `SMOKE OK`.

- [ ] **Step 4: Commit final (dacă au rămas modificări) și raport**

```bash
git status --short   # trebuie să fie curat; commit dacă nu e
```

Raportează: numărul de teste, rezultatul build-ului, și diferențele de preț observate față de euristica veche (dacă există un proiect de test în DB).

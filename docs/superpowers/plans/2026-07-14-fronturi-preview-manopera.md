# Fronturi (uși/sertare), previzualizare izometrică, manoperă procentuală — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alegerea uși/sertare/fără front pe orice tip de corp (tipul SERTARE dispare), sertare configurate per-sertar, polițe cu bifă, previzualizare izometrică SVG sub „Piese generate", și manoperă procentuală (% din materiale) care înlocuiește manopera per tip + adaosul.

**Architecture:** Motorul pur din `lib/engine` rămâne sursa de adevăr (TS pur, testat cu vitest). Schimbările merg în 3 valuri: (1) costing — `laborPct` înlocuiește `laborPerType` + `markupPct` prin toate straturile (engine → convert → compute/estimate → Prisma → UI); (2) fronturi — enum `CabinetType` pierde SERTARE, validare uși XOR sertare, formular nou „Fronturi"; (3) previzualizare — funcție pură `buildIsoModel` + component SVG `CabinetIsoSvg`.

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma + SQLite, zod, vitest, shadcn/ui, SVG pur (fără dependențe noi).

**Spec:** `docs/superpowers/specs/2026-07-14-fronturi-preview-manopera-design.md`

## Global Constraints

- Tot textul UI, mesajele de eroare și comentariile: **în română**, stilul existent (diacritice, ghilimele „").
- **Zero dependențe noi** (fără Three.js — SVG pur).
- Fără teste UI — doar logică pură în `lib/**/__tests__/` (directiva din 2026-07-12).
- Formula nouă de preț: `prețVânzare = (plăci + canturi + debitare + feronerie) × (1 + manoperă%/100) + liniiLibere`; liniile libere NU primesc procent.
- Manoperă% default global: **120**; migrare: `laborPct` preia valoarea `markupPct` existentă.
- Uși XOR sertare: un corp nu poate avea și `doors > 0` și `drawers.count > 0`.
- Convenția atelierului: lățime ≤ 600mm → 1 ușă, peste → 2 uși (doar precompletare, editabil).
- La finalul fiecărui task: `npm test` trece complet și se face commit.
- Directorul de lucru: `/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare`.

---

### Task 1: Motor — manoperă procentuală în `costing.ts` și `computeProject`

**Files:**
- Modify: `lib/engine/costing.ts`
- Modify: `lib/engine/index.ts` (interfața `ProjectInput`, apelul `computeCosts`)
- Test: `lib/engine/__tests__/costing.test.ts`, `lib/engine/__tests__/integration.test.ts`

**Interfaces:**
- Consumes: `CostCatalogs` (din `costing.ts`), `computeMaterialNeeds` (neschimbate în rest).
- Produces: `computeCosts(args)` cu `laborPct: number` în loc de `markupPct`, fără `catalogs.laborPerType`; `CostCatalogs` fără `laborPerType`; semantică nouă: `breakdown.labor = bazaMateriale × laborPct/100`, `totalCost = bazaMateriale + freeLines`, `sellPrice = bazaMateriale × (1 + laborPct/100) + freeLines`. `ProjectInput.laborPct` în loc de `markupPct`.

- [ ] **Step 1: Rescrie testele de costing pentru manopera procentuală**

În `lib/engine/__tests__/costing.test.ts`:
- Șterge linia `laborPerType: { BAZA: 150, ... }` din catalogul de test.
- Înlocuiește peste tot `markupPct:` cu `laborPct:` în apelurile `computeCosts`.
- Înlocuiește asserțiile pe `labor`/`sellPrice` cu noua semantică. Adaugă/înlocuiește cu acest test (adaptează numele catalogului de test existent din fișier, uzual `CATALOGS` sau similar):

```ts
it('manoperă procentuală: labor = bază materiale × %, liniile libere fără procent', () => {
  const result = computeCosts({
    parts: [],
    hardwareLines: [{ hardwareId: 'balama', qty: 2 }], // presupune un item de 10 lei/buc în catalogul de test
    cabinets: [],
    freeLines: [{ name: 'Transport', amount: 100 }],
    laborPct: 120,
    nesting: { kerfMm: 4, trimMm: 10 },
    catalogs,
  });
  // bază materiale = doar feroneria (20 lei), fără piese
  expect(result.breakdown.hardware).toBeCloseTo(20, 5);
  expect(result.breakdown.labor).toBeCloseTo(24, 5);        // 20 × 120%
  expect(result.breakdown.freeLines).toBeCloseTo(100, 5);
  expect(result.totalCost).toBeCloseTo(120, 5);             // 20 + 100 (fără manoperă)
  expect(result.sellPrice).toBeCloseTo(144, 5);             // 20 × 2.2 + 100
});
```

Dacă itemul `balama` nu există în catalogul de test, folosește un id/preț care există și recalculează valorile așteptate (regula: `labor = hardware × 1.2`, `sellPrice = hardware × 2.2 + 100`).

- [ ] **Step 2: Rulează testele — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/costing.test.ts`
Expected: FAIL — `laborPct` nu există în semnătură / `laborPerType` lipsește din tip.

- [ ] **Step 3: Implementează în `costing.ts`**

- În `CostCatalogs`: șterge linia `laborPerType: Record<CabinetType, number>;` (și importul `CabinetType` dacă rămâne nefolosit — atenție: `BASE_RUN_TYPES` îl folosește încă).
- În semnătura `computeCosts`: înlocuiește `markupPct: number` cu `laborPct: number`.
- Înlocuiește calculul (liniile actuale 77–82):

```ts
  const materialBase = boards + edging + cuttingService + hardware;
  // manopera atelierului: procent din tot materialul (inclusiv feronerie); include profitul
  const labor = materialBase * (args.laborPct / 100);
  const freeLines = args.freeLines.reduce((sum, l) => sum + l.amount, 0);

  const breakdown: CostBreakdown = { boards, edging, cuttingService, hardware, labor, freeLines };
  // totalCost = ce plătește atelierul; sellPrice = ce facturează (diferența e manopera)
  const totalCost = materialBase + freeLines;
  const sellPrice = materialBase + labor + freeLines;
```

- [ ] **Step 4: Actualizează `computeProject` din `lib/engine/index.ts`**

- `ProjectInput`: `markupPct: number` → `laborPct: number`.
- În apelul `computeCosts`: `markupPct: project.markupPct` → `laborPct: project.laborPct`.

- [ ] **Step 5: Actualizează `integration.test.ts`**

- Șterge `laborPerType: {...}` din catalogul de test.
- Înlocuiește `markupPct: 30` cu `laborPct: 30` (ambele apariții).
- Dacă există asserții pe valori absolute de `sellPrice`/`totalCost`, recalculează după noua formulă.

- [ ] **Step 6: Rulează toată suita motorului**

Run: `npx vitest run lib/engine`
Expected: PASS (celelalte fișiere de test nu ating costing).

- [ ] **Step 7: Commit**

```bash
git add lib/engine
git commit -m "feat(engine): manoperă procentuală în loc de laborPerType + markup"
```

---

### Task 2: Prisma — redenumire `markupPct` → `laborPct`, ștergere `LaborRate`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_manopera_pct/migration.sql` (via `--create-only`, apoi editat manual)
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: coloanele `Project.laborPct` și `AppSettings.laborPct` (valorile vechi `markupPct` păstrate), modelul `LaborRate` șters. Codul TS care citește `project.laborPct` din Task 3 depinde de asta.

- [ ] **Step 1: Editează `prisma/schema.prisma`**

- În `model Project`: `markupPct Float` → `laborPct Float`.
- În `model AppSettings`: `markupPct Float` → `laborPct Float`.
- Șterge complet `model LaborRate`.

- [ ] **Step 2: Generează migrarea fără aplicare și editeaz-o**

Run: `npx prisma migrate dev --create-only --name manopera_pct`

Înlocuiește TOT conținutul fișierului `migration.sql` generat cu (SQLite suportă RENAME COLUMN — păstrăm valorile existente):

```sql
ALTER TABLE "Project" RENAME COLUMN "markupPct" TO "laborPct";
ALTER TABLE "AppSettings" RENAME COLUMN "markupPct" TO "laborPct";
DROP TABLE "LaborRate";
```

- [ ] **Step 3: Aplică migrarea**

Run: `npx prisma migrate dev`
Expected: „Your database is now in sync". Notă: clientul Prisma se regenerează; codul TS care folosește `markupPct` va da erori de tip până la Task 3 — e ok, nu rulăm build acum.

- [ ] **Step 4: Actualizează `prisma/seed.ts`**

- Șterge blocul `laborRates` (liniile cu `{ cabinetType: 'BAZA', price: 150 }` … și bucla `prisma.laborRate.upsert`).
- În obiectul `settings`: `markupPct: 30` → `laborPct: 120`.

- [ ] **Step 5: Commit**

```bash
git add prisma
git commit -m "feat(db): laborPct pe Project/AppSettings, dispare LaborRate"
```

---

### Task 3: Stratul quote/catalog — `laborPct` prin convert, compute, estimate, snapshot, actions

**Files:**
- Modify: `lib/catalog/convert.ts`, `lib/catalog/schemas.ts`, `lib/catalog/actions.ts`
- Modify: `lib/quote/compute.ts`, `lib/quote/snapshot.ts`, `lib/quote/estimate.ts`, `lib/quote/load.ts`, `lib/quote/actions.ts`
- Modify: `scripts/smoke-quote.ts`

**Interfaces:**
- Consumes: `computeCosts` cu `laborPct` (Task 1), coloana `laborPct` (Task 2).
- Produces: `toCostCatalogs(materials, edgeBands, hardware, cuttingRates)` — **4 parametri, fără laborRates**; `SnapshotData` fără `laborRates`; `QuoteInput.laborPct`; `toQuoteInput` citește `project.laborPct`; `estimateCabinetCost(..., opts: { laborPct, yieldFactor, legHeightMm })`. Task 4 (UI) și Task 6 (editor) depind de aceste semnături.

- [ ] **Step 1: `lib/catalog/convert.ts`**

- Șterge `export interface LaborRateRow`, constanta `CABINET_TYPES` și tot blocul `laborPerType` din `toCostCatalogs`; scoate parametrul `laborRates: LaborRateRow[]` și `laborPerType` din obiectul returnat. Curăță importul `CabinetType` dacă rămâne nefolosit.
- În `SettingsRow`: `markupPct: number` → `laborPct?: number | null` (snapshot-urile vechi au `markupPct` în JSON, nu `laborPct`; nimeni nu citește câmpul din snapshot, dar tipul trebuie să tolereze ambele).

- [ ] **Step 2: `lib/catalog/schemas.ts` și `lib/catalog/actions.ts`**

- `schemas.ts`: șterge `laborRateSchema`; în `settingsSchema`: `markupPct: num.nonnegative()` → `laborPct: num.nonnegative()`.
- `actions.ts`: șterge `updateLaborRate` și importul `laborRateSchema`; în `updateSettings`, înlocuiește `markupPct: d.markupPct` cu `laborPct: d.laborPct`.

- [ ] **Step 3: `lib/quote/snapshot.ts` și `lib/quote/compute.ts`**

- `snapshot.ts`: scoate `prisma.laborRate.findMany()` din `Promise.all` și `laborRates` din destructurare + return.
- `compute.ts`: în `SnapshotData` șterge `laborRates: LaborRateRow[]` (și importul tipului); în `QuoteInput`: `markupPct` → `laborPct`; apelul `toCostCatalogs` pierde `snap.laborRates`; în `computeCosts({...})`: `markupPct: q.markupPct` → `laborPct: q.laborPct`.

- [ ] **Step 4: `lib/quote/estimate.ts`**

- `opts`: `{ markupPct: number; ... }` → `{ laborPct: number; ... }`.
- `toCostCatalogs` fără `snap.laborRates`.
- Șterge linia `const labor = catalogs.laborPerType[cabinet.input.type];` și înlocuiește finalul cu:

```ts
    const cost = boards + cutting + edging + hardware;
    return { cost, sell: cost * (1 + opts.laborPct / 100), error: null };
```

- [ ] **Step 5: `lib/quote/load.ts` și `lib/quote/actions.ts`**

- `load.ts` — `toQuoteInput`: parametrul `project: { markupPct: number; freeLinesJson: string }` → `{ laborPct: number; freeLinesJson: string }`; `markupPct: project.markupPct` → `laborPct: project.laborPct`.
- `actions.ts`:
  - `projectSettingsSchema`: `markupPct: z.coerce.number().nonnegative()` → `laborPct: z.coerce.number().nonnegative()`.
  - `createProject`: `markupPct: settings.markupPct` → `laborPct: settings.laborPct`.
  - `duplicateProject`: `markupPct: project.markupPct` → `laborPct: project.laborPct`.

- [ ] **Step 6: `scripts/smoke-quote.ts`**

- `markupPct: 30` din crearea proiectului → `laborPct: 120`; în input-ul de quote `{ markupPct: 30, ... }` → `{ laborPct: 120, ... }`.

- [ ] **Step 7: Verifică compilarea și testele**

Run: `npx tsc --noEmit 2>&1 | grep -v "app/\|components/"` — erorile rămase trebuie să fie DOAR în `app/` și `components/` (rezolvate în Task 4 și 6). Apoi:
Run: `npx vitest run`
Expected: PASS (testele nu ating straturile modificate cu vechile semnături).

- [ ] **Step 8: Commit**

```bash
git add lib scripts
git commit -m "feat(quote): laborPct prin convert/compute/estimate/actions"
```

---

### Task 4: UI manoperă — Setări, pagina proiect, ștergerea paginii Manoperă

**Files:**
- Modify: `app/setari/page.tsx`, `app/proiecte/[id]/page.tsx`, `app/proiecte/[id]/corp/[cabinetId]/page.tsx`, `components/CabinetEditorForm.tsx` (doar prop-ul, restul în Task 6)
- Delete: `app/cataloage/manopera/page.tsx`
- Modify: orice link de navigație către `/cataloage/manopera` (caută cu `grep -rn "manopera" app components`)

**Interfaces:**
- Consumes: `laborPct` din Task 2–3.
- Produces: UI complet funcțional pe formula nouă; `CabinetEditorFormProps.laborPct: number`.

- [ ] **Step 1: `app/setari/page.tsx`**

Înlocuiește `<NumberInput name="markupPct" label="Adaos implicit (%)" defaultValue={settings.markupPct} />` cu:

```tsx
<NumberInput name="laborPct" label="Manoperă implicită (% din materiale)" defaultValue={settings.laborPct} />
```

- [ ] **Step 2: `app/proiecte/[id]/page.tsx`**

- Formularul de setări proiect: `<NumberInput name="markupPct" label="Adaos (%)" defaultValue={project.markupPct} />` → `<NumberInput name="laborPct" label="Manoperă (%)" defaultValue={project.laborPct} />`.
- Cardul de preț: `Preț de vânzare (adaos {fmtNum(project.markupPct)}%)` → `Preț de vânzare (manoperă {fmtNum(project.laborPct)}%)`.
- `CATEGORY_LABELS` rămâne neschimbat (cheia `labor` există în continuare în breakdown).

- [ ] **Step 3: Șterge pagina Manoperă și link-urile**

```bash
rm app/cataloage/manopera/page.tsx && rmdir app/cataloage/manopera
grep -rn "manopera" app components lib --include="*.tsx" --include="*.ts"
```

Șterge orice link/entry găsit (uzual în navigația din `app/cataloage` sau layout).

- [ ] **Step 4: Prop-ul editorului**

- `components/CabinetEditorForm.tsx`: în `CabinetEditorFormProps` și destructurare: `markupPct: number` → `laborPct: number`; în apelul `estimateCabinetCost(...)`: `{ markupPct, ... }` → `{ laborPct, ... }`; în `useMemo` deps la fel.
- `app/proiecte/[id]/corp/[cabinetId]/page.tsx`: `markupPct={project.markupPct}` → `laborPct={project.laborPct}`; în blocul `toCostCatalogs(...)` șterge al 5-lea argument (array-ul dummy de `laborRates` cu cele 5 tipuri).

- [ ] **Step 5: Verificare**

Run: `npx tsc --noEmit`
Expected: zero erori. Apoi `npm test` → PASS. Apoi `npm run build` → succes.

- [ ] **Step 6: Commit**

```bash
git add app components
git commit -m "feat(ui): manoperă procentuală în Setări și proiect; dispare pagina Manoperă"
```

---

### Task 5: Motor — dispare tipul SERTARE, validare uși XOR sertare

**Files:**
- Modify: `lib/engine/types.ts`, `lib/engine/templates.ts`, `lib/engine/fronts.ts`, `lib/engine/hardware.ts`, `lib/engine/costing.ts`
- Test: `lib/engine/__tests__/templates.test.ts`, plus fixările din `fronts.test.ts`, `drawers.test.ts`, `hardware.test.ts`

**Interfaces:**
- Produces: `CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT'`; `expandCabinet` acceptă `drawers` pe orice tip, aruncă la uși+sertare simultan, la sertare+polițe, la fronturi fără material. Task 6–8 depind de asta.

- [ ] **Step 1: Scrie testele noi de validare în `templates.test.ts`**

Înlocuiește testele `'SERTARE fără drawers → eroare'` și `'SERTARE cu doors > 0 → eroare'` cu:

```ts
it('uși + sertare simultan → eroare', () => {
  const input = bazaInput({
    doors: 1,
    drawers: { count: 2, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
    shelves: 0,
  });
  expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
    .toThrow(/fie uși, fie sertare/);
});

it('sertare + polițe → eroare', () => {
  const input = bazaInput({
    doors: 0, shelves: 1,
    drawers: { count: 2, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
  });
  expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
    .toThrow(/polițe/);
});

it('drawers cu count 0 → eroare', () => {
  const input = bazaInput({
    doors: 0, shelves: 0,
    drawers: { count: 0, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
  });
  expect(() => expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION))
    .toThrow(/cel puțin un sertar/);
});

it('sertare pe corp SUSPENDAT → merge (sertarele nu mai sunt un tip)', () => {
  const input = bazaInput({
    type: 'SUSPENDAT', doors: 0, shelves: 0,
    drawers: { count: 2, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
  });
  const result = expandCabinet(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
  expect(result.parts.filter((p) => p.name === 'Front sertar').length).toBeGreaterThan(0);
});
```

Adaptează testul existent `'SERTARE: fronturi sertar + cutii + glisiere...'`: schimbă `type: 'SERTARE'` în `type: 'BAZA'` și păstrează asserțiile.

- [ ] **Step 2: Rulează — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/templates.test.ts`
Expected: FAIL (tipul `'SUSPENDAT'` cu drawers aruncă azi „sertarele sunt permise doar la tipul SERTARE").

- [ ] **Step 3: Implementează**

`lib/engine/types.ts`:
- `export type CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT';`
- Comentariile: `doors: number; // 0 = fără uși; exclusiv cu drawers` și `drawers?: DrawerOptions; // sertare pe orice tip de corp; exclusiv cu doors`.

`lib/engine/templates.ts` — înlocuiește cele 4 validări de la începutul `expandCabinet` cu:

```ts
  const drawerCount = input.drawers?.count ?? 0;
  if (input.drawers && drawerCount <= 0) {
    throw new Error(`Corpul ${input.label}: sertarele cer cel puțin un sertar`);
  }
  if (drawerCount > 0 && input.doors > 0) {
    throw new Error(`Corpul ${input.label}: alege fie uși, fie sertare, nu ambele`);
  }
  if (drawerCount > 0 && input.shelves > 0) {
    throw new Error(`Corpul ${input.label}: corpul cu sertare nu poate avea polițe`);
  }
  if ((input.doors > 0 || drawerCount > 0) && !input.frontMaterialId) {
    throw new Error(`Corpul ${input.label}: fronturile cer un material de front`);
  }
```

și mai jos: `const boxes = drawerCount > 0 ? expandDrawerBoxes(input, catalogs, cc) : { parts: [], warnings: [] };`

`lib/engine/fronts.ts`: în `expandFronts`, `if (input.type === 'SERTARE')` → `if ((input.drawers?.count ?? 0) > 0)`.

`lib/engine/hardware.ts`: `const LEGGED_TYPES = new Set(['BAZA', 'INALT', 'COLT']);`

`lib/engine/costing.ts`: `const BASE_RUN_TYPES = new Set<CabinetType>(['BAZA', 'COLT']);`

- [ ] **Step 4: Repară fixture-urile din celelalte teste**

În `fronts.test.ts`, `drawers.test.ts`, `hardware.test.ts`: înlocuiește `type: 'SERTARE'` cu `type: 'BAZA'` (input-urile au deja `doors: 0`; adaugă `shelves: 0` unde lipsește și e cerut de noua validare — doar la testele care trec prin `expandCabinet`; funcțiile unitare `expandDrawerBoxes`/`expandFronts` nu validează).

Run: `npx vitest run lib/engine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engine
git commit -m "feat(engine): dispare tipul SERTARE; sertare pe orice corp, uși XOR sertare"
```

---

### Task 6: Formular — schema `frontType`/`withShelves` + `toCabinetInput`

**Files:**
- Modify: `lib/quote/cabinet-form.ts`
- Create: `lib/quote/__tests__/cabinet-form.test.ts`

**Interfaces:**
- Consumes: `CabinetInput` fără tipul SERTARE (Task 5).
- Produces: `cabinetFormSchema` cu câmpurile noi `frontType: 'USI'|'SERTARE'|'FARA'`, `withShelves: checkbox`; `toCabinetInput(d)` construiește `doors/shelves/drawers` din ele. Task 7 (UI) depinde de numele exacte ale câmpurilor.

- [ ] **Step 1: Scrie testele**

Creează `lib/quote/__tests__/cabinet-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cabinetFormSchema, toCabinetInput } from '../cabinet-form';

const base = {
  label: 'C1', type: 'BAZA',
  widthMm: '600', heightMm: '720', depthMm: '560',
  shelves: '1', doors: '1',
  frontType: 'USI', withShelves: 'true',
  carcassMaterialId: 'pal', frontMaterialId: 'pal',
  backEnabled: 'true', backMaterialId: 'pfl', backMount: 'FALT',
  carcassFrontEdgeId: 'abs04', frontPerimeterId: '',
  blindPanelWidthMm: '',
  drawersCount: '0', drawersSystem: 'METAL_BOX',
  drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
};

describe('cabinetFormSchema + toCabinetInput', () => {
  it('uși cu polițe: doors și shelves trec, drawers lipsește', () => {
    const input = toCabinetInput(cabinetFormSchema.parse(base));
    expect(input.doors).toBe(1);
    expect(input.shelves).toBe(1);
    expect(input.drawers).toBeUndefined();
  });

  it('uși fără polițe (corp chiuvetă): shelves devine 0', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({ ...base, withShelves: 'false' }));
    expect(input.shelves).toBe(0);
    expect(input.doors).toBe(1);
  });

  it('sertare: doors și shelves devin 0, înălțimile per sertar se transmit', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({
      ...base, frontType: 'SERTARE', drawersCount: '3',
      drawersBottomMaterialId: 'pfl', drawerFrontHeightsMm: '200, 258, 258',
    }));
    expect(input.doors).toBe(0);
    expect(input.shelves).toBe(0);
    expect(input.drawers).toEqual({
      count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl',
      frontHeightsMm: [200, 258, 258],
    });
  });

  it('sertare fără fund → eroare de validare', () => {
    const r = cabinetFormSchema.safeParse({ ...base, frontType: 'SERTARE', drawersCount: '2', drawersBottomMaterialId: '' });
    expect(r.success).toBe(false);
  });

  it('sertare cu număr de înălțimi diferit de numărul de sertare → eroare', () => {
    const r = cabinetFormSchema.safeParse({
      ...base, frontType: 'SERTARE', drawersCount: '3',
      drawersBottomMaterialId: 'pfl', drawerFrontHeightsMm: '200, 258',
    });
    expect(r.success).toBe(false);
  });

  it('uși fără material de front → eroare', () => {
    const r = cabinetFormSchema.safeParse({ ...base, frontMaterialId: '' });
    expect(r.success).toBe(false);
  });

  it('fără front: doors 0, drawers lipsește, frontMaterialId null, polițele rămân', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({ ...base, frontType: 'FARA', shelves: '2' }));
    expect(input.doors).toBe(0);
    expect(input.drawers).toBeUndefined();
    expect(input.frontMaterialId).toBeNull();
    expect(input.shelves).toBe(2);
  });
});
```

- [ ] **Step 2: Rulează — trebuie să pice**

Run: `npx vitest run lib/quote/__tests__/cabinet-form.test.ts`
Expected: FAIL — `frontType` necunoscut în schemă.

- [ ] **Step 3: Implementează în `lib/quote/cabinet-form.ts`**

Înlocuiește schema și `toCabinetInput` cu:

```ts
export const cabinetFormSchema = z
  .object({
    label: z.string().trim().min(1),
    type: z.enum(['BAZA', 'SUSPENDAT', 'INALT', 'COLT']),
    widthMm: posNum,
    heightMm: posNum,
    depthMm: posNum,
    frontType: z.enum(['USI', 'SERTARE', 'FARA']),
    withShelves: checkbox,
    shelves: intNonNeg,
    doors: intNonNeg,
    carcassMaterialId: z.string().min(1),
    frontMaterialId: optStr,
    backEnabled: checkbox,
    backMaterialId: optStr,
    backMount: z.enum(['FALT', 'APLICAT']),
    carcassFrontEdgeId: z.string().min(1),
    frontPerimeterId: optStr,
    blindPanelWidthMm: z.preprocess(emptyToUndefined, posNum.optional()),
    drawersCount: intNonNeg.default(0),
    drawersSystem: z.enum(['PAL_BOX', 'METAL_BOX']).default('METAL_BOX'),
    drawersBottomMaterialId: optStr,
    drawerFrontHeightsMm: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine((d) => d.frontType !== 'USI' || d.doors >= 1, {
    message: 'Corpul cu uși are nevoie de cel puțin o ușă',
  })
  .refine((d) => d.frontType !== 'SERTARE' || d.drawersCount >= 1, {
    message: 'Corpul cu sertare are nevoie de cel puțin un sertar',
  })
  .refine((d) => d.frontType !== 'SERTARE' || !!d.drawersBottomMaterialId, {
    message: 'Alege materialul pentru fundul sertarelor',
  })
  .refine((d) => d.frontType === 'FARA' || !!d.frontMaterialId, {
    message: 'Fronturile cer un material de front',
  })
  .refine((d) => {
    if (d.frontType !== 'SERTARE' || !d.drawerFrontHeightsMm) return true;
    const heights = parseDrawerHeights(d.drawerFrontHeightsMm);
    return heights.length === d.drawersCount && heights.every((h) => h > 0);
  }, { message: 'Înălțimile sertarelor nu corespund cu numărul de sertare' })
  .refine((d) => !d.backEnabled || !!d.backMaterialId, {
    message: 'Alege materialul pentru spate',
  });

export type CabinetFormData = z.infer<typeof cabinetFormSchema>;

export function parseDrawerHeights(s: string): number[] {
  return s
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
}

export function toCabinetInput(d: CabinetFormData): CabinetInput {
  const heights = d.drawerFrontHeightsMm ? parseDrawerHeights(d.drawerFrontHeightsMm) : [];
  return {
    label: d.label,
    type: d.type,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    depthMm: d.depthMm,
    shelves: d.frontType === 'SERTARE' ? 0 : (d.frontType === 'USI' && !d.withShelves ? 0 : d.shelves),
    doors: d.frontType === 'USI' ? d.doors : 0,
    drawers:
      d.frontType === 'SERTARE'
        ? {
            count: d.drawersCount,
            system: d.drawersSystem,
            bottomMaterialId: d.drawersBottomMaterialId!,
            frontHeightsMm: heights.length > 0 ? heights : undefined,
          }
        : undefined,
    carcassMaterialId: d.carcassMaterialId,
    frontMaterialId: d.frontType === 'FARA' ? null : (d.frontMaterialId ?? null),
    back: { enabled: d.backEnabled, materialId: d.backMaterialId, mount: d.backMount },
    edgeBands: {
      carcassFrontEdgeId: d.carcassFrontEdgeId,
      frontPerimeterId: d.frontPerimeterId ?? null,
    },
    blindPanelWidthMm: d.type === 'COLT' ? d.blindPanelWidthMm : undefined,
  };
}
```

(`extraPartSchema` rămâne neschimbat.)

- [ ] **Step 4: Rulează testele**

Run: `npx vitest run lib/quote`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quote
git commit -m "feat(form): frontType uși/sertare/fără + withShelves în schema corpului"
```

---

### Task 7: Editor UI — cardul „Fronturi", rânduri per sertar, migrarea valorilor inițiale

**Files:**
- Modify: `components/CabinetEditorForm.tsx`
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (`cabinetInputToFormValues`)
- Modify: `app/proiecte/[id]/page.tsx`, `app/proiecte/[id]/oferta/page.tsx` (etichete tip fără SERTARE)

**Interfaces:**
- Consumes: schema din Task 6 (`frontType`, `withShelves`, `drawerFrontHeightsMm` — string cu virgulă, mereu explicit la sertare); `parseConstruction`-ul deja prezent în component (`cc.outerGapMm`, `cc.frontGapMm`).
- Produces: UI-ul final al editorului. Nicio interfață consumată de alte task-uri.

- [ ] **Step 1: `cabinetInputToFormValues` în pagina corpului**

Adaugă derivarea `frontType`/`withShelves` (corpurile vechi nu au câmpurile în JSON):

```ts
function cabinetInputToFormValues(input: CabinetInput): Record<string, string> {
  const frontType = input.drawers && input.drawers.count > 0 ? 'SERTARE' : input.doors > 0 ? 'USI' : 'FARA';
  return {
    label: input.label,
    type: input.type,
    frontType,
    withShelves: input.shelves > 0 ? 'true' : 'false',
    widthMm: String(input.widthMm),
    heightMm: String(input.heightMm),
    depthMm: String(input.depthMm),
    // chiuvetă (uși, 0 polițe): câmpul pornește de la 1 ca bifarea „Cu polițe" să aibă o valoare;
    // la FARA păstrăm 0 real (etajera fără polițe rămâne fără)
    shelves: String(input.shelves > 0 ? input.shelves : input.doors > 0 ? 1 : 0),
    doors: String(Math.max(input.doors, 1)),
    carcassMaterialId: input.carcassMaterialId,
    frontMaterialId: input.frontMaterialId ?? '',
    backEnabled: input.back.enabled ? 'true' : 'false',
    backMaterialId: input.back.materialId ?? '',
    backMount: input.back.mount,
    carcassFrontEdgeId: input.edgeBands.carcassFrontEdgeId,
    frontPerimeterId: input.edgeBands.frontPerimeterId ?? '',
    blindPanelWidthMm: input.blindPanelWidthMm != null ? String(input.blindPanelWidthMm) : '',
    drawersCount: String(input.drawers?.count ?? 0),
    drawersSystem: input.drawers?.system ?? 'METAL_BOX',
    drawersBottomMaterialId: input.drawers?.bottomMaterialId ?? '',
    drawerFrontHeightsMm: input.drawers?.frontHeightsMm?.join(', ') ?? '',
  };
}
```

(`shelves`/`doors` cu `Math.max(...,1)` ca la comutarea pe USI/„Cu polițe" câmpurile să nu pornească de la 0 — valorile reale se decid prin `frontType`/`withShelves` în `toCabinetInput`.)

- [ ] **Step 2: Rescrie secțiunea de fronturi din `CabinetEditorForm.tsx`**

- Șterge `'SERTARE'` din `TYPE_OPTIONS`; șterge funcția `onTypeChange` și folosește direct `onValueChange={(v) => set('type', v)}` pe RadioGroup-ul de tip:

```ts
const TYPE_OPTIONS: FieldOption[] = [
  { value: 'BAZA', label: 'Corp bază' },
  { value: 'SUSPENDAT', label: 'Corp suspendat' },
  { value: 'INALT', label: 'Corp înalt' },
  { value: 'COLT', label: 'Corp de colț' },
];

const FRONT_TYPE_OPTIONS: FieldOption[] = [
  { value: 'USI', label: 'Uși' },
  { value: 'SERTARE', label: 'Sertare' },
  { value: 'FARA', label: 'Fără front' },
];

const DOOR_SPLIT_WIDTH_MM = 600; // convenția atelierului: peste 600mm → 2 uși
```

- Adaugă în componentă (lângă `const set = ...`) logica de fronturi:

```ts
const frontType = values.frontType;
const withShelves = values.withShelves === 'true';
const drawersCount = Math.max(0, Math.trunc(Number(values.drawersCount) || 0));

const autoDoors = (widthMm: number) => (widthMm <= DOOR_SPLIT_WIDTH_MM ? 1 : 2);
// ușile se precompletează după lățime cât timp utilizatorul nu le-a atins
const [doorsTouched, setDoorsTouched] = useState(
  () => Number(initial.doors) !== autoDoors(Number(initial.widthMm)),
);
const onWidthChange = (v: string) => {
  setValues((prev) => ({
    ...prev, widthMm: v,
    ...(prev.frontType === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(v))) } : {}),
  }));
};

const equalHeights = (heightMm: number, n: number) => {
  const usable = heightMm - 2 * cc.outerGapMm - (n - 1) * cc.frontGapMm;
  return Array.from({ length: n }, () => Math.round((usable / n) * 10) / 10);
};
const drawerHeights = (values.drawerFrontHeightsMm ?? '')
  .split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
const onDrawersCountChange = (v: string) => {
  const n = Math.max(0, Math.trunc(Number(v) || 0));
  setValues((prev) => ({
    ...prev, drawersCount: v,
    drawerFrontHeightsMm: n > 0 ? equalHeights(Number(prev.heightMm), n).join(', ') : '',
  }));
};
const setDrawerHeight = (i: number, v: string) => {
  const next = [...drawerHeights];
  next[i] = Number(v);
  set('drawerFrontHeightsMm', next.join(', '));
};
const usableDrawerH = Number(values.heightMm) - 2 * cc.outerGapMm - (drawersCount - 1) * cc.frontGapMm;
const drawerSum = drawerHeights.reduce((a, b) => a + b, 0);
const drawerSumMismatch = drawersCount > 0 && drawerHeights.length === drawersCount
  && Math.abs(drawerSum - usableDrawerH) > 1;
```

și schimbă `NumField`-ul de lățime să folosească `onWidthChange`, iar câmpul de uși să seteze `doorsTouched`:

```tsx
<NumField label="Lățime L (mm)" value={values.widthMm} onChange={onWidthChange} />
```

- Înlocuiește blocul `{isSertare ? (...) : (...)}` (cardurile „Sertare" / „Uși și polițe") cu un singur card „Fronturi":

```tsx
<Card>
  <CardHeader><CardTitle>Fronturi</CardTitle></CardHeader>
  <CardContent className="space-y-4">
    <RadioGroup
      value={frontType}
      onValueChange={(v) => setValues((prev) => ({
        ...prev, frontType: v,
        ...(v === 'USI' && !doorsTouched ? { doors: String(autoDoors(Number(prev.widthMm))) } : {}),
        ...(v === 'SERTARE' && drawersCount === 0
          ? { drawersCount: '3', drawerFrontHeightsMm: equalHeights(Number(prev.heightMm), 3).join(', ') }
          : {}),
      }))}
      className="flex flex-wrap gap-4"
    >
      {FRONT_TYPE_OPTIONS.map((o) => (
        <div key={o.value} className="flex items-center gap-2">
          <RadioGroupItem value={o.value} id={`front-${o.value}`} />
          <Label htmlFor={`front-${o.value}`} className="font-normal">{o.label}</Label>
        </div>
      ))}
    </RadioGroup>

    {frontType === 'USI' && (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Uși" value={values.doors} onChange={(v) => { setDoorsTouched(true); set('doors', v); }} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="withShelves"
            checked={withShelves}
            onCheckedChange={(c) => set('withShelves', c === true ? 'true' : 'false')}
          />
          <Label htmlFor="withShelves" className="font-normal">Cu polițe (debifează la corpul de chiuvetă)</Label>
        </div>
        {withShelves && (
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Convenție atelier: până în 600mm lățime → 1 ușă; peste → 2 uși.
        </p>
      </div>
    )}

    {frontType === 'SERTARE' && (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <NumField label="Nr. sertare" value={values.drawersCount} onChange={onDrawersCountChange} />
          <SelectField label="Sistem sertare" value={values.drawersSystem} onChange={(v) => set('drawersSystem', v)} options={DRAWER_SYSTEM_OPTIONS} />
          <SelectField label="Fund sertare" value={values.drawersBottomMaterialId} onChange={(v) => set('drawersBottomMaterialId', v)} options={materialOptions.drawersBottom} allowEmpty />
        </div>
        {drawersCount > 0 && (
          <div className="space-y-2">
            {Array.from({ length: drawersCount }, (_, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-3">
                <Label className="font-normal">{i === 0 ? 'Sertar 1 (sus)' : `Sertar ${i + 1}`}</Label>
                <NumField label="Înălțime front (mm)" value={String(drawerHeights[i] ?? '')} onChange={(v) => setDrawerHeight(i, v)} />
              </div>
            ))}
            {drawerSumMismatch && (
              <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                ⚠ Suma fronturilor ({fmtNum(drawerSum, 1)}mm) nu se încadrează — util {fmtNum(usableDrawerH, 1)}mm
                (înălțime corp minus rosturi).
              </p>
            )}
          </div>
        )}
      </div>
    )}

    {frontType === 'FARA' && (
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Număr polițe" value={values.shelves} onChange={(v) => set('shelves', v)} />
      </div>
    )}
  </CardContent>
</Card>
```

- Șterge variabila `isSertare` (nu mai e folosită).

- [ ] **Step 3: Curăță etichetele SERTARE din pagini**

- `app/proiecte/[id]/page.tsx`: din maparea `BAZA: 'Bază', ..., SERTARE: 'Sertare', ...` șterge `SERTARE: 'Sertare',`.
- `app/proiecte/[id]/oferta/page.tsx`: șterge `SERTARE: 'Corp cu sertare',` din `TYPE_LABELS`. (Fallback-ul `?? c.input.type` acoperă corpurile nemigrate până la Task 8.)

- [ ] **Step 4: Verificare**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: toate trec. Apoi pornește `npm run dev` și verifică manual: corp nou → card „Fronturi", comutare Uși/Sertare/Fără, rânduri per sertar cu împărțire egală, bifă polițe, preț live se actualizează.

- [ ] **Step 5: Commit**

```bash
git add components app
git commit -m "feat(ui): card Fronturi cu uși/sertare/fără, rânduri per sertar, bifă polițe"
```

---

### Task 8: Migrarea corpurilor existente SERTARE → BAZA

**Files:**
- Create: `lib/quote/migrate-sertare.ts`
- Create: `lib/quote/__tests__/migrate-sertare.test.ts`
- Create: `scripts/migrate-sertare.ts`

**Interfaces:**
- Produces: `migrateSertareInput(input)` → `{ input: CabinetInput; changed: boolean }`; script idempotent rulabil cu `npx tsx`.

- [ ] **Step 1: Scrie testul**

`lib/quote/__tests__/migrate-sertare.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { migrateSertareInput } from '../migrate-sertare';

const legacy = {
  label: 'S1', type: 'SERTARE' as const,
  widthMm: 600, heightMm: 720, depthMm: 560,
  shelves: 0, doors: 0,
  drawers: { count: 3, system: 'METAL_BOX' as const, bottomMaterialId: 'pfl' },
  carcassMaterialId: 'pal', frontMaterialId: 'pal',
  back: { enabled: true as const, materialId: 'pfl', mount: 'FALT' as const },
  edgeBands: { carcassFrontEdgeId: 'abs04', frontPerimeterId: null },
};

describe('migrateSertareInput', () => {
  it('SERTARE devine BAZA cu drawers păstrat', () => {
    const { input, changed } = migrateSertareInput(legacy);
    expect(changed).toBe(true);
    expect(input.type).toBe('BAZA');
    expect(input.drawers).toEqual(legacy.drawers);
  });

  it('corp deja migrat rămâne neschimbat', () => {
    const { input, changed } = migrateSertareInput({ ...legacy, type: 'BAZA' });
    expect(changed).toBe(false);
    expect(input.type).toBe('BAZA');
  });
});
```

- [ ] **Step 2: Rulează — FAIL (modulul lipsește)**

Run: `npx vitest run lib/quote/__tests__/migrate-sertare.test.ts`

- [ ] **Step 3: Implementează**

`lib/quote/migrate-sertare.ts`:

```ts
import type { CabinetInput } from '@/lib/engine';

// inputJson vechi poate avea tipul dispărut 'SERTARE'
export type LegacyCabinetInput = Omit<CabinetInput, 'type'> & {
  type: CabinetInput['type'] | 'SERTARE';
};

export function migrateSertareInput(
  input: LegacyCabinetInput,
): { input: CabinetInput; changed: boolean } {
  if (input.type !== 'SERTARE') return { input: input as CabinetInput, changed: false };
  return { input: { ...input, type: 'BAZA' }, changed: true };
}
```

`scripts/migrate-sertare.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { migrateSertareInput, type LegacyCabinetInput } from '../lib/quote/migrate-sertare';

const prisma = new PrismaClient();

async function main() {
  const cabinets = await prisma.cabinet.findMany();
  let migrated = 0;
  for (const cab of cabinets) {
    const legacy = JSON.parse(cab.inputJson) as LegacyCabinetInput;
    const { input, changed } = migrateSertareInput(legacy);
    if (!changed) continue;
    await prisma.cabinet.update({
      where: { id: cab.id },
      data: { inputJson: JSON.stringify(input) },
    });
    migrated += 1;
  }
  console.log(`Migrate: ${migrated} corpuri SERTARE → BAZA (din ${cabinets.length} total).`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Testează și rulează migrarea**

Run: `npx vitest run lib/quote` → PASS.
Run: `npx tsx scripts/migrate-sertare.ts`
Expected: `Migrate: N corpuri SERTARE → BAZA (din M total).` Rulează a doua oară → `Migrate: 0 corpuri...` (idempotent).

- [ ] **Step 5: Commit**

```bash
git add lib/quote scripts
git commit -m "feat(migrate): corpurile SERTARE existente devin BAZA + sertare"
```

---

### Task 9: Geometria izometrică — funcția pură `buildIsoModel`

**Files:**
- Create: `lib/iso/geometry.ts`
- Create: `lib/iso/__tests__/geometry.test.ts`

**Interfaces:**
- Consumes: `CabinetInput`, `ConstructionConstants` din `@/lib/engine`.
- Produces (Task 10 depinde de ele):

```ts
export interface IsoFrontRect {
  kind: 'USA' | 'SERTAR' | 'PANOU_ORB';
  xMm: number; yMm: number; wMm: number; hMm: number; // plan frontal, origine colț stânga-JOS al corpului
  handle?: { xMm: number; yMm: number };
}
export interface CabinetIsoModel {
  widthMm: number; heightMm: number; depthMm: number;
  shelfYsMm: number[]; // pozițiile y (de jos) ale polițelor, egal distribuite
  fronts: IsoFrontRect[];
}
export function buildIsoModel(input: CabinetInput, cc: ConstructionConstants): CabinetIsoModel;
```

- [ ] **Step 1: Scrie testele**

`lib/iso/__tests__/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import type { CabinetInput } from '@/lib/engine';
import { buildIsoModel } from '../geometry';

const cc = { ...DEFAULT_CONSTRUCTION, frontGapMm: 2, outerGapMm: 1 };

function corp(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return {
    label: 'C1', type: 'BAZA',
    widthMm: 800, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 2,
    carcassMaterialId: 'pal', frontMaterialId: 'pal',
    back: { enabled: true, materialId: 'pfl', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs', frontPerimeterId: null },
    ...overrides,
  };
}

describe('buildIsoModel', () => {
  it('2 uși: lățimi egale, rost între ele, mânere prezente', () => {
    const m = buildIsoModel(corp(), cc);
    const doors = m.fronts.filter((f) => f.kind === 'USA');
    expect(doors).toHaveLength(2);
    // lățime utilă = 800 − 2×1 = 798; ușă = (798 − 2) / 2 = 398
    expect(doors[0].wMm).toBeCloseTo(398, 5);
    expect(doors[1].xMm - (doors[0].xMm + doors[0].wMm)).toBeCloseTo(2, 5); // rostul
    expect(doors.every((d) => d.handle)).toBe(true);
  });

  it('sertare: stivă de sus în jos cu înălțimile date', () => {
    const m = buildIsoModel(corp({
      doors: 0, shelves: 0,
      drawers: { count: 2, system: 'METAL_BOX', bottomMaterialId: 'pfl', frontHeightsMm: [300, 416] },
    }), cc);
    const s = m.fronts.filter((f) => f.kind === 'SERTAR');
    expect(s).toHaveLength(2);
    // primul sertar e sus: marginea lui superioară = 720 − 1 (outerGap)
    expect(s[0].yMm + s[0].hMm).toBeCloseTo(719, 5);
    expect(s[0].hMm).toBeCloseTo(300, 5);
    // al doilea începe sub primul, cu rost
    expect(s[1].yMm + s[1].hMm).toBeCloseTo(s[0].yMm - 2, 5);
  });

  it('sertare fără înălțimi explicite: împărțire egală', () => {
    const m = buildIsoModel(corp({
      doors: 0, shelves: 0,
      drawers: { count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl' },
    }), cc);
    const s = m.fronts.filter((f) => f.kind === 'SERTAR');
    expect(s).toHaveLength(3);
    // util = 720 − 2×1 − 2×2 = 714 → 238 fiecare
    expect(s[0].hMm).toBeCloseTo(238, 5);
  });

  it('COLT: panou orb la stânga, ușa în restul lățimii', () => {
    const m = buildIsoModel(corp({ type: 'COLT', doors: 1, blindPanelWidthMm: 100 }), cc);
    const blind = m.fronts.find((f) => f.kind === 'PANOU_ORB');
    const door = m.fronts.find((f) => f.kind === 'USA');
    expect(blind).toBeDefined();
    expect(blind!.wMm).toBeCloseTo(100, 5);
    expect(door!.xMm).toBeGreaterThan(blind!.xMm + blind!.wMm - 0.001);
  });

  it('polițele sunt egal distribuite pe înălțime', () => {
    const m = buildIsoModel(corp({ shelves: 2 }), cc);
    expect(m.shelfYsMm).toHaveLength(2);
    expect(m.shelfYsMm[0]).toBeCloseTo(240, 5); // 720 × 1/3
    expect(m.shelfYsMm[1]).toBeCloseTo(480, 5); // 720 × 2/3
  });

  it('fără front: niciun dreptunghi de front', () => {
    const m = buildIsoModel(corp({ doors: 0, frontMaterialId: null }), cc);
    expect(m.fronts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rulează — FAIL (modulul lipsește)**

Run: `npx vitest run lib/iso`

- [ ] **Step 3: Implementează `lib/iso/geometry.ts`**

```ts
import type { CabinetInput, ConstructionConstants } from '@/lib/engine';

export interface IsoFrontRect {
  kind: 'USA' | 'SERTAR' | 'PANOU_ORB';
  xMm: number; yMm: number; wMm: number; hMm: number; // plan frontal, origine colț stânga-jos
  handle?: { xMm: number; yMm: number };
}

export interface CabinetIsoModel {
  widthMm: number; heightMm: number; depthMm: number;
  shelfYsMm: number[];
  fronts: IsoFrontRect[];
}

const HANDLE_INSET_MM = 40; // distanța mânerului față de marginea ușii

export function buildIsoModel(input: CabinetInput, cc: ConstructionConstants): CabinetIsoModel {
  const { widthMm: W, heightMm: H, depthMm: D } = input;
  const g = cc.outerGapMm;
  const gap = cc.frontGapMm;
  const fronts: IsoFrontRect[] = [];

  const drawerCount = input.drawers?.count ?? 0;
  const hasFronts = input.frontMaterialId !== null && (input.doors > 0 || drawerCount > 0);

  const blindW = input.type === 'COLT' && hasFronts ? (input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm) : 0;
  const frontX0 = g + blindW;
  const usableW = W - 2 * g - blindW;
  const frontH = H - 2 * g;

  if (blindW > 0) {
    fronts.push({ kind: 'PANOU_ORB', xMm: g, yMm: g, wMm: blindW, hMm: frontH });
  }

  if (hasFronts && drawerCount > 0) {
    const heights = input.drawers!.frontHeightsMm
      ?? Array.from({ length: drawerCount }, () => (H - 2 * g - (drawerCount - 1) * gap) / drawerCount);
    let topY = H - g; // sertarul 1 e sus
    for (const h of heights) {
      fronts.push({
        kind: 'SERTAR', xMm: frontX0, yMm: topY - h, wMm: usableW, hMm: h,
        handle: { xMm: frontX0 + usableW / 2, yMm: topY - HANDLE_INSET_MM },
      });
      topY -= h + gap;
    }
  } else if (hasFronts && input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * gap) / input.doors;
    for (let i = 0; i < input.doors; i++) {
      const x = frontX0 + i * (doorW + gap);
      // mânerul pe muchia dinspre mijloc la 2 uși; pe dreapta la o singură ușă
      const handleX = input.doors === 2 && i === 0 ? x + doorW - HANDLE_INSET_MM
        : input.doors === 2 ? x + HANDLE_INSET_MM
        : x + doorW - HANDLE_INSET_MM;
      fronts.push({
        kind: 'USA', xMm: x, yMm: g, wMm: doorW, hMm: frontH,
        handle: { xMm: handleX, yMm: g + frontH / 2 },
      });
    }
  }

  const shelfYsMm = drawerCount > 0 ? [] :
    Array.from({ length: input.shelves }, (_, i) => (H * (i + 1)) / (input.shelves + 1));

  return { widthMm: W, heightMm: H, depthMm: D, shelfYsMm, fronts };
}
```

- [ ] **Step 4: Rulează testele**

Run: `npx vitest run lib/iso`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/iso
git commit -m "feat(iso): buildIsoModel — geometria pură a previzualizării corpului"
```

---

### Task 10: Componentul `CabinetIsoSvg` + integrarea în editor

**Files:**
- Create: `components/CabinetIsoSvg.tsx`
- Modify: `components/CabinetEditorForm.tsx` (card „Previzualizare" sub „Piese generate")

**Interfaces:**
- Consumes: `buildIsoModel`, `CabinetIsoModel` din `@/lib/iso/geometry`; `live.input` și `cc` deja existente în editor.
- Produces: `<CabinetIsoSvg input={CabinetInput} cc={ConstructionConstants} />`.

- [ ] **Step 1: Scrie componentul**

`components/CabinetIsoSvg.tsx` — proiecție izometrică standard (axa x = lățime spre dreapta, z = adâncime spre stânga-sus, y = înălțime):

```tsx
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
```

- [ ] **Step 2: Integrează în editor**

În `components/CabinetEditorForm.tsx`, importă `CabinetIsoSvg` și adaugă imediat DUPĂ cardul „Piese generate" (în coloana din dreapta):

```tsx
{live && !live.expandError && (
  <Card>
    <CardHeader><CardTitle>Previzualizare</CardTitle></CardHeader>
    <CardContent>
      <CabinetIsoSvg input={live.input} cc={cc} />
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Verificare vizuală**

Run: `npx tsc --noEmit && npm test && npm run build` → toate trec.
Apoi `npm run dev`, deschide un corp și verifică: desenul apare, ușile au rost + mâner, sertarele se restivuiesc când schimbi înălțimile, panoul orb hașurat la COLT, polițele vizibile, cotele L/H/A corecte, desenul se actualizează live la orice modificare.

- [ ] **Step 4: Commit**

```bash
git add components
git commit -m "feat(preview): CabinetIsoSvg — previzualizare izometrică sub piesele generate"
```

---

### Task 11: Verificare finală end-to-end

**Files:** niciunul nou.

- [ ] **Step 1: Suita completă + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: totul verde.

- [ ] **Step 2: Smoke pe fluxul real**

Run: `npx tsx scripts/smoke-quote.ts`
Expected: rulează fără eroare și afișează un preț.

- [ ] **Step 3: Verificare manuală în browser (`npm run dev`)**

1. Proiect existent cu corp fost-SERTARE → se deschide ca „Corp bază" cu Fronturi = Sertare, înălțimile per sertar populate.
2. Corp nou → Uși default (1 ușă la 600mm; schimbă lățimea la 800 → devine 2 uși automat).
3. Debifează „Cu polițe" → polița dispare din „Piese generate" și din desen.
4. Fronturi = Sertare, 3 sertare → rânduri egale; modifică Sertar 1 la 150 → avertizare de sumă dacă nu mai încape, desen restivuit.
5. Setări → „Manoperă implicită (% din materiale)"; pagina proiect → „Manoperă (%)", prețul de vânzare = materiale × (1+%) + linii libere (verifică cu o linie liberă de 100 lei).
6. Pagina `/cataloage/manopera` nu mai există (404) și nu mai apare în navigație.

- [ ] **Step 4: Commit final (dacă au rămas modificări) și actualizare memorie proiect**

Actualizează `MEMORY.md`-ul proiectului (memoria auto a agentului) cu noul stadiu: fronturi v2 + preview izometric + manoperă % livrate.

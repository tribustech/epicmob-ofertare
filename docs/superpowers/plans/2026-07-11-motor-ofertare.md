# Motor de calcul ofertare (Plan 1/2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundația proiectului Next.js + motorul de calcul complet (corpuri parametrice → piese, feronerie sugerată, necesar materiale, cost în 6 categorii, listă debitare CSV), cu teste pe fiecare modul.

**Architecture:** Motorul e TypeScript pur în `lib/engine/`, fără dependență de DB/Next.js: primește corpuri + cataloage, întoarce piese/costuri/avertismente. Aplicația web (DB, UI, PDF) vine în Planul 2 și doar consumă acest motor. Spec: `docs/superpowers/specs/2026-07-11-ofertare-mobila-design.md`.

**Tech Stack:** Next.js 15 (App Router, TypeScript strict), Vitest 3.

## Global Constraints

- Toate dimensiunile în **mm** (numere, pot avea zecimale); ariile în m²; lungimile de cant în ml; banii în RON ca `number` (comparații în teste cu `toBeCloseTo`).
- Motorul (`lib/engine/**`) NU importă nimic din Next.js, React sau DB — doar TypeScript pur.
- Nicio constantă de construcție hardcodată în formule — totul vine din `ConstructionConstants` (parametru).
- Validările motorului sunt **avertismente** (`Warning[]`), nu excepții; excepție (throw `Error`) doar pentru date imposibile (material inexistent în catalog, dimensiuni ≤ 0).
- Denumirile de domeniu în stringuri sunt în română („Laterală", „Poliță", „Spate"); identificatorii de cod în engleză.
- TypeScript `strict: true`; testele rulează cu `npm test` (vitest run).
- Commit după fiecare task, mesaje conventional commits (`feat:`, `chore:`, `test:`).

## File Structure

```
epic-mob-ofertare/
├── app/                        # Next.js minim (doar schelet în planul 1)
│   ├── layout.tsx
│   └── page.tsx
├── lib/engine/
│   ├── types.ts                # toate tipurile motorului
│   ├── constants.ts            # DEFAULT_CONSTRUCTION
│   ├── carcass.ts              # expandCarcass: laterale, blat/fund, polițe, spate
│   ├── fronts.ts               # împărțire fronturi (uși / fronturi sertar / panou orb)
│   ├── hinges.ts               # suggestHingeCount, doorWeightKg
│   ├── drawers.ts              # pickSlideNominal, expandDrawerBoxes
│   ├── hardware.ts             # suggestHardware, resolveSuggestions
│   ├── templates.ts            # expandCabinet (BAZA/SUSPENDAT/INALT/SERTARE/COLT)
│   ├── needs.ts                # computeMaterialNeeds (foi, m², ml cant)
│   ├── costing.ts              # computeCosts (6 categorii, adaos, lei/ml)
│   ├── cutlist.ts              # cutListCsv, aggregateHardware
│   ├── index.ts                # computeProject + re-exporturi
│   └── __tests__/              # un fișier de test per modul
├── docs/superpowers/{specs,plans}/
├── package.json / tsconfig.json / vitest.config.ts / next.config.ts / .gitignore
```

---

### Task 1: Schelet proiect (Next.js + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `lib/engine/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: proiect care rulează `npm test` (vitest) și `npm run build` (Next.js). Toate task-urile următoare presupun acest schelet.

- [ ] **Step 1: Creează fișierele de configurare**

`package.json`:
```json
{
  "name": "epic-mob-ofertare",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['lib/**/__tests__/**/*.test.ts'],
  },
});
```

`.gitignore`:
```
node_modules/
.next/
*.tsbuildinfo
next-env.d.ts
.env*
!.env.example
.DS_Store
```

`app/layout.tsx`:
```tsx
import type { ReactNode } from 'react';

export const metadata = { title: 'EpicMob Ofertare' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return <main>EpicMob Ofertare</main>;
}
```

`lib/engine/__tests__/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('vitest rulează', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: Instalează dependențele**

Run: `npm install`
Expected: instalare fără erori, se creează `package-lock.json`.

- [ ] **Step 3: Verifică testele și build-ul**

Run: `npm test`
Expected: `1 passed` (smoke.test.ts).

Run: `npm run build`
Expected: build reușit („Compiled successfully").

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest project"
```

---

### Task 2: Tipuri și constante de construcție

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/constants.ts`
- Test: `lib/engine/__tests__/constants.test.ts`

**Interfaces:**
- Produces: toate tipurile de mai jos + `DEFAULT_CONSTRUCTION: ConstructionConstants`. Toate task-urile următoare importă din `./types` și `./constants`.

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/constants.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRUCTION } from '../constants';

describe('DEFAULT_CONSTRUCTION', () => {
  it('are valorile implicite din spec', () => {
    expect(DEFAULT_CONSTRUCTION.frontGapMm).toBe(3);
    expect(DEFAULT_CONSTRUCTION.outerGapMm).toBe(2);
    expect(DEFAULT_CONSTRUCTION.shelfSetbackMm).toBe(30);
    expect(DEFAULT_CONSTRUCTION.backRebateMm).toBe(4);
    expect(DEFAULT_CONSTRUCTION.slideNominalsMm).toContain(450);
    // PAL 18mm ≈ 12.5 kg/m² → 0.695 kg/m² per mm grosime
    expect(DEFAULT_CONSTRUCTION.boardDensityKgPerSqmPerMm * 18).toBeCloseTo(12.5, 0);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/constants.test.ts`
Expected: FAIL — `Cannot find module '../constants'`.

- [ ] **Step 3: Scrie tipurile și constantele**

`lib/engine/types.ts`:
```ts
// Unități: dimensiuni în mm, arii în m², cant în ml, bani în RON.

export type MaterialKind = 'PAL' | 'MDF_VOPSIT' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT' | 'PFL';

export type PricingMode =
  | { mode: 'PER_SHEET'; pricePerSheet: number }
  | { mode: 'PER_SQM'; pricePerSqm: number };

export interface BoardMaterial {
  id: string;
  name: string;
  kind: MaterialKind;
  thicknessMm: number;
  sheetLengthMm: number;
  sheetWidthMm: number;
  pricing: PricingMode;
}

export interface EdgeBand {
  id: string;
  name: string;
  thicknessMm: number;
  pricePerMl: number;
}

export type HardwareCategory =
  | 'BALAMA'
  | 'SERTAR'
  | 'MANER'
  | 'PICIOR'
  | 'SINA_SUSPENDARE'
  | 'ACCESORIU';

export interface HardwareItem {
  id: string;
  name: string;
  category: HardwareCategory;
  pricePerUnit: number;
  nominalLengthMm?: number;
  loadClassKg?: number;
}

export interface ConstructionConstants {
  frontGapMm: number;              // rost între fronturi
  outerGapMm: number;              // rost la marginea corpului (per latură)
  shelfSetbackMm: number;          // retragere poliță față de front
  backRebateMm: number;            // reducere spate în falț (per axă)
  boardDensityKgPerSqmPerMm: number; // greutate placă per m² per mm grosime
  slideClearanceMm: number;        // spațiu între glisieră și spatele corpului
  slideNominalsMm: number[];       // lungimi nominale glisiere disponibile
  palBoxSlideAllowanceMm: number;  // spațiu total lateral cutie sertar PAL (2×13)
  palBoxHeightDeductMm: number;    // înălțime cutie = front − această valoare
  palBoxMinHeightMm: number;       // înălțime minimă cutie
  metalBoxBottomDeductMm: number;  // lățime fund sertar metalic = interior − această valoare
  metalBoxBackHeightMm: number;    // înălțime spate sertar metalic
  legsPerCabinet: number;          // picioare per corp cu picioare
  shelfSpanWarnMm: number;         // avertizare poliță peste această deschidere
  doorMaxWidthMm: number;          // avertizare ușă peste această lățime
}

export type CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'SERTARE' | 'COLT';

export type DrawerSystem = 'PAL_BOX' | 'METAL_BOX';

export interface DrawerOptions {
  count: number;
  frontHeightsMm?: number[];       // dacă lipsește: împărțire egală
  system: DrawerSystem;
  bottomMaterialId: string;        // fund sertar (uzual PFL)
}

export interface CabinetInput {
  label: string;                   // ex. "B1"
  type: CabinetType;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  shelves: number;
  doors: number;                   // pentru BAZA/SUSPENDAT/INALT/COLT
  drawers?: DrawerOptions;         // pentru SERTARE
  carcassMaterialId: string;
  frontMaterialId: string | null;  // null = corp fără fronturi
  back: { enabled: boolean; materialId?: string; mount: 'FALT' | 'APLICAT' };
  edgeBands: {
    carcassFrontEdgeId: string;    // cant muchii frontale carcasă (uzual ABS 0.4)
    frontPerimeterId: string | null; // cant fronturi PAL (uzual ABS 1); MDF vopsit = fără
  };
  blindPanelWidthMm?: number;      // doar COLT; implicit 100
}

export interface PartEdges {
  l1?: string; // cant pe prima latură lungă (id EdgeBand)
  l2?: string;
  w1?: string; // cant pe prima latură scurtă
  w2?: string;
}

export interface Part {
  cabinetLabel: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  materialId: string;
  edges: PartEdges;
}

export interface FrontInfo {
  kind: 'USA' | 'SERTAR';
  widthMm: number;
  heightMm: number;
}

export interface HardwareSuggestion {
  category: HardwareCategory;
  name: string;
  qty: number;
  nominalLengthMm?: number;
}

export interface Warning {
  code: string;
  message: string;
  cabinetLabel?: string;
}

export interface Catalogs {
  materials: BoardMaterial[];
  edgeBands: EdgeBand[];
}

export interface ExpandedCabinet {
  input: CabinetInput;
  parts: Part[];
  hardware: HardwareSuggestion[];
  warnings: Warning[];
}

export interface HardwareDefaults {
  hingeId: string;
  slideIdsByNominal: Record<number, string>;
  handleId: string | null;
  legId: string | null;
  railId: string | null;
}

export interface HardwareLine {
  hardwareId: string;
  qty: number;
}

export interface CuttingRate {
  maxThicknessMm: number;
  pricePerSheet: number;
}

export interface FreeLine {
  name: string;
  amount: number;
}
```

`lib/engine/constants.ts`:
```ts
import type { ConstructionConstants } from './types';

export const DEFAULT_CONSTRUCTION: ConstructionConstants = {
  frontGapMm: 3,
  outerGapMm: 2,
  shelfSetbackMm: 30,
  backRebateMm: 4,
  boardDensityKgPerSqmPerMm: 0.695,
  slideClearanceMm: 30,
  slideNominalsMm: [270, 300, 350, 400, 450, 500, 550, 600, 650],
  palBoxSlideAllowanceMm: 26,
  palBoxHeightDeductMm: 60,
  palBoxMinHeightMm: 80,
  metalBoxBottomDeductMm: 87,
  metalBoxBackHeightMm: 70,
  legsPerCabinet: 4,
  shelfSpanWarnMm: 900,
  doorMaxWidthMm: 650,
};
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/types.ts lib/engine/constants.ts lib/engine/__tests__/constants.test.ts
git commit -m "feat: engine types and default construction constants"
```

---

### Task 3: Carcasă — expandCarcass

**Files:**
- Create: `lib/engine/carcass.ts`, `lib/engine/__tests__/fixtures.ts`
- Test: `lib/engine/__tests__/carcass.test.ts`

**Interfaces:**
- Consumes: tipurile din Task 2.
- Produces:
  - `expandCarcass(input: CabinetInput, catalogs: Catalogs, cc: ConstructionConstants): { parts: Part[]; warnings: Warning[] }` — folosit de `templates.ts` (Task 8).
  - Fixture-uri de test partajate în `lib/engine/__tests__/fixtures.ts` (`TEST_CATALOGS`, `bazaInput`) — **nu** în fișierul de test, ca importul lor să nu re-înregistreze testele. Toate task-urile următoare importă din `./fixtures`.

- [ ] **Step 1: Scrie fixture-urile și testul care pică**

`lib/engine/__tests__/fixtures.ts`:
```ts
import type { CabinetInput, Catalogs } from '../types';

export const TEST_CATALOGS: Catalogs = {
  materials: [
    {
      id: 'pal-alb', name: 'PAL alb W980', kind: 'PAL', thicknessMm: 18,
      sheetLengthMm: 2800, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SHEET', pricePerSheet: 260 },
    },
    {
      id: 'pfl-alb', name: 'PFL alb', kind: 'PFL', thicknessMm: 3,
      sheetLengthMm: 2850, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SHEET', pricePerSheet: 100 },
    },
    {
      id: 'mdf-vopsit', name: 'MDF vopsit mat', kind: 'MDF_VOPSIT', thicknessMm: 18,
      sheetLengthMm: 2800, sheetWidthMm: 2070,
      pricing: { mode: 'PER_SQM', pricePerSqm: 450 },
    },
  ],
  edgeBands: [
    { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1 },
    { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2 },
  ],
};

export function bazaInput(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return {
    label: 'B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: 'pal-alb',
    frontMaterialId: 'mdf-vopsit',
    back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: null },
    ...overrides,
  };
}
```

`lib/engine/__tests__/carcass.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { expandCarcass } from '../carcass';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('expandCarcass', () => {
  it('generează piesele carcasei pentru corp bază 600×720×560', () => {
    const { parts, warnings } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

    const byName = (n: string) => parts.find((p) => p.name === n)!;

    expect(byName('Laterală')).toMatchObject({
      lengthMm: 720, widthMm: 560, qty: 2, materialId: 'pal-alb',
      edges: { l1: 'abs-04' },
    });
    expect(byName('Blat corp / Fund corp')).toMatchObject({
      lengthMm: 564, widthMm: 560, qty: 2, edges: { l1: 'abs-04' },
    });
    expect(byName('Poliță')).toMatchObject({
      lengthMm: 564, widthMm: 530, qty: 1,
    });
    // spate în falț: (W − 4) × (H − 4), din PFL
    expect(byName('Spate')).toMatchObject({
      lengthMm: 716, widthMm: 596, qty: 1, materialId: 'pfl-alb', edges: {},
    });
    expect(warnings).toEqual([]);
  });

  it('spate aplicat = dimensiunea corpului', () => {
    const input = bazaInput({ back: { enabled: true, materialId: 'pfl-alb', mount: 'APLICAT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.find((p) => p.name === 'Spate')).toMatchObject({ lengthMm: 720, widthMm: 600 });
  });

  it('fără spate → nicio piesă Spate', () => {
    const input = bazaInput({ back: { enabled: false, mount: 'FALT' } });
    const { parts } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts.some((p) => p.name === 'Spate')).toBe(false);
  });

  it('avertizează la poliță peste 900mm deschidere', () => {
    const input = bazaInput({ widthMm: 1000 });
    const { warnings } = expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(warnings.some((w) => w.code === 'SHELF_SPAN')).toBe(true);
  });

  it('aruncă eroare la material inexistent', () => {
    const input = bazaInput({ carcassMaterialId: 'nu-exista' });
    expect(() => expandCarcass(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/material/i);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/carcass.test.ts`
Expected: FAIL — `Cannot find module '../carcass'`.

- [ ] **Step 3: Implementează**

`lib/engine/carcass.ts`:
```ts
import type { CabinetInput, Catalogs, ConstructionConstants, Part, Warning } from './types';

export function findMaterial(catalogs: Catalogs, id: string) {
  const m = catalogs.materials.find((mat) => mat.id === id);
  if (!m) throw new Error(`Material inexistent în catalog: ${id}`);
  return m;
}

export function expandCarcass(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { parts: Part[]; warnings: Warning[] } {
  const { widthMm: W, heightMm: H, depthMm: D, label } = input;
  if (W <= 0 || H <= 0 || D <= 0) throw new Error(`Dimensiuni invalide pentru corpul ${label}`);

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const t = carcass.thicknessMm;
  const fe = input.edgeBands.carcassFrontEdgeId;
  const innerW = W - 2 * t;

  const parts: Part[] = [
    {
      cabinetLabel: label, name: 'Laterală',
      lengthMm: H, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
    {
      cabinetLabel: label, name: 'Blat corp / Fund corp',
      lengthMm: innerW, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
  ];

  if (input.shelves > 0) {
    parts.push({
      cabinetLabel: label, name: 'Poliță',
      lengthMm: innerW, widthMm: D - cc.shelfSetbackMm, qty: input.shelves,
      materialId: carcass.id, edges: { l1: fe },
    });
  }

  if (input.back.enabled) {
    const back = findMaterial(catalogs, input.back.materialId ?? '');
    const isFalt = input.back.mount === 'FALT';
    parts.push({
      cabinetLabel: label, name: 'Spate',
      lengthMm: isFalt ? H - cc.backRebateMm : H,
      widthMm: isFalt ? W - cc.backRebateMm : W,
      qty: 1, materialId: back.id, edges: {},
    });
  }

  const warnings: Warning[] = [];
  if (input.shelves > 0 && innerW > cc.shelfSpanWarnMm) {
    warnings.push({
      code: 'SHELF_SPAN',
      message: `Poliță cu deschidere ${innerW}mm — peste ${cc.shelfSpanWarnMm}mm, recomandat sprijin intermediar`,
      cabinetLabel: label,
    });
  }

  return { parts, warnings };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/carcass.test.ts`
Expected: PASS (5 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/carcass.ts lib/engine/__tests__/fixtures.ts lib/engine/__tests__/carcass.test.ts
git commit -m "feat: carcass part expansion with warnings"
```

---

### Task 4: Fronturi — uși, fronturi sertar, panou orb

**Files:**
- Create: `lib/engine/fronts.ts`
- Test: `lib/engine/__tests__/fronts.test.ts`

**Interfaces:**
- Consumes: `findMaterial` din `./carcass`, tipuri din `./types`.
- Produces:
  - `drawerFrontHeights(input: CabinetInput, cc: ConstructionConstants): number[]`
  - `expandFronts(input: CabinetInput, catalogs: Catalogs, cc: ConstructionConstants): { parts: Part[]; fronts: FrontInfo[]; warnings: Warning[] }`
  - Folosite de `templates.ts` (Task 7), `drawers.ts` (Task 6) și `hardware.ts` (Task 8).

Convenții: lățime utilă fronturi = `W − 2·outerGap − panouOrb`; uși: `lățime = (utilă − (nrUși−1)·rost) / nrUși`, `înălțime = H − 2·outerGap`. Fronturi sertar: lățime = utilă, înălțimi egale din `H − 2·outerGap − (k−1)·rost` sau `frontHeightsMm` dacă e dat. Cant: fronturi din MDF_VOPSIT nu primesc cant; restul primesc `frontPerimeterId` pe toate 4 laturile (dacă e non-null).

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/fronts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { drawerFrontHeights, expandFronts } from '../fronts';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { CabinetInput } from '../types';

function sertareInput(overrides: Partial<CabinetInput> = {}): CabinetInput {
  return bazaInput({
    label: 'S1', type: 'SERTARE', doors: 0,
    drawers: { count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
    frontMaterialId: 'pal-alb',
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    ...overrides,
  });
}

describe('expandFronts — uși', () => {
  it('o ușă: W−4 × H−4, MDF vopsit fără cant', () => {
    const { parts, fronts } = expandFronts(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      name: 'Ușă', lengthMm: 716, widthMm: 596, qty: 1, materialId: 'mdf-vopsit', edges: {},
    });
    expect(fronts).toEqual([{ kind: 'USA', widthMm: 596, heightMm: 716 }]);
  });

  it('două uși: (600−4−3)/2 = 296.5 fiecare; PAL cu cant pe 4 laturi', () => {
    const input = bazaInput({
      doors: 2, frontMaterialId: 'pal-alb',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const { parts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts[0]).toMatchObject({
      widthMm: 296.5, qty: 2,
      edges: { l1: 'abs-1', l2: 'abs-1', w1: 'abs-1', w2: 'abs-1' },
    });
  });

  it('avertizează la ușă peste 650mm lățime', () => {
    const input = bazaInput({ widthMm: 700, doors: 1 });
    const { warnings } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(warnings.some((w) => w.code === 'DOOR_WIDTH')).toBe(true);
  });

  it('fără fronturi când frontMaterialId e null', () => {
    const input = bazaInput({ frontMaterialId: null });
    const { parts, fronts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts).toEqual([]);
    expect(fronts).toEqual([]);
  });
});

describe('expandFronts — sertare', () => {
  it('3 fronturi egale: (720−4−6)/3 ≈ 236.67', () => {
    const heights = drawerFrontHeights(sertareInput(), DEFAULT_CONSTRUCTION);
    expect(heights).toHaveLength(3);
    expect(heights[0]).toBeCloseTo(236.67, 1);

    const { parts, fronts } = expandFronts(sertareInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(parts).toHaveLength(1); // qty 3 pe o singură linie de piesă identică
    expect(parts[0]).toMatchObject({ name: 'Front sertar', widthMm: 596, qty: 3 });
    expect(fronts.filter((f) => f.kind === 'SERTAR')).toHaveLength(3);
  });

  it('respectă frontHeightsMm explicite', () => {
    const input = sertareInput();
    input.drawers!.frontHeightsMm = [140, 283, 283];
    const heights = drawerFrontHeights(input, DEFAULT_CONSTRUCTION);
    expect(heights).toEqual([140, 283, 283]);
  });
});

describe('expandFronts — panou orb (COLT)', () => {
  it('adaugă panoul orb și scade lățimea ușii', () => {
    const input = bazaInput({ type: 'COLT', blindPanelWidthMm: 100 });
    const { parts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const blind = parts.find((p) => p.name === 'Panou orb')!;
    const door = parts.find((p) => p.name === 'Ușă')!;
    expect(blind).toMatchObject({ widthMm: 100, lengthMm: 716 });
    expect(door.widthMm).toBeCloseTo(496, 5); // 600 − 4 − 100
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/fronts.test.ts`
Expected: FAIL — `Cannot find module '../fronts'`.

- [ ] **Step 3: Implementează**

`lib/engine/fronts.ts`:
```ts
import { findMaterial } from './carcass';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo, Part, PartEdges, Warning,
} from './types';

export function drawerFrontHeights(input: CabinetInput, cc: ConstructionConstants): number[] {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return [];
  if (drawers.frontHeightsMm) {
    if (drawers.frontHeightsMm.length !== drawers.count) {
      throw new Error(`Corpul ${input.label}: frontHeightsMm nu corespunde cu numărul de sertare`);
    }
    return drawers.frontHeightsMm;
  }
  const usable = input.heightMm - 2 * cc.outerGapMm - (drawers.count - 1) * cc.frontGapMm;
  return Array.from({ length: drawers.count }, () => usable / drawers.count);
}

export function expandFronts(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { parts: Part[]; fronts: FrontInfo[]; warnings: Warning[] } {
  if (!input.frontMaterialId) return { parts: [], fronts: [], warnings: [] };

  const material = findMaterial(catalogs, input.frontMaterialId);
  const bandId = material.kind === 'MDF_VOPSIT' ? null : input.edgeBands.frontPerimeterId;
  const edges: PartEdges = bandId ? { l1: bandId, l2: bandId, w1: bandId, w2: bandId } : {};

  const blindW = input.type === 'COLT' ? (input.blindPanelWidthMm ?? 100) : 0;
  const usableW = input.widthMm - 2 * cc.outerGapMm - blindW;
  const frontH = input.heightMm - 2 * cc.outerGapMm;

  const parts: Part[] = [];
  const fronts: FrontInfo[] = [];
  const warnings: Warning[] = [];

  if (blindW > 0) {
    parts.push({
      cabinetLabel: input.label, name: 'Panou orb',
      lengthMm: frontH, widthMm: blindW, qty: 1,
      materialId: material.id, edges,
    });
  }

  if (input.type === 'SERTARE') {
    const heights = drawerFrontHeights(input, cc);
    // grupează înălțimile identice într-o singură linie de piesă
    const groups = new Map<number, number>();
    for (const h of heights) groups.set(h, (groups.get(h) ?? 0) + 1);
    for (const [h, qty] of groups) {
      parts.push({
        cabinetLabel: input.label, name: 'Front sertar',
        lengthMm: h, widthMm: usableW, qty,
        materialId: material.id, edges,
      });
    }
    for (const h of heights) fronts.push({ kind: 'SERTAR', widthMm: usableW, heightMm: h });
  } else if (input.doors > 0) {
    const doorW = (usableW - (input.doors - 1) * cc.frontGapMm) / input.doors;
    parts.push({
      cabinetLabel: input.label, name: 'Ușă',
      lengthMm: frontH, widthMm: doorW, qty: input.doors,
      materialId: material.id, edges,
    });
    for (let i = 0; i < input.doors; i++) fronts.push({ kind: 'USA', widthMm: doorW, heightMm: frontH });
    if (doorW > cc.doorMaxWidthMm) {
      warnings.push({
        code: 'DOOR_WIDTH',
        message: `Ușă de ${Math.round(doorW)}mm lățime — peste ${cc.doorMaxWidthMm}mm pentru balamale standard`,
        cabinetLabel: input.label,
      });
    }
  }

  return { parts, fronts, warnings };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/fronts.test.ts`
Expected: PASS (7 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/fronts.ts lib/engine/__tests__/fronts.test.ts
git commit -m "feat: front splitting for doors, drawer fronts and blind panels"
```

---

### Task 5: Balamale — suggestHingeCount și doorWeightKg

**Files:**
- Create: `lib/engine/hinges.ts`
- Test: `lib/engine/__tests__/hinges.test.ts`

**Interfaces:**
- Produces:
  - `doorWeightKg(widthMm: number, heightMm: number, thicknessMm: number, cc: ConstructionConstants): number`
  - `suggestHingeCount(heightMm: number, widthMm: number, weightKg: number, cc: ConstructionConstants): { count: number; warnings: Warning[] }`
  - Folosite de `hardware.ts` (Task 8).

Reguli (din spec): după înălțime ≤900→2, ≤1500→3, ≤2100→4, peste→5. Benzi de greutate maximă per număr: 2→6kg, 3→12kg, 4→18kg, 5→24kg; dacă greutatea depășește banda, crește numărul (max 5, apoi avertizare `DOOR_WEIGHT`). Lățimea nu se verifică aici (se verifică în fronts.ts).

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/hinges.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { doorWeightKg, suggestHingeCount } from '../hinges';
import { DEFAULT_CONSTRUCTION } from '../constants';

const cc = DEFAULT_CONSTRUCTION;

describe('doorWeightKg', () => {
  it('ușă 596×716 din placă 18mm ≈ 5.3 kg', () => {
    expect(doorWeightKg(596, 716, 18, cc)).toBeCloseTo(5.34, 1);
  });
});

describe('suggestHingeCount — după înălțime', () => {
  it.each([
    [700, 2], [899, 2], [900, 2],
    [901, 3], [1500, 3],
    [1501, 4], [2100, 4],
    [2101, 5], [2400, 5],
  ])('înălțime %imm → %i balamale', (h, expected) => {
    expect(suggestHingeCount(h, 400, 4, cc).count).toBe(expected);
  });
});

describe('suggestHingeCount — corecție pe greutate', () => {
  it('ușă scundă dar grea: 700mm, 13kg → 4 balamale', () => {
    const { count, warnings } = suggestHingeCount(700, 600, 13, cc);
    expect(count).toBe(4);
    expect(warnings).toEqual([]);
  });

  it('peste banda maximă la 5 balamale → avertizare', () => {
    const { count, warnings } = suggestHingeCount(2300, 600, 30, cc);
    expect(count).toBe(5);
    expect(warnings.some((w) => w.code === 'DOOR_WEIGHT')).toBe(true);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/hinges.test.ts`
Expected: FAIL — `Cannot find module '../hinges'`.

- [ ] **Step 3: Implementează**

`lib/engine/hinges.ts`:
```ts
import type { ConstructionConstants, Warning } from './types';

const HINGE_MAX_KG: Record<number, number> = { 2: 6, 3: 12, 4: 18, 5: 24 };

export function doorWeightKg(
  widthMm: number,
  heightMm: number,
  thicknessMm: number,
  cc: ConstructionConstants,
): number {
  return (widthMm / 1000) * (heightMm / 1000) * thicknessMm * cc.boardDensityKgPerSqmPerMm;
}

export function suggestHingeCount(
  heightMm: number,
  widthMm: number,
  weightKg: number,
  cc: ConstructionConstants,
): { count: number; warnings: Warning[] } {
  let count = heightMm <= 900 ? 2 : heightMm <= 1500 ? 3 : heightMm <= 2100 ? 4 : 5;
  while (count < 5 && weightKg > HINGE_MAX_KG[count]) count++;

  const warnings: Warning[] = [];
  if (weightKg > HINGE_MAX_KG[count]) {
    warnings.push({
      code: 'DOOR_WEIGHT',
      message: `Ușă de ${weightKg.toFixed(1)}kg — peste limita pentru ${count} balamale standard; verifică balamale heavy-duty`,
    });
  }
  return { count, warnings };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/hinges.test.ts`
Expected: PASS (12 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/hinges.ts lib/engine/__tests__/hinges.test.ts
git commit -m "feat: hinge count suggestion by door height and weight"
```

---

### Task 6: Sertare — pickSlideNominal și expandDrawerBoxes

**Files:**
- Create: `lib/engine/drawers.ts`
- Test: `lib/engine/__tests__/drawers.test.ts`

**Interfaces:**
- Consumes: `findMaterial` din `./carcass`, `drawerFrontHeights` din `./fronts`.
- Produces:
  - `pickSlideNominal(depthMm: number, cc: ConstructionConstants): { nominalMm: number; warnings: Warning[] }`
  - `expandDrawerBoxes(input: CabinetInput, catalogs: Catalogs, cc: ConstructionConstants): { parts: Part[]; warnings: Warning[] }`
  - Folosite de `templates.ts` (Task 7) și `hardware.ts` (Task 8).

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/drawers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { expandDrawerBoxes, pickSlideNominal } from '../drawers';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { CabinetInput, DrawerSystem } from '../types';

const cc = DEFAULT_CONSTRUCTION;

function sertareInput(system: DrawerSystem): CabinetInput {
  return bazaInput({
    label: 'S1', type: 'SERTARE', doors: 0,
    drawers: { count: 3, system, bottomMaterialId: 'pfl-alb' },
    frontMaterialId: 'pal-alb',
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
  });
}

describe('pickSlideNominal', () => {
  it('adâncime 560 → glisieră 500 (cea mai mare ≤ 530)', () => {
    expect(pickSlideNominal(560, cc)).toMatchObject({ nominalMm: 500, warnings: [] });
  });
  it('adâncime 500 → 450', () => {
    expect(pickSlideNominal(500, cc).nominalMm).toBe(450);
  });
  it('adâncime prea mică → cea mai mică nominală + avertizare', () => {
    const r = pickSlideNominal(290, cc);
    expect(r.nominalMm).toBe(270);
    expect(r.warnings.some((w) => w.code === 'SLIDE_DEPTH')).toBe(true);
  });
});

describe('expandDrawerBoxes — PAL_BOX', () => {
  it('cutie PAL: laterale, față/spate, fund PFL', () => {
    const { parts } = expandDrawerBoxes(sertareInput('PAL_BOX'), TEST_CATALOGS, cc);
    // per sertar; front ≈ 236.67 → boxH = 236.67 − 60 = 176.67; boxW = 600 − 36 − 26 = 538
    const sides = parts.find((p) => p.name === 'Laterală sertar')!;
    expect(sides.lengthMm).toBe(500);           // = nominală glisieră
    expect(sides.widthMm).toBeCloseTo(176.67, 1);
    expect(sides.qty).toBe(6);                  // 2 × 3 sertare

    const fb = parts.find((p) => p.name === 'Față/Spate cutie sertar')!;
    expect(fb.lengthMm).toBeCloseTo(502, 5);    // 538 − 2×18
    expect(fb.qty).toBe(6);

    const bottom = parts.find((p) => p.name === 'Fund sertar')!;
    expect(bottom).toMatchObject({ lengthMm: 500, widthMm: 538, qty: 3, materialId: 'pfl-alb' });
  });

  it('înălțimea cutiei nu scade sub minim', () => {
    const input = sertareInput('PAL_BOX');
    input.drawers!.frontHeightsMm = [100, 308, 308];
    const { parts } = expandDrawerBoxes(input, TEST_CATALOGS, cc);
    const heights = parts.filter((p) => p.name === 'Laterală sertar').map((p) => p.widthMm);
    expect(Math.min(...heights)).toBe(cc.palBoxMinHeightMm); // 80, nu 40
  });
});

describe('expandDrawerBoxes — METAL_BOX', () => {
  it('doar fund + spate din placă (lateralele sunt metalice)', () => {
    const { parts } = expandDrawerBoxes(sertareInput('METAL_BOX'), TEST_CATALOGS, cc);
    expect(parts.find((p) => p.name === 'Fund sertar')).toMatchObject({
      lengthMm: 500, widthMm: 477, qty: 3, materialId: 'pfl-alb', // 600−36−87 = 477
    });
    expect(parts.find((p) => p.name === 'Spate sertar')).toMatchObject({
      lengthMm: 477, widthMm: 70, qty: 3, materialId: 'pal-alb',
    });
    expect(parts.some((p) => p.name === 'Laterală sertar')).toBe(false);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/drawers.test.ts`
Expected: FAIL — `Cannot find module '../drawers'`.

- [ ] **Step 3: Implementează**

`lib/engine/drawers.ts`:
```ts
import { findMaterial } from './carcass';
import { drawerFrontHeights } from './fronts';
import type { CabinetInput, Catalogs, ConstructionConstants, Part, Warning } from './types';

export function pickSlideNominal(
  depthMm: number,
  cc: ConstructionConstants,
): { nominalMm: number; warnings: Warning[] } {
  const maxLength = depthMm - cc.slideClearanceMm;
  const fitting = cc.slideNominalsMm.filter((n) => n <= maxLength);
  if (fitting.length === 0) {
    const smallest = Math.min(...cc.slideNominalsMm);
    return {
      nominalMm: smallest,
      warnings: [{
        code: 'SLIDE_DEPTH',
        message: `Adâncime ${depthMm}mm prea mică pentru glisiera minimă de ${smallest}mm`,
      }],
    };
  }
  return { nominalMm: Math.max(...fitting), warnings: [] };
}

export function expandDrawerBoxes(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { parts: Part[]; warnings: Warning[] } {
  const drawers = input.drawers;
  if (!drawers || drawers.count <= 0) return { parts: [], warnings: [] };

  const carcass = findMaterial(catalogs, input.carcassMaterialId);
  const bottom = findMaterial(catalogs, drawers.bottomMaterialId);
  const t = carcass.thicknessMm;
  const innerW = input.widthMm - 2 * t;
  const { nominalMm, warnings } = pickSlideNominal(input.depthMm, cc);
  const heights = drawerFrontHeights(input, cc);
  const fe = input.edgeBands.carcassFrontEdgeId;

  const parts: Part[] = [];
  const push = (p: Part) => {
    const same = parts.find(
      (q) => q.name === p.name && q.lengthMm === p.lengthMm && q.widthMm === p.widthMm && q.materialId === p.materialId,
    );
    if (same) same.qty += p.qty;
    else parts.push(p);
  };

  for (const frontH of heights) {
    if (drawers.system === 'PAL_BOX') {
      const boxW = innerW - cc.palBoxSlideAllowanceMm;
      const boxH = Math.max(frontH - cc.palBoxHeightDeductMm, cc.palBoxMinHeightMm);
      push({
        cabinetLabel: input.label, name: 'Laterală sertar',
        lengthMm: nominalMm, widthMm: boxH, qty: 2,
        materialId: carcass.id, edges: { l1: fe },
      });
      push({
        cabinetLabel: input.label, name: 'Față/Spate cutie sertar',
        lengthMm: boxW - 2 * t, widthMm: boxH, qty: 2,
        materialId: carcass.id, edges: { l1: fe },
      });
      push({
        cabinetLabel: input.label, name: 'Fund sertar',
        lengthMm: nominalMm, widthMm: boxW, qty: 1,
        materialId: bottom.id, edges: {},
      });
    } else {
      const bottomW = innerW - cc.metalBoxBottomDeductMm;
      push({
        cabinetLabel: input.label, name: 'Fund sertar',
        lengthMm: nominalMm, widthMm: bottomW, qty: 1,
        materialId: bottom.id, edges: {},
      });
      push({
        cabinetLabel: input.label, name: 'Spate sertar',
        lengthMm: bottomW, widthMm: cc.metalBoxBackHeightMm, qty: 1,
        materialId: carcass.id, edges: {},
      });
    }
  }

  return { parts, warnings };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/drawers.test.ts`
Expected: PASS (6 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/drawers.ts lib/engine/__tests__/drawers.test.ts
git commit -m "feat: drawer slide selection and drawer box parts"
```

---

### Task 7: Sugestii feronerie — suggestHardware și resolveSuggestions

**Files:**
- Create: `lib/engine/hardware.ts`
- Test: `lib/engine/__tests__/hardware.test.ts`

**Interfaces:**
- Consumes: `suggestHingeCount`, `doorWeightKg` din `./hinges`; `pickSlideNominal` din `./drawers`; `findMaterial` din `./carcass`.
- Produces:
  - `suggestHardware(input: CabinetInput, fronts: FrontInfo[], catalogs: Catalogs, cc: ConstructionConstants): { suggestions: HardwareSuggestion[]; warnings: Warning[] }`
  - `resolveSuggestions(suggestions: HardwareSuggestion[], defaults: HardwareDefaults): { lines: HardwareLine[]; unresolved: HardwareSuggestion[] }`
  - `suggestHardware` e folosit de `templates.ts` (Task 8); `resolveSuggestions` de `index.ts` (Task 12).

Reguli: balamale per ușă (din hinges); 1 set glisiere per sertar (nominală din pickSlideNominal); 1 mâner per front; picioare pentru BAZA/INALT/SERTARE/COLT (`legsPerCabinet`); 1 set suspendare pentru SUSPENDAT. `resolveSuggestions` mapează categoriile pe id-uri din `HardwareDefaults` (glisiere după `nominalLengthMm`, fallback pe cea mai apropiată nominală din map), agregă cantitățile pe același id, iar sugestiile fără default (ex. `handleId: null`) merg în `unresolved`.

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/hardware.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolveSuggestions, suggestHardware } from '../hardware';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';
import type { FrontInfo, HardwareDefaults } from '../types';

const cc = DEFAULT_CONSTRUCTION;

const DEFAULTS: HardwareDefaults = {
  hingeId: 'blum-cliptop',
  slideIdsByNominal: { 450: 'tbx-450', 500: 'tbx-500' },
  handleId: 'maner-std',
  legId: 'picior-std',
  railId: 'sina-std',
};

describe('suggestHardware — corp bază cu o ușă', () => {
  const fronts: FrontInfo[] = [{ kind: 'USA', widthMm: 596, heightMm: 716 }];

  it('sugerează balamale, mâner și picioare', () => {
    const { suggestions } = suggestHardware(bazaInput(), fronts, TEST_CATALOGS, cc);
    const byCat = (c: string) => suggestions.filter((s) => s.category === c);
    expect(byCat('BALAMA')[0].qty).toBe(2);          // ușă 716mm, ~5.3kg
    expect(byCat('MANER')[0].qty).toBe(1);
    expect(byCat('PICIOR')[0].qty).toBe(4);
    expect(byCat('SINA_SUSPENDARE')).toHaveLength(0);
    expect(byCat('SERTAR')).toHaveLength(0);
  });
});

describe('suggestHardware — corp suspendat', () => {
  it('șină în loc de picioare', () => {
    const input = bazaInput({ type: 'SUSPENDAT', depthMm: 320 });
    const fronts: FrontInfo[] = [{ kind: 'USA', widthMm: 596, heightMm: 716 }];
    const { suggestions } = suggestHardware(input, fronts, TEST_CATALOGS, cc);
    expect(suggestions.some((s) => s.category === 'PICIOR')).toBe(false);
    expect(suggestions.find((s) => s.category === 'SINA_SUSPENDARE')!.qty).toBe(1);
  });
});

describe('suggestHardware — corp cu sertare', () => {
  it('un set glisiere per sertar, cu nominala corectă', () => {
    const input = bazaInput({
      type: 'SERTARE', doors: 0,
      drawers: { count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' },
    });
    const fronts: FrontInfo[] = [
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
      { kind: 'SERTAR', widthMm: 596, heightMm: 236.67 },
    ];
    const { suggestions } = suggestHardware(input, fronts, TEST_CATALOGS, cc);
    const slides = suggestions.find((s) => s.category === 'SERTAR')!;
    expect(slides.qty).toBe(3);
    expect(slides.nominalLengthMm).toBe(500); // D=560 → 500
    expect(suggestions.find((s) => s.category === 'MANER')!.qty).toBe(3);
  });
});

describe('resolveSuggestions', () => {
  it('mapează pe id-uri și agregă', () => {
    const { lines, unresolved } = resolveSuggestions(
      [
        { category: 'BALAMA', name: 'Balama ușă', qty: 2 },
        { category: 'BALAMA', name: 'Balama ușă 2', qty: 2 },
        { category: 'SERTAR', name: 'Glisiere', qty: 3, nominalLengthMm: 500 },
        { category: 'MANER', name: 'Mâner', qty: 4 },
      ],
      DEFAULTS,
    );
    expect(lines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 4 });
    expect(lines).toContainEqual({ hardwareId: 'tbx-500', qty: 3 });
    expect(lines).toContainEqual({ hardwareId: 'maner-std', qty: 4 });
    expect(unresolved).toEqual([]);
  });

  it('glisieră fără nominală exactă → cea mai apropiată din map', () => {
    const { lines } = resolveSuggestions(
      [{ category: 'SERTAR', name: 'Glisiere', qty: 1, nominalLengthMm: 400 }],
      DEFAULTS,
    );
    expect(lines).toContainEqual({ hardwareId: 'tbx-450', qty: 1 });
  });

  it('fără default (handleId null) → unresolved', () => {
    const { lines, unresolved } = resolveSuggestions(
      [{ category: 'MANER', name: 'Mâner', qty: 2 }],
      { ...DEFAULTS, handleId: null },
    );
    expect(lines).toEqual([]);
    expect(unresolved).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/hardware.test.ts`
Expected: FAIL — `Cannot find module '../hardware'`.

- [ ] **Step 3: Implementează**

`lib/engine/hardware.ts`:
```ts
import { findMaterial } from './carcass';
import { pickSlideNominal } from './drawers';
import { doorWeightKg, suggestHingeCount } from './hinges';
import type {
  CabinetInput, Catalogs, ConstructionConstants, FrontInfo,
  HardwareDefaults, HardwareLine, HardwareSuggestion, Warning,
} from './types';

const LEGGED_TYPES = new Set(['BAZA', 'INALT', 'SERTARE', 'COLT']);

export function suggestHardware(
  input: CabinetInput,
  fronts: FrontInfo[],
  catalogs: Catalogs,
  cc: ConstructionConstants,
): { suggestions: HardwareSuggestion[]; warnings: Warning[] } {
  const suggestions: HardwareSuggestion[] = [];
  const warnings: Warning[] = [];

  const doors = fronts.filter((f) => f.kind === 'USA');
  const drawerFronts = fronts.filter((f) => f.kind === 'SERTAR');

  if (doors.length > 0 && input.frontMaterialId) {
    const frontMat = findMaterial(catalogs, input.frontMaterialId);
    let totalHinges = 0;
    for (const door of doors) {
      const weight = doorWeightKg(door.widthMm, door.heightMm, frontMat.thicknessMm, cc);
      const { count, warnings: hw } = suggestHingeCount(door.heightMm, door.widthMm, weight, cc);
      totalHinges += count;
      warnings.push(...hw.map((w) => ({ ...w, cabinetLabel: input.label })));
    }
    suggestions.push({
      category: 'BALAMA',
      name: `Balama + plăcuță (${doors.length} ușă/uși)`,
      qty: totalHinges,
    });
  }

  if (drawerFronts.length > 0) {
    const { nominalMm, warnings: sw } = pickSlideNominal(input.depthMm, cc);
    warnings.push(...sw.map((w) => ({ ...w, cabinetLabel: input.label })));
    suggestions.push({
      category: 'SERTAR',
      name: `Set glisiere/cutie ${nominalMm}mm`,
      qty: drawerFronts.length,
      nominalLengthMm: nominalMm,
    });
  }

  if (fronts.length > 0) {
    suggestions.push({ category: 'MANER', name: 'Mâner', qty: fronts.length });
  }

  if (LEGGED_TYPES.has(input.type)) {
    suggestions.push({ category: 'PICIOR', name: 'Picior reglabil', qty: cc.legsPerCabinet });
  }
  if (input.type === 'SUSPENDAT') {
    suggestions.push({ category: 'SINA_SUSPENDARE', name: 'Set suspendare corp', qty: 1 });
  }

  return { suggestions, warnings };
}

export function resolveSuggestions(
  suggestions: HardwareSuggestion[],
  defaults: HardwareDefaults,
): { lines: HardwareLine[]; unresolved: HardwareSuggestion[] } {
  const byId = new Map<string, number>();
  const unresolved: HardwareSuggestion[] = [];

  for (const s of suggestions) {
    let id: string | null = null;
    if (s.category === 'BALAMA') id = defaults.hingeId;
    else if (s.category === 'MANER') id = defaults.handleId;
    else if (s.category === 'PICIOR') id = defaults.legId;
    else if (s.category === 'SINA_SUSPENDARE') id = defaults.railId;
    else if (s.category === 'SERTAR' && s.nominalLengthMm !== undefined) {
      const nominals = Object.keys(defaults.slideIdsByNominal).map(Number);
      if (nominals.length > 0) {
        const target = s.nominalLengthMm;
        const closest = nominals.reduce((a, b) =>
          Math.abs(b - target) < Math.abs(a - target) ? b : a,
        );
        id = defaults.slideIdsByNominal[closest];
      }
    }

    if (id) byId.set(id, (byId.get(id) ?? 0) + s.qty);
    else unresolved.push(s);
  }

  return {
    lines: [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty })),
    unresolved,
  };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/hardware.test.ts`
Expected: PASS (7 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/hardware.ts lib/engine/__tests__/hardware.test.ts
git commit -m "feat: hardware suggestions and catalog resolution"
```

---

### Task 8: Șabloane — expandCabinet

**Files:**
- Create: `lib/engine/templates.ts`
- Test: `lib/engine/__tests__/templates.test.ts`

**Interfaces:**
- Consumes: `expandCarcass`, `expandFronts`, `expandDrawerBoxes`, `suggestHardware`.
- Produces: `expandCabinet(input: CabinetInput, catalogs: Catalogs, cc: ConstructionConstants): ExpandedCabinet`. Folosit de `index.ts` (Task 12).

Validări (throw): `SERTARE` cere `drawers` cu `count > 0`; celelalte tipuri nu pot avea `drawers`; `doors > 0` cere `frontMaterialId` non-null.

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/templates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { expandCabinet } from '../templates';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const cc = DEFAULT_CONSTRUCTION;

describe('expandCabinet', () => {
  it('BAZA: carcasă + ușă + feronerie', () => {
    const r = expandCabinet(bazaInput(), TEST_CATALOGS, cc);
    const names = r.parts.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['Laterală', 'Blat corp / Fund corp', 'Poliță', 'Spate', 'Ușă']),
    );
    expect(r.hardware.some((h) => h.category === 'BALAMA')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'PICIOR')).toBe(true);
  });

  it('SERTARE: fronturi sertar + cutii + glisiere, fără balamale', () => {
    const input = bazaInput({
      label: 'S1', type: 'SERTARE', doors: 0, shelves: 0,
      drawers: { count: 3, system: 'PAL_BOX', bottomMaterialId: 'pfl-alb' },
      frontMaterialId: 'pal-alb',
      edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: 'abs-1' },
    });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.parts.some((p) => p.name === 'Front sertar')).toBe(true);
    expect(r.parts.some((p) => p.name === 'Laterală sertar')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'BALAMA')).toBe(false);
    expect(r.hardware.find((h) => h.category === 'SERTAR')!.qty).toBe(3);
  });

  it('SUSPENDAT: șină, fără picioare', () => {
    const input = bazaInput({ type: 'SUSPENDAT', depthMm: 320 });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.hardware.some((h) => h.category === 'SINA_SUSPENDARE')).toBe(true);
    expect(r.hardware.some((h) => h.category === 'PICIOR')).toBe(false);
  });

  it('COLT: include panou orb', () => {
    const input = bazaInput({ type: 'COLT' });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    expect(r.parts.some((p) => p.name === 'Panou orb')).toBe(true);
  });

  it('INALT 2100mm: 4 balamale pe ușă', () => {
    const input = bazaInput({ type: 'INALT', heightMm: 2100, doors: 1 });
    const r = expandCabinet(input, TEST_CATALOGS, cc);
    // ușă 2096mm → 4 după înălțime; greutate 0.596×2.096×18×0.695 ≈ 15.6kg ≤ 18 → rămâne 4
    expect(r.hardware.find((h) => h.category === 'BALAMA')!.qty).toBe(4);
  });

  it('SERTARE fără drawers → eroare', () => {
    const input = bazaInput({ type: 'SERTARE', doors: 0 });
    expect(() => expandCabinet(input, TEST_CATALOGS, cc)).toThrow(/sertare/i);
  });

  it('uși fără material de front → eroare', () => {
    const input = bazaInput({ frontMaterialId: null, doors: 1 });
    expect(() => expandCabinet(input, TEST_CATALOGS, cc)).toThrow(/front/i);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/templates.test.ts`
Expected: FAIL — `Cannot find module '../templates'`.

- [ ] **Step 3: Implementează**

`lib/engine/templates.ts`:
```ts
import { expandCarcass } from './carcass';
import { expandDrawerBoxes } from './drawers';
import { expandFronts } from './fronts';
import { suggestHardware } from './hardware';
import type { CabinetInput, Catalogs, ConstructionConstants, ExpandedCabinet } from './types';

export function expandCabinet(
  input: CabinetInput,
  catalogs: Catalogs,
  cc: ConstructionConstants,
): ExpandedCabinet {
  if (input.type === 'SERTARE' && (!input.drawers || input.drawers.count <= 0)) {
    throw new Error(`Corpul ${input.label}: tipul SERTARE cere sertare definite`);
  }
  if (input.type !== 'SERTARE' && input.drawers) {
    throw new Error(`Corpul ${input.label}: sertarele sunt permise doar la tipul SERTARE`);
  }
  if (input.doors > 0 && !input.frontMaterialId) {
    throw new Error(`Corpul ${input.label}: ușile cer un material de front`);
  }

  const carcass = expandCarcass(input, catalogs, cc);
  const fronts = expandFronts(input, catalogs, cc);
  const boxes = input.type === 'SERTARE'
    ? expandDrawerBoxes(input, catalogs, cc)
    : { parts: [], warnings: [] };
  const hardware = suggestHardware(input, fronts.fronts, catalogs, cc);

  return {
    input,
    parts: [...carcass.parts, ...fronts.parts, ...boxes.parts],
    hardware: hardware.suggestions,
    warnings: [...carcass.warnings, ...fronts.warnings, ...boxes.warnings, ...hardware.warnings],
  };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/templates.test.ts`
Expected: PASS (7 teste). Rulează și `npm test` — toate testele de până acum PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/engine/templates.ts lib/engine/__tests__/templates.test.ts
git commit -m "feat: cabinet template expansion for all five types"
```

---

### Task 9: Necesar materiale — computeMaterialNeeds

**Files:**
- Create: `lib/engine/needs.ts`
- Test: `lib/engine/__tests__/needs.test.ts`

**Interfaces:**
- Consumes: `findMaterial` din `./carcass`, tipuri.
- Produces:
```ts
export interface BoardNeed { materialId: string; totalAreaSqm: number; sheets: number | null }
export interface EdgingNeed { edgeBandId: string; totalMl: number }
export function computeMaterialNeeds(
  parts: Part[], catalogs: Catalogs, yieldFactor: number,
): { boards: BoardNeed[]; edging: EdgingNeed[] }
```
`sheets` = `ceil(totalArea / (arieFoaie × yieldFactor))` pentru materiale PER_SHEET; `null` pentru PER_SQM. Cant: laturile `l1/l2` contribuie cu `lengthMm`, `w1/w2` cu `widthMm`, înmulțite cu `qty`, în ml. Folosit de `costing.ts` (Task 10) și `index.ts` (Task 12).

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/needs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeMaterialNeeds } from '../needs';
import { expandCarcass } from '../carcass';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

describe('computeMaterialNeeds', () => {
  const { parts } = expandCarcass(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

  it('calculează arii, foi și cant pentru carcasa de test', () => {
    const { boards, edging } = computeMaterialNeeds(parts, TEST_CATALOGS, 0.8);

    const pal = boards.find((b) => b.materialId === 'pal-alb')!;
    // 2×(0.72×0.56) + 2×(0.564×0.56) + 0.564×0.53 = 1.737 m²
    expect(pal.totalAreaSqm).toBeCloseTo(1.737, 3);
    // foaie 2800×2070 = 5.796 m²; 1.737 / (5.796×0.8) = 0.375 → 1 foaie
    expect(pal.sheets).toBe(1);

    const pfl = boards.find((b) => b.materialId === 'pfl-alb')!;
    expect(pfl.totalAreaSqm).toBeCloseTo(0.4267, 3);
    expect(pfl.sheets).toBe(1);

    // cant 0.4: laterale 2×0.72 + blat/fund 2×0.564 + poliță 0.564 = 3.132 ml
    const abs04 = edging.find((e) => e.edgeBandId === 'abs-04')!;
    expect(abs04.totalMl).toBeCloseTo(3.132, 3);
  });

  it('material PER_SQM → sheets null', () => {
    const doorParts = [{
      cabinetLabel: 'B1', name: 'Ușă', lengthMm: 716, widthMm: 596, qty: 1,
      materialId: 'mdf-vopsit', edges: {},
    }];
    const { boards } = computeMaterialNeeds(doorParts, TEST_CATALOGS, 0.8);
    expect(boards[0]).toMatchObject({ materialId: 'mdf-vopsit', sheets: null });
    expect(boards[0].totalAreaSqm).toBeCloseTo(0.4267, 3);
  });

  it('cantul de pe laturile scurte folosește widthMm', () => {
    const p = [{
      cabinetLabel: 'X', name: 'Test', lengthMm: 1000, widthMm: 500, qty: 2,
      materialId: 'pal-alb', edges: { l1: 'abs-1', w1: 'abs-1', w2: 'abs-1' },
    }];
    const { edging } = computeMaterialNeeds(p, TEST_CATALOGS, 0.8);
    // per buc: 1.0 (l1) + 0.5 + 0.5 (w1,w2) = 2.0 ml × 2 buc = 4 ml
    expect(edging.find((e) => e.edgeBandId === 'abs-1')!.totalMl).toBeCloseTo(4, 5);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/needs.test.ts`
Expected: FAIL — `Cannot find module '../needs'`.

- [ ] **Step 3: Implementează**

`lib/engine/needs.ts`:
```ts
import { findMaterial } from './carcass';
import type { Catalogs, Part } from './types';

export interface BoardNeed {
  materialId: string;
  totalAreaSqm: number;
  sheets: number | null;
}

export interface EdgingNeed {
  edgeBandId: string;
  totalMl: number;
}

export function computeMaterialNeeds(
  parts: Part[],
  catalogs: Catalogs,
  yieldFactor: number,
): { boards: BoardNeed[]; edging: EdgingNeed[] } {
  const areaByMaterial = new Map<string, number>();
  const mlByBand = new Map<string, number>();

  for (const p of parts) {
    const area = (p.lengthMm / 1000) * (p.widthMm / 1000) * p.qty;
    areaByMaterial.set(p.materialId, (areaByMaterial.get(p.materialId) ?? 0) + area);

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
      return { materialId, totalAreaSqm, sheets: null };
    }
    const sheetArea = (material.sheetLengthMm / 1000) * (material.sheetWidthMm / 1000);
    return {
      materialId,
      totalAreaSqm,
      sheets: Math.ceil(totalAreaSqm / (sheetArea * yieldFactor)),
    };
  });

  const edging: EdgingNeed[] = [...mlByBand.entries()].map(([edgeBandId, totalMl]) => ({
    edgeBandId, totalMl,
  }));

  return { boards, edging };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/needs.test.ts`
Expected: PASS (3 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/needs.ts lib/engine/__tests__/needs.test.ts
git commit -m "feat: material and edging needs computation"
```

---

### Task 10: Costuri — computeCosts

**Files:**
- Create: `lib/engine/costing.ts`
- Test: `lib/engine/__tests__/costing.test.ts`

**Interfaces:**
- Consumes: `computeMaterialNeeds` din `./needs`, `findMaterial` din `./carcass`.
- Produces:
```ts
export interface CostCatalogs extends Catalogs {
  hardware: HardwareItem[];
  cuttingRates: CuttingRate[];            // sortate crescător după maxThicknessMm
  laborPerType: Record<CabinetType, number>;
}
export interface CostBreakdown {
  boards: number; edging: number; cuttingService: number;
  hardware: number; labor: number; freeLines: number;
}
export interface CostResult {
  breakdown: CostBreakdown;
  totalCost: number;
  sellPrice: number;
  leiPerMl: number | null;   // preț vânzare / metri liniari corpuri de bază; null dacă nu există
  needs: { boards: BoardNeed[]; edging: EdgingNeed[] };
}
export function computeCosts(args: {
  parts: Part[];
  hardwareLines: HardwareLine[];
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  markupPct: number;
  yieldFactor: number;
  catalogs: CostCatalogs;
}): CostResult
```
Reguli: plăci PER_SHEET = foi × preț/foaie; PER_SQM = arie × preț/m². Debitare doar pentru PER_SHEET: foi × primul `cuttingRates` cu `maxThicknessMm ≥ grosime` (dacă nu există bandă → 0). Cant = ml × preț/ml. `leiPerMl` = sellPrice / Σ(lățimi corpuri BAZA/SERTARE/COLT în metri), `null` dacă suma e 0. Folosit de `index.ts` (Task 12).

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/costing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeCosts, type CostCatalogs } from '../costing';
import { expandCabinet } from '../templates';
import { DEFAULT_CONSTRUCTION } from '../constants';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const COST_CATALOGS: CostCatalogs = {
  ...TEST_CATALOGS,
  hardware: [
    { id: 'blum-cliptop', name: 'Balama Blum ClipTop', category: 'BALAMA', pricePerUnit: 15 },
    { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10 },
    { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2 },
  ],
  cuttingRates: [
    { maxThicknessMm: 10, pricePerSheet: 33 },
    { maxThicknessMm: 32, pricePerSheet: 50 },
  ],
  laborPerType: { BAZA: 150, SUSPENDAT: 130, INALT: 200, SERTARE: 220, COLT: 180 },
};

describe('computeCosts — corp bază de referință', () => {
  // Corp B1: 600×720×560, 1 poliță, 1 ușă MDF vopsit, spate PFL în falț.
  // Calcul de mână (vezi spec): plăci 552.03, cant 3.13, debitare 83,
  // feronerie 48 (2 balamale×15 + 1 mâner×10 + 4 picioare×2), manoperă 150.
  const expanded = expandCabinet(bazaInput(), TEST_CATALOGS, DEFAULT_CONSTRUCTION);

  const result = computeCosts({
    parts: expanded.parts,
    hardwareLines: [
      { hardwareId: 'blum-cliptop', qty: 2 },
      { hardwareId: 'maner-std', qty: 1 },
      { hardwareId: 'picior-std', qty: 4 },
    ],
    cabinets: [expanded.input],
    freeLines: [],
    markupPct: 30,
    yieldFactor: 0.8,
    catalogs: COST_CATALOGS,
  });

  it('categoriile de cost', () => {
    expect(result.breakdown.boards).toBeCloseTo(552.03, 1);        // 260 + 100 + 0.4267×450
    expect(result.breakdown.edging).toBeCloseTo(3.13, 1);          // 3.132 ml × 1
    expect(result.breakdown.cuttingService).toBeCloseTo(83, 5);    // PAL 50 + PFL 33
    expect(result.breakdown.hardware).toBeCloseTo(48, 5);
    expect(result.breakdown.labor).toBeCloseTo(150, 5);
    expect(result.breakdown.freeLines).toBe(0);
  });

  it('total, adaos și lei/ml', () => {
    expect(result.totalCost).toBeCloseTo(836.16, 1);
    expect(result.sellPrice).toBeCloseTo(1087.01, 1);              // ×1.3
    expect(result.leiPerMl).toBeCloseTo(1811.69, 0);               // / 0.6 m
  });
});

describe('computeCosts — cazuri particulare', () => {
  it('linii libere intră în total', () => {
    const r = computeCosts({
      parts: [], hardwareLines: [], cabinets: [], yieldFactor: 0.8, markupPct: 0,
      freeLines: [{ name: 'Blat', amount: 800 }, { name: 'Transport', amount: 200 }],
      catalogs: COST_CATALOGS,
    });
    expect(r.breakdown.freeLines).toBe(1000);
    expect(r.totalCost).toBe(1000);
    expect(r.sellPrice).toBe(1000);
    expect(r.leiPerMl).toBeNull();
  });

  it('feronerie inexistentă în catalog → eroare', () => {
    expect(() =>
      computeCosts({
        parts: [], hardwareLines: [{ hardwareId: 'nu-exista', qty: 1 }],
        cabinets: [], freeLines: [], markupPct: 0, yieldFactor: 0.8,
        catalogs: COST_CATALOGS,
      }),
    ).toThrow(/feronerie/i);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/costing.test.ts`
Expected: FAIL — `Cannot find module '../costing'`.

- [ ] **Step 3: Implementează**

`lib/engine/costing.ts`:
```ts
import { findMaterial } from './carcass';
import { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
import type {
  CabinetInput, CabinetType, Catalogs, CuttingRate, FreeLine,
  HardwareItem, HardwareLine, Part,
} from './types';

export interface CostCatalogs extends Catalogs {
  hardware: HardwareItem[];
  cuttingRates: CuttingRate[];
  laborPerType: Record<CabinetType, number>;
}

export interface CostBreakdown {
  boards: number;
  edging: number;
  cuttingService: number;
  hardware: number;
  labor: number;
  freeLines: number;
}

export interface CostResult {
  breakdown: CostBreakdown;
  totalCost: number;
  sellPrice: number;
  leiPerMl: number | null;
  needs: { boards: BoardNeed[]; edging: EdgingNeed[] };
}

const BASE_RUN_TYPES = new Set<CabinetType>(['BAZA', 'SERTARE', 'COLT']);

export function computeCosts(args: {
  parts: Part[];
  hardwareLines: HardwareLine[];
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  markupPct: number;
  yieldFactor: number;
  catalogs: CostCatalogs;
}): CostResult {
  const { catalogs } = args;
  const needs = computeMaterialNeeds(args.parts, catalogs, args.yieldFactor);

  let boards = 0;
  let cuttingService = 0;
  for (const need of needs.boards) {
    const material = findMaterial(catalogs, need.materialId);
    if (material.pricing.mode === 'PER_SQM') {
      boards += need.totalAreaSqm * material.pricing.pricePerSqm;
    } else {
      const sheets = need.sheets ?? 0;
      boards += sheets * material.pricing.pricePerSheet;
      const rate = catalogs.cuttingRates.find((r) => r.maxThicknessMm >= material.thicknessMm);
      if (rate) cuttingService += sheets * rate.pricePerSheet;
    }
  }

  let edging = 0;
  for (const e of needs.edging) {
    const band = catalogs.edgeBands.find((b) => b.id === e.edgeBandId);
    if (!band) throw new Error(`Cant inexistent în catalog: ${e.edgeBandId}`);
    edging += e.totalMl * band.pricePerMl;
  }

  let hardware = 0;
  for (const line of args.hardwareLines) {
    const item = catalogs.hardware.find((h) => h.id === line.hardwareId);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${line.hardwareId}`);
    hardware += line.qty * item.pricePerUnit;
  }

  const labor = args.cabinets.reduce((sum, c) => sum + catalogs.laborPerType[c.type], 0);
  const freeLines = args.freeLines.reduce((sum, l) => sum + l.amount, 0);

  const breakdown: CostBreakdown = { boards, edging, cuttingService, hardware, labor, freeLines };
  const totalCost = boards + edging + cuttingService + hardware + labor + freeLines;
  const sellPrice = totalCost * (1 + args.markupPct / 100);

  const baseRunM = args.cabinets
    .filter((c) => BASE_RUN_TYPES.has(c.type))
    .reduce((sum, c) => sum + c.widthMm, 0) / 1000;
  const leiPerMl = baseRunM > 0 ? sellPrice / baseRunM : null;

  return { breakdown, totalCost, sellPrice, leiPerMl, needs };
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/costing.test.ts`
Expected: PASS (4 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/costing.ts lib/engine/__tests__/costing.test.ts
git commit -m "feat: six-category cost computation with markup and lei/ml"
```

---

### Task 11: Listă debitare CSV și agregare feronerie

**Files:**
- Create: `lib/engine/cutlist.ts`
- Test: `lib/engine/__tests__/cutlist.test.ts`

**Interfaces:**
- Consumes: `findMaterial` din `./carcass`, tipuri.
- Produces:
```ts
export interface CutListFile { materialId: string; materialName: string; csv: string }
export function cutListCsv(parts: Part[], catalogs: Catalogs): CutListFile[]
export interface HardwareSummaryRow { name: string; qty: number }
export function aggregateHardware(lines: HardwareLine[], items: HardwareItem[]): HardwareSummaryRow[]
```
Format CSV (un fișier per material, separator `;`, zecimale cu virgulă, dimensiuni rotunjite la 0.1mm): antet `Corp;Denumire;Lungime;Latime;Buc;Cant L1;Cant L2;Cant l1;Cant l2`; celulele de cant conțin numele cantului sau gol. Folosit de UI/exporturi în Planul 2.

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/cutlist.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { aggregateHardware, cutListCsv } from '../cutlist';
import { TEST_CATALOGS } from './fixtures';
import type { Part } from '../types';

const PARTS: Part[] = [
  {
    cabinetLabel: 'B1', name: 'Laterală', lengthMm: 720, widthMm: 560, qty: 2,
    materialId: 'pal-alb', edges: { l1: 'abs-04' },
  },
  {
    cabinetLabel: 'B1', name: 'Ușă', lengthMm: 716, widthMm: 296.5, qty: 2,
    materialId: 'mdf-vopsit', edges: {},
  },
];

describe('cutListCsv', () => {
  it('un fișier per material, cu antet și rânduri corecte', () => {
    const files = cutListCsv(PARTS, TEST_CATALOGS);
    expect(files).toHaveLength(2);

    const pal = files.find((f) => f.materialId === 'pal-alb')!;
    const lines = pal.csv.trim().split('\n');
    expect(lines[0]).toBe('Corp;Denumire;Lungime;Latime;Buc;Cant L1;Cant L2;Cant l1;Cant l2');
    expect(lines[1]).toBe('B1;Laterală;720;560;2;ABS 0.4mm;;;');

    const mdf = files.find((f) => f.materialId === 'mdf-vopsit')!;
    // zecimale cu virgulă
    expect(mdf.csv).toContain('B1;Ușă;716;296,5;2;;;;');
  });
});

describe('aggregateHardware', () => {
  it('agregă pe denumire cu cantități totale', () => {
    const items = [
      { id: 'h1', name: 'Balama Blum', category: 'BALAMA' as const, pricePerUnit: 15 },
      { id: 'h2', name: 'Mâner', category: 'MANER' as const, pricePerUnit: 10 },
    ];
    const rows = aggregateHardware(
      [{ hardwareId: 'h1', qty: 4 }, { hardwareId: 'h1', qty: 2 }, { hardwareId: 'h2', qty: 3 }],
      items,
    );
    expect(rows).toContainEqual({ name: 'Balama Blum', qty: 6 });
    expect(rows).toContainEqual({ name: 'Mâner', qty: 3 });
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/cutlist.test.ts`
Expected: FAIL — `Cannot find module '../cutlist'`.

- [ ] **Step 3: Implementează**

`lib/engine/cutlist.ts`:
```ts
import { findMaterial } from './carcass';
import type { Catalogs, HardwareItem, HardwareLine, Part } from './types';

export interface CutListFile {
  materialId: string;
  materialName: string;
  csv: string;
}

export interface HardwareSummaryRow {
  name: string;
  qty: number;
}

const HEADER = 'Corp;Denumire;Lungime;Latime;Buc;Cant L1;Cant L2;Cant l1;Cant l2';

function formatMm(n: number): string {
  return String(Math.round(n * 10) / 10).replace('.', ',');
}

export function cutListCsv(parts: Part[], catalogs: Catalogs): CutListFile[] {
  const bandName = (id?: string) =>
    id ? (catalogs.edgeBands.find((b) => b.id === id)?.name ?? id) : '';

  const byMaterial = new Map<string, Part[]>();
  for (const p of parts) {
    const list = byMaterial.get(p.materialId) ?? [];
    list.push(p);
    byMaterial.set(p.materialId, list);
  }

  return [...byMaterial.entries()].map(([materialId, list]) => {
    const rows = list.map((p) =>
      [
        p.cabinetLabel, p.name, formatMm(p.lengthMm), formatMm(p.widthMm), p.qty,
        bandName(p.edges.l1), bandName(p.edges.l2), bandName(p.edges.w1), bandName(p.edges.w2),
      ].join(';'),
    );
    return {
      materialId,
      materialName: findMaterial(catalogs, materialId).name,
      csv: [HEADER, ...rows].join('\n') + '\n',
    };
  });
}

export function aggregateHardware(
  lines: HardwareLine[],
  items: HardwareItem[],
): HardwareSummaryRow[] {
  const byId = new Map<string, number>();
  for (const line of lines) {
    byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  }
  return [...byId.entries()].map(([id, qty]) => {
    const item = items.find((h) => h.id === id);
    if (!item) throw new Error(`Feronerie inexistentă în catalog: ${id}`);
    return { name: item.name, qty };
  });
}
```

- [ ] **Step 4: Rulează testul — trebuie să treacă**

Run: `npx vitest run lib/engine/__tests__/cutlist.test.ts`
Expected: PASS (2 teste).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/cutlist.ts lib/engine/__tests__/cutlist.test.ts
git commit -m "feat: cut list CSV export and hardware aggregation"
```

---

### Task 12: computeProject + test de integrare (bucătărie de referință)

**Files:**
- Create: `lib/engine/index.ts`
- Test: `lib/engine/__tests__/integration.test.ts`

**Interfaces:**
- Consumes: toate modulele anterioare.
- Produces:
```ts
export interface ProjectInput {
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  markupPct: number;
  yieldFactor: number;
}
export interface ProjectCatalogs extends CostCatalogs {
  hardwareDefaults: HardwareDefaults;
}
export interface ProjectResult {
  cabinets: ExpandedCabinet[];
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  costs: CostResult;
  warnings: Warning[];
}
export function computeProject(
  project: ProjectInput,
  catalogs: ProjectCatalogs,
  cc?: ConstructionConstants,   // implicit DEFAULT_CONSTRUCTION
): ProjectResult
```
`index.ts` re-exportă și API-ul public: toate tipurile, `DEFAULT_CONSTRUCTION`, `expandCabinet`, `computeMaterialNeeds`, `computeCosts`, `cutListCsv`, `aggregateHardware`, `resolveSuggestions`. Acesta e contractul pe care îl consumă Planul 2.

- [ ] **Step 1: Scrie testul care pică**

`lib/engine/__tests__/integration.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeProject, type ProjectCatalogs } from '../index';
import { bazaInput, TEST_CATALOGS } from './fixtures';

const CATALOGS: ProjectCatalogs = {
  ...TEST_CATALOGS,
  hardware: [
    { id: 'blum-cliptop', name: 'Balama Blum ClipTop', category: 'BALAMA', pricePerUnit: 15 },
    { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10 },
    { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2 },
  ],
  cuttingRates: [
    { maxThicknessMm: 10, pricePerSheet: 33 },
    { maxThicknessMm: 32, pricePerSheet: 50 },
  ],
  laborPerType: { BAZA: 150, SUSPENDAT: 130, INALT: 200, SERTARE: 220, COLT: 180 },
  hardwareDefaults: {
    hingeId: 'blum-cliptop',
    slideIdsByNominal: {},
    handleId: 'maner-std',
    legId: 'picior-std',
    railId: null,
  },
};

describe('computeProject — corp bază de referință (calcul de mână)', () => {
  const result = computeProject(
    { cabinets: [bazaInput()], freeLines: [], markupPct: 30, yieldFactor: 0.8 },
    CATALOGS,
  );

  it('piese: carcasă + spate + ușă', () => {
    expect(result.parts).toHaveLength(5); // Laterală, Blat/Fund, Poliță, Spate, Ușă
  });

  it('feronerie rezolvată automat: 2 balamale, 1 mâner, 4 picioare', () => {
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'maner-std', qty: 1 });
    expect(result.hardwareLines).toContainEqual({ hardwareId: 'picior-std', qty: 4 });
    expect(result.unresolvedHardware).toEqual([]);
  });

  it('necesar: 1 foaie PAL, 1 foaie PFL', () => {
    const pal = result.costs.needs.boards.find((b) => b.materialId === 'pal-alb')!;
    const pfl = result.costs.needs.boards.find((b) => b.materialId === 'pfl-alb')!;
    expect(pal.sheets).toBe(1);
    expect(pfl.sheets).toBe(1);
  });

  it('costuri identice cu calculul de mână', () => {
    expect(result.costs.totalCost).toBeCloseTo(836.16, 1);
    expect(result.costs.sellPrice).toBeCloseTo(1087.01, 1);
    expect(result.costs.leiPerMl).toBeCloseTo(1811.69, 0);
  });

  it('fără avertismente pe corpul de referință', () => {
    expect(result.warnings).toEqual([]);
  });
});

describe('computeProject — feronerie fără default merge în unresolved', () => {
  it('corp suspendat fără railId → sugestia de șină rămâne nerezolvată', () => {
    const result = computeProject(
      {
        cabinets: [bazaInput({ type: 'SUSPENDAT', depthMm: 320 })],
        freeLines: [], markupPct: 30, yieldFactor: 0.8,
      },
      CATALOGS,
    );
    expect(result.unresolvedHardware.some((s) => s.category === 'SINA_SUSPENDARE')).toBe(true);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/engine/__tests__/integration.test.ts`
Expected: FAIL — `computeProject` nu există încă în `../index`.

- [ ] **Step 3: Implementează**

`lib/engine/index.ts`:
```ts
import { DEFAULT_CONSTRUCTION } from './constants';
import { computeCosts, type CostCatalogs, type CostResult } from './costing';
import { resolveSuggestions } from './hardware';
import { expandCabinet } from './templates';
import type {
  CabinetInput, ConstructionConstants, ExpandedCabinet, FreeLine,
  HardwareDefaults, HardwareLine, HardwareSuggestion, Part, Warning,
} from './types';

export interface ProjectInput {
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  markupPct: number;
  yieldFactor: number;
}

export interface ProjectCatalogs extends CostCatalogs {
  hardwareDefaults: HardwareDefaults;
}

export interface ProjectResult {
  cabinets: ExpandedCabinet[];
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  costs: CostResult;
  warnings: Warning[];
}

export function computeProject(
  project: ProjectInput,
  catalogs: ProjectCatalogs,
  cc: ConstructionConstants = DEFAULT_CONSTRUCTION,
): ProjectResult {
  const cabinets = project.cabinets.map((c) => expandCabinet(c, catalogs, cc));
  const parts = cabinets.flatMap((c) => c.parts);
  const suggestions = cabinets.flatMap((c) => c.hardware);
  const { lines, unresolved } = resolveSuggestions(suggestions, catalogs.hardwareDefaults);

  const costs = computeCosts({
    parts,
    hardwareLines: lines,
    cabinets: project.cabinets,
    freeLines: project.freeLines,
    markupPct: project.markupPct,
    yieldFactor: project.yieldFactor,
    catalogs,
  });

  return {
    cabinets,
    parts,
    hardwareLines: lines,
    unresolvedHardware: unresolved,
    costs,
    warnings: cabinets.flatMap((c) => c.warnings),
  };
}

// API public al motorului — consumat de aplicația web (Planul 2)
export { DEFAULT_CONSTRUCTION } from './constants';
export { expandCabinet } from './templates';
export { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
export { computeCosts, type CostCatalogs, type CostBreakdown, type CostResult } from './costing';
export { cutListCsv, aggregateHardware, type CutListFile, type HardwareSummaryRow } from './cutlist';
export { suggestHardware, resolveSuggestions } from './hardware';
export { suggestHingeCount, doorWeightKg } from './hinges';
export { pickSlideNominal } from './drawers';
export * from './types';
```

- [ ] **Step 4: Rulează toată suita — trebuie să treacă**

Run: `npm test`
Expected: PASS — toate fișierele de test (smoke, constants, carcass, fronts, hinges, drawers, hardware, templates, needs, costing, cutlist, integration).

Run: `npm run build`
Expected: build Next.js reușit (motorul compilează în strict mode).

- [ ] **Step 5: Commit**

```bash
git add lib/engine/index.ts lib/engine/__tests__/integration.test.ts
git commit -m "feat: computeProject orchestration and public engine API"
```

---

## După acest plan

Planul 2 (scris după executarea acestuia) acoperă: Prisma + PostgreSQL cu schema cataloagelor și proiectelor (inclusiv snapshot de prețuri), autentificare, UI cataloage (CRUD), UI proiecte/corpuri (formulare + tabel piese editabil + feronerie editabilă), ecran rezumat costuri și cele 4 exporturi (ofertă PDF, necesar materiale, descărcare CSV debitare, listă feronerie). **Criteriul de acceptanță din spec** (bucătărie reală ofertată manual → aceleași cifre) se validează la finalul Planului 2, cu date reale în cataloage.

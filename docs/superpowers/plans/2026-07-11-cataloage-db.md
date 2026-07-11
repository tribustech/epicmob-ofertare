# Cataloage + DB SQLite (Plan 2/3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baza de date locală (Prisma + SQLite) cu toate cataloagele de prețuri, zona de administrare UI (materiale, canturi, feronerie, tarife debitare, manoperă, setări) și stratul de conversie DB → tipurile motorului.

**Architecture:** Aplicație Next.js locală, fără autentificare. Prisma + SQLite (`file:./dev.db`). Paginile sunt server components care citesc direct din Prisma; mutațiile sunt server actions validate cu zod. Stratul `lib/catalog/convert.ts` e pur (interfețe proprii de rând, fără import din @prisma/client) și transformă rândurile DB în tipurile motorului din `lib/engine` — testabil fără DB. Proiectele și exporturile vin în Planul 3.

**Tech Stack:** Next.js 15 (existent), Prisma ^6 + SQLite, zod ^3.24, Tailwind CSS v4, tsx (pentru seed), Vitest (existent).

## Global Constraints

- Motorul `lib/engine/**` NU se modifică în acest plan; `lib/catalog/convert.ts` importă doar tipuri/constante din `@/lib/engine` și NU importă `@prisma/client` (interfețe de rând proprii, structural compatibile).
- Enum-urile sunt stringuri în SQLite; validarea lor se face cu zod la intrare și în convertoare la ieșire (throw cu mesaj românesc la valoare necunoscută).
- Ștergerea pentru Material/EdgeBand/HardwareItem = **soft delete** (`active: false`) — proiectele viitoare pot referenția id-uri vechi. CuttingRate = hard delete. LaborRate = doar update (exact 5 rânduri fixe, unul per tip corp).
- `AppSettings` e un singleton (id = 1), garantat de seed; conține adaos implicit, factor de utilizare, constantele de construcție ca JSON și feroneria implicită (balama/mâner/picior/șină).
- Textele UI în română; identificatori de cod în engleză. Rute: `/cataloage/materiale`, `/cataloage/canturi`, `/cataloage/feronerie`, `/cataloage/debitare`, `/cataloage/manopera`, `/setari`.
- `npm test` (vitest) și `npm run build` trec după fiecare task. Commit după fiecare task (conventional commits).
- Fișierul DB `dev.db` NU se comite (gitignore); migrațiile Prisma SE comit.

## File Structure

```
epic-mob-ofertare/
├── app/
│   ├── globals.css                    # Tailwind v4 (@import "tailwindcss")
│   ├── layout.tsx                     # + nav
│   ├── page.tsx                       # homepage cu linkuri
│   ├── cataloage/
│   │   ├── materiale/page.tsx
│   │   ├── canturi/page.tsx
│   │   ├── feronerie/page.tsx
│   │   ├── debitare/page.tsx
│   │   └── manopera/page.tsx
│   └── setari/page.tsx
├── components/
│   ├── forms.tsx                      # TextInput, NumberInput, Select, SubmitButton (server-safe)
│   └── DeleteButton.tsx               # client, confirm()
├── lib/
│   ├── db.ts                          # PrismaClient singleton
│   └── catalog/
│       ├── convert.ts                 # rânduri DB → tipuri engine (pur)
│       ├── schemas.ts                 # zod schemas (pur)
│       └── actions.ts                 # server actions CRUD
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
└── .env                               # DATABASE_URL="file:./dev.db" (necomis; .env.example comis)
```

---

### Task 1: Tailwind v4 + shell de navigare

**Files:**
- Create: `app/globals.css`, `postcss.config.mjs`
- Modify: `app/layout.tsx`, `app/page.tsx`, `package.json` (deps)

**Interfaces:**
- Produces: layout cu navigare folosit de toate paginile din task-urile 7-9; clase Tailwind disponibile global.

- [ ] **Step 1: Instalează Tailwind v4**

Run: `npm install -D tailwindcss@^4.1.0 @tailwindcss/postcss@^4.1.0 postcss@^8.5.0`

`postcss.config.mjs`:
```js
export default {
  plugins: { '@tailwindcss/postcss': {} },
};
```

`app/globals.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 2: Layout cu navigare + homepage**

`app/layout.tsx` (înlocuiește complet):
```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import './globals.css';

export const metadata = { title: 'EpicMob Ofertare' };

const NAV = [
  { href: '/cataloage/materiale', label: 'Materiale' },
  { href: '/cataloage/canturi', label: 'Canturi' },
  { href: '/cataloage/feronerie', label: 'Feronerie' },
  { href: '/cataloage/debitare', label: 'Debitare' },
  { href: '/cataloage/manopera', label: 'Manoperă' },
  { href: '/setari', label: 'Setări' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ro">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-bold">EpicMob Ofertare</Link>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-neutral-600 hover:text-neutral-900">
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
```

`app/page.tsx` (înlocuiește complet):
```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">EpicMob Ofertare</h1>
      <p className="text-neutral-600">
        Administrează cataloagele de prețuri din meniul de sus. Proiectele de ofertare vin în etapa următoare.
      </p>
      <Link href="/cataloage/materiale" className="inline-block rounded bg-neutral-900 px-4 py-2 text-white">
        Deschide cataloagele
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Verifică**

Run: `npm run build` — Expected: build reușit.
Run: `npm test` — Expected: 72/72 (nimic stricat).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: tailwind v4 and app shell with catalog navigation"
```

---

### Task 2: Prisma + SQLite — schemă și client

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `.env`, `.env.example`
- Modify: `package.json` (deps + scripts), `.gitignore`

**Interfaces:**
- Produces: modelele `Material`, `EdgeBand`, `HardwareItem`, `CuttingRate`, `LaborRate`, `AppSettings`; `prisma` client singleton din `@/lib/db`. Folosite de seed (Task 3), actions (Task 6) și pagini (Task 7-9).

- [ ] **Step 1: Instalează Prisma**

Run: `npm install @prisma/client && npm install -D prisma tsx`

- [ ] **Step 2: Scrie schema, env și clientul**

`prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Material {
  id            String   @id @default(cuid())
  name          String
  kind          String   // PAL | MDF_VOPSIT | MDF_MELAMINAT | MDF_INFOLIAT | PFL
  thicknessMm   Float
  sheetLengthMm Float
  sheetWidthMm  Float
  pricingMode   String   // PER_SHEET | PER_SQM
  pricePerSheet Float?
  pricePerSqm   Float?
  active        Boolean  @default(true)
  updatedAt     DateTime @updatedAt
}

model EdgeBand {
  id          String   @id @default(cuid())
  name        String
  thicknessMm Float
  pricePerMl  Float
  active      Boolean  @default(true)
  updatedAt   DateTime @updatedAt
}

model HardwareItem {
  id              String   @id @default(cuid())
  name            String
  category        String   // BALAMA | SERTAR | MANER | PICIOR | SINA_SUSPENDARE | ACCESORIU
  pricePerUnit    Float
  nominalLengthMm Float?
  loadClassKg     Float?
  active          Boolean  @default(true)
  updatedAt       DateTime @updatedAt
}

model CuttingRate {
  id             String @id @default(cuid())
  maxThicknessMm Float
  pricePerSheet  Float
}

model LaborRate {
  cabinetType String @id // BAZA | SUSPENDAT | INALT | SERTARE | COLT
  price       Float
}

model AppSettings {
  id               Int     @id @default(1)
  markupPct        Float
  sheetYieldFactor Float
  constructionJson String
  defaultHingeId   String?
  defaultHandleId  String?
  defaultLegId     String?
  defaultRailId    String?
}
```

`.env` și `.env.example` (același conținut):
```
DATABASE_URL="file:./dev.db"
```

`lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

În `.gitignore` adaugă la final:
```
dev.db
dev.db-journal
```

În `package.json` adaugă scripturile:
```json
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
```
și blocul (la nivelul rădăcinii JSON):
```json
  "prisma": { "seed": "tsx prisma/seed.ts" }
```

- [ ] **Step 3: Rulează migrația inițială**

Run: `npx prisma migrate dev --name init`
Expected: migrația se creează în `prisma/migrations/`, `dev.db` apare, client generat.

- [ ] **Step 4: Verifică**

Run: `npx prisma validate` — Expected: schema validă.
Run: `npm run build && npm test` — Expected: build ok, 72/72.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: prisma sqlite schema for catalogs and settings"
```
(`.env` e ignorat de gitignore-ul existent; verifică cu `git status` că `dev.db` nu e inclus.)

---

### Task 3: Seed cu date de pornire românești

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: modelele din Task 2, `DEFAULT_CONSTRUCTION` din `@/lib/engine`.
- Produces: DB populată cu id-uri deterministe (ex. `pal-alb`, `balama-blum-cliptop`) pe care Setările le referențiază ca feronerie implicită. Seed idempotent (upsert) — se poate rula oricând.

- [ ] **Step 1: Scrie seed-ul**

`prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { DEFAULT_CONSTRUCTION } from '../lib/engine';

const prisma = new PrismaClient();

async function main() {
  const materials = [
    { id: 'pal-alb', name: 'PAL alb W980 18mm', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null },
    { id: 'pal-stejar', name: 'PAL stejar Halifax 18mm', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 330, pricePerSqm: null },
    { id: 'pfl-alb', name: 'PFL alb 3mm', kind: 'PFL', thicknessMm: 3, sheetLengthMm: 2850, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 100, pricePerSqm: null },
    { id: 'mdf-vopsit', name: 'MDF vopsit mat 18mm', kind: 'MDF_VOPSIT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450 },
    { id: 'mdf-infoliat', name: 'MDF înfoliat 18mm', kind: 'MDF_INFOLIAT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 320 },
  ];
  for (const m of materials) {
    await prisma.material.upsert({ where: { id: m.id }, update: m, create: m });
  }

  const edgeBands = [
    { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1 },
    { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2 },
    { id: 'abs-2', name: 'ABS 2mm', thicknessMm: 2, pricePerMl: 3 },
  ];
  for (const e of edgeBands) {
    await prisma.edgeBand.upsert({ where: { id: e.id }, update: e, create: e });
  }

  const hardware = [
    { id: 'balama-blum-cliptop', name: 'Balama Blum ClipTop Blumotion 110° + plăcuță', category: 'BALAMA', pricePerUnit: 15, nominalLengthMm: null, loadClassKg: null },
    { id: 'tandembox-450', name: 'Set Blum Tandembox antaro 450mm 30kg', category: 'SERTAR', pricePerUnit: 180, nominalLengthMm: 450, loadClassKg: 30 },
    { id: 'tandembox-500', name: 'Set Blum Tandembox antaro 500mm 30kg', category: 'SERTAR', pricePerUnit: 190, nominalLengthMm: 500, loadClassKg: 30 },
    { id: 'glisiera-bile-450', name: 'Glisiere bile 450mm (pereche)', category: 'SERTAR', pricePerUnit: 35, nominalLengthMm: 450, loadClassKg: 25 },
    { id: 'maner-standard', name: 'Mâner standard 128mm', category: 'MANER', pricePerUnit: 10, nominalLengthMm: null, loadClassKg: null },
    { id: 'picior-reglabil', name: 'Picior reglabil 100mm', category: 'PICIOR', pricePerUnit: 2.5, nominalLengthMm: null, loadClassKg: null },
    { id: 'sina-suspendare', name: 'Set suspendare corp (2 suporți + șină)', category: 'SINA_SUSPENDARE', pricePerUnit: 8, nominalLengthMm: null, loadClassKg: null },
  ];
  for (const h of hardware) {
    await prisma.hardwareItem.upsert({ where: { id: h.id }, update: h, create: h });
  }

  const cuttingRates = [
    { id: 'debitare-pfl', maxThicknessMm: 10, pricePerSheet: 33 },
    { id: 'debitare-pal-18', maxThicknessMm: 32, pricePerSheet: 50 },
    { id: 'debitare-pal-38', maxThicknessMm: 38, pricePerSheet: 70 },
  ];
  for (const c of cuttingRates) {
    await prisma.cuttingRate.upsert({ where: { id: c.id }, update: c, create: c });
  }

  const laborRates = [
    { cabinetType: 'BAZA', price: 150 },
    { cabinetType: 'SUSPENDAT', price: 130 },
    { cabinetType: 'INALT', price: 200 },
    { cabinetType: 'SERTARE', price: 220 },
    { cabinetType: 'COLT', price: 180 },
  ];
  for (const l of laborRates) {
    await prisma.laborRate.upsert({ where: { cabinetType: l.cabinetType }, update: l, create: l });
  }

  const settings = {
    id: 1,
    markupPct: 30,
    sheetYieldFactor: 0.8,
    constructionJson: JSON.stringify(DEFAULT_CONSTRUCTION),
    defaultHingeId: 'balama-blum-cliptop',
    defaultHandleId: 'maner-standard',
    defaultLegId: 'picior-reglabil',
    defaultRailId: 'sina-suspendare',
  };
  await prisma.appSettings.upsert({ where: { id: 1 }, update: settings, create: settings });

  console.log('Seed complet.');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rulează și verifică**

Run: `npm run db:seed` — Expected: "Seed complet."
Run: `npm run db:seed` a doua oară — Expected: tot "Seed complet." (idempotent, fără erori de unicitate).
Run: `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.material.count().then(c => { console.log('materiale:', c); return p.\$disconnect(); });"` — Expected: `materiale: 5`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: seed catalogs with Romanian starter data"
```

---

### Task 4: Convertoare DB → tipuri engine (pur, TDD)

**Files:**
- Create: `lib/catalog/convert.ts`
- Test: `lib/catalog/__tests__/convert.test.ts`

**Interfaces:**
- Consumes: tipuri și `DEFAULT_CONSTRUCTION` din `@/lib/engine`. NU importă `@prisma/client`.
- Produces (folosite de pagini/actions și de Planul 3):
```ts
export interface MaterialRow { id: string; name: string; kind: string; thicknessMm: number; sheetLengthMm: number; sheetWidthMm: number; pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null }
export interface EdgeBandRow { id: string; name: string; thicknessMm: number; pricePerMl: number }
export interface HardwareRow { id: string; name: string; category: string; pricePerUnit: number; nominalLengthMm: number | null; loadClassKg: number | null }
export interface CuttingRateRow { maxThicknessMm: number; pricePerSheet: number }
export interface LaborRateRow { cabinetType: string; price: number }
export interface SettingsRow { markupPct: number; sheetYieldFactor: number; constructionJson: string; defaultHingeId: string | null; defaultHandleId: string | null; defaultLegId: string | null; defaultRailId: string | null }

export function toBoardMaterial(row: MaterialRow): BoardMaterial
export function toCostCatalogs(materials: MaterialRow[], edgeBands: EdgeBandRow[], hardware: HardwareRow[], cuttingRates: CuttingRateRow[], laborRates: LaborRateRow[]): CostCatalogs
export function buildHardwareDefaults(hardware: HardwareRow[], settings: SettingsRow): HardwareDefaults
export function parseConstruction(json: string): ConstructionConstants
```
Reguli: kind/category/pricingMode/cabinetType necunoscute → throw mesaj românesc; PER_SHEET fără pricePerSheet (sau PER_SQM fără pricePerSqm) → throw; `toCostCatalogs` cere toate cele 5 tipuri de corp în laborRates; `buildHardwareDefaults` construiește `slideIdsByNominal` din itemele SERTAR cu nominalLengthMm (la duplicat pe aceeași nominală câștigă cel mai ieftin); `parseConstruction` face merge peste `DEFAULT_CONSTRUCTION` (câmpuri lipsă din JSON → valorile implicite).

- [ ] **Step 1: Scrie testul care pică**

`lib/catalog/__tests__/convert.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  buildHardwareDefaults, parseConstruction, toBoardMaterial, toCostCatalogs,
  type HardwareRow, type MaterialRow, type SettingsRow,
} from '../convert';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';

const palRow: MaterialRow = {
  id: 'pal-alb', name: 'PAL alb', kind: 'PAL', thicknessMm: 18,
  sheetLengthMm: 2800, sheetWidthMm: 2070,
  pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null,
};
const mdfRow: MaterialRow = { ...palRow, id: 'mdf-v', kind: 'MDF_VOPSIT', pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450 };

const LABOR = [
  { cabinetType: 'BAZA', price: 150 }, { cabinetType: 'SUSPENDAT', price: 130 },
  { cabinetType: 'INALT', price: 200 }, { cabinetType: 'SERTARE', price: 220 },
  { cabinetType: 'COLT', price: 180 },
];

describe('toBoardMaterial', () => {
  it('PER_SHEET → union cu pricePerSheet', () => {
    expect(toBoardMaterial(palRow).pricing).toEqual({ mode: 'PER_SHEET', pricePerSheet: 260 });
  });
  it('PER_SQM → union cu pricePerSqm', () => {
    expect(toBoardMaterial(mdfRow).pricing).toEqual({ mode: 'PER_SQM', pricePerSqm: 450 });
  });
  it('kind necunoscut → eroare', () => {
    expect(() => toBoardMaterial({ ...palRow, kind: 'OSB' })).toThrow(/tip de material/i);
  });
  it('PER_SHEET fără preț → eroare', () => {
    expect(() => toBoardMaterial({ ...palRow, pricePerSheet: null })).toThrow(/preț/i);
  });
});

describe('toCostCatalogs', () => {
  it('sortează cuttingRates crescător și construiește laborPerType', () => {
    const c = toCostCatalogs([palRow], [], [], [
      { maxThicknessMm: 32, pricePerSheet: 50 },
      { maxThicknessMm: 10, pricePerSheet: 33 },
    ], LABOR);
    expect(c.cuttingRates[0].maxThicknessMm).toBe(10);
    expect(c.laborPerType.SERTARE).toBe(220);
  });
  it('tip de corp lipsă din manoperă → eroare', () => {
    expect(() => toCostCatalogs([], [], [], [], LABOR.slice(0, 4))).toThrow(/manoper/i);
  });
});

describe('buildHardwareDefaults', () => {
  const settings: SettingsRow = {
    markupPct: 30, sheetYieldFactor: 0.8, constructionJson: '{}',
    defaultHingeId: 'h1', defaultHandleId: null, defaultLegId: 'l1', defaultRailId: null,
  };
  const slides: HardwareRow[] = [
    { id: 's450-scump', name: 'A', category: 'SERTAR', pricePerUnit: 180, nominalLengthMm: 450, loadClassKg: 30 },
    { id: 's450-ieftin', name: 'B', category: 'SERTAR', pricePerUnit: 35, nominalLengthMm: 450, loadClassKg: 25 },
    { id: 's500', name: 'C', category: 'SERTAR', pricePerUnit: 190, nominalLengthMm: 500, loadClassKg: 30 },
  ];
  it('slideIdsByNominal din itemele SERTAR; duplicat → cel mai ieftin', () => {
    const d = buildHardwareDefaults(slides, settings);
    expect(d.slideIdsByNominal).toEqual({ 450: 's450-ieftin', 500: 's500' });
    expect(d.hingeId).toBe('h1');
    expect(d.handleId).toBeNull();
  });
});

describe('parseConstruction', () => {
  it('merge peste DEFAULT_CONSTRUCTION', () => {
    const c = parseConstruction(JSON.stringify({ frontGapMm: 4 }));
    expect(c.frontGapMm).toBe(4);
    expect(c.shelfSetbackMm).toBe(DEFAULT_CONSTRUCTION.shelfSetbackMm);
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/catalog/__tests__/convert.test.ts`
Expected: FAIL — `Cannot find module '../convert'`.
(Notă: pattern-ul vitest e `lib/**/__tests__/**/*.test.ts`, deci noul director e inclus automat.)

- [ ] **Step 3: Implementează**

`lib/catalog/convert.ts`:
```ts
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import type {
  BoardMaterial, CabinetType, ConstructionConstants, CostCatalogs,
  EdgeBand, HardwareCategory, HardwareDefaults, HardwareItem, MaterialKind,
} from '@/lib/engine';

export interface MaterialRow {
  id: string; name: string; kind: string; thicknessMm: number;
  sheetLengthMm: number; sheetWidthMm: number;
  pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
}
export interface EdgeBandRow { id: string; name: string; thicknessMm: number; pricePerMl: number }
export interface HardwareRow {
  id: string; name: string; category: string; pricePerUnit: number;
  nominalLengthMm: number | null; loadClassKg: number | null;
}
export interface CuttingRateRow { maxThicknessMm: number; pricePerSheet: number }
export interface LaborRateRow { cabinetType: string; price: number }
export interface SettingsRow {
  markupPct: number; sheetYieldFactor: number; constructionJson: string;
  defaultHingeId: string | null; defaultHandleId: string | null;
  defaultLegId: string | null; defaultRailId: string | null;
}

const MATERIAL_KINDS: MaterialKind[] = ['PAL', 'MDF_VOPSIT', 'MDF_MELAMINAT', 'MDF_INFOLIAT', 'PFL'];
const HARDWARE_CATEGORIES: HardwareCategory[] = ['BALAMA', 'SERTAR', 'MANER', 'PICIOR', 'SINA_SUSPENDARE', 'ACCESORIU'];
const CABINET_TYPES: CabinetType[] = ['BAZA', 'SUSPENDAT', 'INALT', 'SERTARE', 'COLT'];

export function toBoardMaterial(row: MaterialRow): BoardMaterial {
  if (!MATERIAL_KINDS.includes(row.kind as MaterialKind)) {
    throw new Error(`Tip de material necunoscut: ${row.kind} (${row.name})`);
  }
  let pricing: BoardMaterial['pricing'];
  if (row.pricingMode === 'PER_SHEET') {
    if (row.pricePerSheet == null) throw new Error(`Materialul ${row.name} nu are preț per foaie`);
    pricing = { mode: 'PER_SHEET', pricePerSheet: row.pricePerSheet };
  } else if (row.pricingMode === 'PER_SQM') {
    if (row.pricePerSqm == null) throw new Error(`Materialul ${row.name} nu are preț per m²`);
    pricing = { mode: 'PER_SQM', pricePerSqm: row.pricePerSqm };
  } else {
    throw new Error(`Mod de preț necunoscut: ${row.pricingMode} (${row.name})`);
  }
  return {
    id: row.id, name: row.name, kind: row.kind as MaterialKind,
    thicknessMm: row.thicknessMm, sheetLengthMm: row.sheetLengthMm, sheetWidthMm: row.sheetWidthMm,
    pricing,
  };
}

function toEdgeBand(row: EdgeBandRow): EdgeBand {
  return { id: row.id, name: row.name, thicknessMm: row.thicknessMm, pricePerMl: row.pricePerMl };
}

function toHardwareItem(row: HardwareRow): HardwareItem {
  if (!HARDWARE_CATEGORIES.includes(row.category as HardwareCategory)) {
    throw new Error(`Categorie de feronerie necunoscută: ${row.category} (${row.name})`);
  }
  return {
    id: row.id, name: row.name, category: row.category as HardwareCategory,
    pricePerUnit: row.pricePerUnit,
    nominalLengthMm: row.nominalLengthMm ?? undefined,
    loadClassKg: row.loadClassKg ?? undefined,
  };
}

export function toCostCatalogs(
  materials: MaterialRow[],
  edgeBands: EdgeBandRow[],
  hardware: HardwareRow[],
  cuttingRates: CuttingRateRow[],
  laborRates: LaborRateRow[],
): CostCatalogs {
  const laborPerType = {} as Record<CabinetType, number>;
  for (const type of CABINET_TYPES) {
    const row = laborRates.find((l) => l.cabinetType === type);
    if (!row) throw new Error(`Lipsește tariful de manoperă pentru tipul de corp ${type}`);
    laborPerType[type] = row.price;
  }
  return {
    materials: materials.map(toBoardMaterial),
    edgeBands: edgeBands.map(toEdgeBand),
    hardware: hardware.map(toHardwareItem),
    cuttingRates: [...cuttingRates]
      .sort((a, b) => a.maxThicknessMm - b.maxThicknessMm)
      .map((c) => ({ maxThicknessMm: c.maxThicknessMm, pricePerSheet: c.pricePerSheet })),
    laborPerType,
  };
}

export function buildHardwareDefaults(hardware: HardwareRow[], settings: SettingsRow): HardwareDefaults {
  const slideIdsByNominal: Record<number, string> = {};
  const cheapest: Record<number, number> = {};
  for (const h of hardware) {
    if (h.category !== 'SERTAR' || h.nominalLengthMm == null) continue;
    const nominal = h.nominalLengthMm;
    if (slideIdsByNominal[nominal] === undefined || h.pricePerUnit < cheapest[nominal]) {
      slideIdsByNominal[nominal] = h.id;
      cheapest[nominal] = h.pricePerUnit;
    }
  }
  if (!settings.defaultHingeId) throw new Error('Setările nu au o balama implicită configurată');
  return {
    hingeId: settings.defaultHingeId,
    slideIdsByNominal,
    handleId: settings.defaultHandleId,
    legId: settings.defaultLegId,
    railId: settings.defaultRailId,
  };
}

export function parseConstruction(json: string): ConstructionConstants {
  const parsed = JSON.parse(json) as Partial<ConstructionConstants>;
  return { ...DEFAULT_CONSTRUCTION, ...parsed };
}
```

- [ ] **Step 4: Rulează testele — trebuie să treacă**

Run: `npx vitest run lib/catalog/__tests__/convert.test.ts` — Expected: PASS (8 teste).
Run: `npm test` — Expected: 80/80.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/convert.ts lib/catalog/__tests__/convert.test.ts
git commit -m "feat: pure converters from db rows to engine catalog types"
```

---

### Task 5: Scheme zod pentru formulare (pur, TDD)

**Files:**
- Create: `lib/catalog/schemas.ts`
- Test: `lib/catalog/__tests__/schemas.test.ts`

**Interfaces:**
- Produces (folosite de actions în Task 6):
```ts
export const materialSchema: z.ZodType<...>   // name, kind, thicknessMm, sheetLengthMm, sheetWidthMm, pricingMode, pricePerSheet?, pricePerSqm?
export const edgeBandSchema
export const hardwareSchema                    // name, category, pricePerUnit, nominalLengthMm?, loadClassKg?
export const cuttingRateSchema                 // maxThicknessMm, pricePerSheet
export const laborRateSchema                   // price
export const settingsSchema                    // markupPct, sheetYieldFactor, defaultHingeId?, defaultHandleId?, defaultLegId?, defaultRailId?, construction.* numerice
export function formDataToObject(fd: FormData): Record<string, string>
```
Convenție: inputurile numerice vin ca stringuri din FormData; folosește un helper `num` (coerce, pozitiv) și `optNum` ("" → undefined). `materialSchema` refuză PER_SHEET fără pricePerSheet și PER_SQM fără pricePerSqm. `settingsSchema` validează markupPct ≥ 0, sheetYieldFactor în (0, 1].

- [ ] **Step 1: Instalează zod și scrie testul care pică**

Run: `npm install zod@^3.24.0`

`lib/catalog/__tests__/schemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formDataToObject, materialSchema, settingsSchema } from '../schemas';

describe('materialSchema', () => {
  const base = {
    name: 'PAL alb', kind: 'PAL', thicknessMm: '18',
    sheetLengthMm: '2800', sheetWidthMm: '2070',
    pricingMode: 'PER_SHEET', pricePerSheet: '260', pricePerSqm: '',
  };
  it('parsează stringuri din FormData în numere', () => {
    const m = materialSchema.parse(base);
    expect(m.thicknessMm).toBe(18);
    expect(m.pricePerSheet).toBe(260);
    expect(m.pricePerSqm).toBeUndefined();
  });
  it('PER_SHEET fără preț per foaie → invalid', () => {
    expect(() => materialSchema.parse({ ...base, pricePerSheet: '' })).toThrow();
  });
  it('PER_SQM fără preț per m² → invalid', () => {
    expect(() => materialSchema.parse({ ...base, pricingMode: 'PER_SQM', pricePerSheet: '', pricePerSqm: '' })).toThrow();
  });
  it('kind invalid → invalid', () => {
    expect(() => materialSchema.parse({ ...base, kind: 'OSB' })).toThrow();
  });
});

describe('settingsSchema', () => {
  it('validează factorul de utilizare în (0, 1]', () => {
    expect(() => settingsSchema.parse({ markupPct: '30', sheetYieldFactor: '1.2' })).toThrow();
    expect(settingsSchema.parse({ markupPct: '30', sheetYieldFactor: '0.8' }).sheetYieldFactor).toBe(0.8);
  });
});

describe('formDataToObject', () => {
  it('transformă FormData în obiect de stringuri', () => {
    const fd = new FormData();
    fd.set('name', 'X');
    fd.set('thicknessMm', '18');
    expect(formDataToObject(fd)).toEqual({ name: 'X', thicknessMm: '18' });
  });
});
```

- [ ] **Step 2: Rulează testul — trebuie să pice**

Run: `npx vitest run lib/catalog/__tests__/schemas.test.ts`
Expected: FAIL — `Cannot find module '../schemas'`.

- [ ] **Step 3: Implementează**

`lib/catalog/schemas.ts`:
```ts
import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);
const num = z.coerce.number().finite();
const posNum = num.positive();
const optPosNum = z.preprocess(emptyToUndefined, posNum.optional());

export function formDataToObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string') obj[key] = value;
  }
  return obj;
}

export const materialSchema = z
  .object({
    name: z.string().trim().min(1),
    kind: z.enum(['PAL', 'MDF_VOPSIT', 'MDF_MELAMINAT', 'MDF_INFOLIAT', 'PFL']),
    thicknessMm: posNum,
    sheetLengthMm: posNum,
    sheetWidthMm: posNum,
    pricingMode: z.enum(['PER_SHEET', 'PER_SQM']),
    pricePerSheet: optPosNum,
    pricePerSqm: optPosNum,
  })
  .refine(
    (d) => (d.pricingMode === 'PER_SHEET' ? d.pricePerSheet !== undefined : d.pricePerSqm !== undefined),
    { message: 'Lipsește prețul pentru modul de preț ales' },
  );

export const edgeBandSchema = z.object({
  name: z.string().trim().min(1),
  thicknessMm: posNum,
  pricePerMl: posNum,
});

export const hardwareSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(['BALAMA', 'SERTAR', 'MANER', 'PICIOR', 'SINA_SUSPENDARE', 'ACCESORIU']),
  pricePerUnit: posNum,
  nominalLengthMm: optPosNum,
  loadClassKg: optPosNum,
});

export const cuttingRateSchema = z.object({
  maxThicknessMm: posNum,
  pricePerSheet: posNum,
});

export const laborRateSchema = z.object({
  price: num.nonnegative(),
});

const optId = z.preprocess(emptyToUndefined, z.string().optional());

export const settingsSchema = z.object({
  markupPct: num.nonnegative(),
  sheetYieldFactor: num.gt(0).lte(1),
  defaultHingeId: optId,
  defaultHandleId: optId,
  defaultLegId: optId,
  defaultRailId: optId,
});
```

- [ ] **Step 4: Rulează testele — trebuie să treacă**

Run: `npx vitest run lib/catalog/__tests__/schemas.test.ts` — Expected: PASS (6 teste).
Run: `npm test` — Expected: 86/86.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/schemas.ts lib/catalog/__tests__/schemas.test.ts package.json package-lock.json
git commit -m "feat: zod schemas for catalog forms"
```

---

### Task 6: Server actions CRUD

**Files:**
- Create: `lib/catalog/actions.ts`

**Interfaces:**
- Consumes: `prisma` din `@/lib/db`, schemele din Task 5, `DEFAULT_CONSTRUCTION` din `@/lib/engine`.
- Produces (folosite de paginile din Task 7-9) — toate primesc `FormData` și fac `revalidatePath`:
```ts
createMaterial(fd), updateMaterial(id, fd), deactivateMaterial(id)
createEdgeBand(fd), updateEdgeBand(id, fd), deactivateEdgeBand(id)
createHardware(fd), updateHardware(id, fd), deactivateHardware(id)
createCuttingRate(fd), updateCuttingRate(id, fd), deleteCuttingRate(id)
updateLaborRate(cabinetType, fd)
updateSettings(fd)          // markup, yield, feronerie implicită
updateConstruction(fd)      // constantele de construcție → constructionJson
```

- [ ] **Step 1: Implementează**

`lib/catalog/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { DEFAULT_CONSTRUCTION } from '@/lib/engine';
import {
  cuttingRateSchema, edgeBandSchema, formDataToObject, hardwareSchema,
  laborRateSchema, materialSchema, settingsSchema,
} from './schemas';

function materialData(fd: FormData) {
  const d = materialSchema.parse(formDataToObject(fd));
  return {
    name: d.name, kind: d.kind, thicknessMm: d.thicknessMm,
    sheetLengthMm: d.sheetLengthMm, sheetWidthMm: d.sheetWidthMm,
    pricingMode: d.pricingMode,
    pricePerSheet: d.pricingMode === 'PER_SHEET' ? (d.pricePerSheet ?? null) : null,
    pricePerSqm: d.pricingMode === 'PER_SQM' ? (d.pricePerSqm ?? null) : null,
  };
}

export async function createMaterial(fd: FormData) {
  await prisma.material.create({ data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
}
export async function updateMaterial(id: string, fd: FormData) {
  await prisma.material.update({ where: { id }, data: materialData(fd) });
  revalidatePath('/cataloage/materiale');
}
export async function deactivateMaterial(id: string) {
  await prisma.material.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/materiale');
}

export async function createEdgeBand(fd: FormData) {
  await prisma.edgeBand.create({ data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
}
export async function updateEdgeBand(id: string, fd: FormData) {
  await prisma.edgeBand.update({ where: { id }, data: edgeBandSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/canturi');
}
export async function deactivateEdgeBand(id: string) {
  await prisma.edgeBand.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/canturi');
}

function hardwareData(fd: FormData) {
  const d = hardwareSchema.parse(formDataToObject(fd));
  return {
    name: d.name, category: d.category, pricePerUnit: d.pricePerUnit,
    nominalLengthMm: d.nominalLengthMm ?? null, loadClassKg: d.loadClassKg ?? null,
  };
}

export async function createHardware(fd: FormData) {
  await prisma.hardwareItem.create({ data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
}
export async function updateHardware(id: string, fd: FormData) {
  await prisma.hardwareItem.update({ where: { id }, data: hardwareData(fd) });
  revalidatePath('/cataloage/feronerie');
}
export async function deactivateHardware(id: string) {
  await prisma.hardwareItem.update({ where: { id }, data: { active: false } });
  revalidatePath('/cataloage/feronerie');
}

export async function createCuttingRate(fd: FormData) {
  await prisma.cuttingRate.create({ data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
}
export async function updateCuttingRate(id: string, fd: FormData) {
  await prisma.cuttingRate.update({ where: { id }, data: cuttingRateSchema.parse(formDataToObject(fd)) });
  revalidatePath('/cataloage/debitare');
}
export async function deleteCuttingRate(id: string) {
  await prisma.cuttingRate.delete({ where: { id } });
  revalidatePath('/cataloage/debitare');
}

export async function updateLaborRate(cabinetType: string, fd: FormData) {
  const d = laborRateSchema.parse(formDataToObject(fd));
  await prisma.laborRate.update({ where: { cabinetType }, data: { price: d.price } });
  revalidatePath('/cataloage/manopera');
}

export async function updateSettings(fd: FormData) {
  const d = settingsSchema.parse(formDataToObject(fd));
  await prisma.appSettings.update({
    where: { id: 1 },
    data: {
      markupPct: d.markupPct, sheetYieldFactor: d.sheetYieldFactor,
      defaultHingeId: d.defaultHingeId ?? null, defaultHandleId: d.defaultHandleId ?? null,
      defaultLegId: d.defaultLegId ?? null, defaultRailId: d.defaultRailId ?? null,
    },
  });
  revalidatePath('/setari');
}

export async function updateConstruction(fd: FormData) {
  const obj = formDataToObject(fd);
  const construction: Record<string, number | number[]> = {};
  for (const key of Object.keys(DEFAULT_CONSTRUCTION)) {
    if (key === 'slideNominalsMm') {
      const raw = obj[key];
      if (raw !== undefined) {
        construction[key] = raw.split(',').map((s) => {
          const n = Number(s.trim());
          if (!Number.isFinite(n) || n <= 0) throw new Error(`Valoare invalidă în lista de nominale: ${s}`);
          return n;
        });
      }
      continue;
    }
    const raw = obj[key];
    if (raw !== undefined && raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Valoare invalidă pentru ${key}: ${raw}`);
      construction[key] = n;
    }
  }
  await prisma.appSettings.update({
    where: { id: 1 },
    data: { constructionJson: JSON.stringify({ ...DEFAULT_CONSTRUCTION, ...construction }) },
  });
  revalidatePath('/setari');
}
```

- [ ] **Step 2: Verifică**

Run: `npm run build` — Expected: build reușit ('use server' compilează).
Run: `npm test` — Expected: 86/86.

- [ ] **Step 3: Commit**

```bash
git add lib/catalog/actions.ts
git commit -m "feat: server actions for catalog crud"
```

---

### Task 7: Componente de formular + pagina Materiale

**Files:**
- Create: `components/forms.tsx`, `components/DeleteButton.tsx`, `app/cataloage/materiale/page.tsx`

**Interfaces:**
- Produces: `TextInput`, `NumberInput`, `Select`, `SubmitButton` (server-safe) și `DeleteButton` (client, confirm) — refolosite de Task 8-9.

- [ ] **Step 1: Componentele comune**

`components/forms.tsx`:
```tsx
import type { ReactNode } from 'react';

const inputCls = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm';

export function TextInput(props: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <input type="text" name={props.name} defaultValue={props.defaultValue} required={props.required ?? true} className={inputCls} />
    </label>
  );
}

export function NumberInput(props: {
  name: string; label: string; defaultValue?: number | null; required?: boolean; step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <input
        type="number" name={props.name} step={props.step ?? '0.01'} min="0"
        defaultValue={props.defaultValue ?? undefined} required={props.required ?? true}
        className={inputCls}
      />
    </label>
  );
}

export function Select(props: {
  name: string; label: string; options: { value: string; label: string }[];
  defaultValue?: string | null; allowEmpty?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <select name={props.name} defaultValue={props.defaultValue ?? ''} className={inputCls}>
        {props.allowEmpty && <option value="">—</option>}
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700">
      {children}
    </button>
  );
}
```

`components/DeleteButton.tsx`:
```tsx
'use client';

export function DeleteButton({ action, label }: { action: () => Promise<void>; label?: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
        {label ?? 'Șterge'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Pagina Materiale**

`app/cataloage/materiale/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { createMaterial, deactivateMaterial, updateMaterial } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

const KIND_OPTIONS = [
  { value: 'PAL', label: 'PAL melaminat' },
  { value: 'MDF_MELAMINAT', label: 'MDF melaminat' },
  { value: 'MDF_INFOLIAT', label: 'MDF înfoliat' },
  { value: 'MDF_VOPSIT', label: 'MDF vopsit' },
  { value: 'PFL', label: 'PFL / HDF' },
];
const PRICING_OPTIONS = [
  { value: 'PER_SHEET', label: 'Preț per foaie' },
  { value: 'PER_SQM', label: 'Preț per m²' },
];

function MaterialFields({ m }: { m?: {
  name: string; kind: string; thicknessMm: number; sheetLengthMm: number;
  sheetWidthMm: number; pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
} }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-8">
      <div className="col-span-2"><TextInput name="name" label="Denumire" defaultValue={m?.name} /></div>
      <Select name="kind" label="Tip" options={KIND_OPTIONS} defaultValue={m?.kind ?? 'PAL'} />
      <NumberInput name="thicknessMm" label="Grosime (mm)" defaultValue={m?.thicknessMm ?? 18} />
      <NumberInput name="sheetLengthMm" label="Lungime foaie" defaultValue={m?.sheetLengthMm ?? 2800} />
      <NumberInput name="sheetWidthMm" label="Lățime foaie" defaultValue={m?.sheetWidthMm ?? 2070} />
      <Select name="pricingMode" label="Mod preț" options={PRICING_OPTIONS} defaultValue={m?.pricingMode ?? 'PER_SHEET'} />
      <div className="space-y-1">
        <NumberInput name="pricePerSheet" label="Lei/foaie" defaultValue={m?.pricePerSheet} required={false} />
        <NumberInput name="pricePerSqm" label="Lei/m²" defaultValue={m?.pricePerSqm} required={false} />
      </div>
    </div>
  );
}

export default async function MaterialePage() {
  const materials = await prisma.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Materiale plăci</h1>

      <ul className="space-y-4">
        {materials.map((m) => (
          <li key={m.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateMaterial.bind(null, m.id)} className="grow space-y-2">
                <MaterialFields m={m} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deactivateMaterial.bind(null, m.id)} />
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă material</h2>
        <form action={createMaterial} className="space-y-2">
          <MaterialFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verifică**

Run: `npm run build` — Expected: build reușit, ruta `/cataloage/materiale` listată.
Run: `npm test` — Expected: 86/86.

- [ ] **Step 4: Commit**

```bash
git add components/ app/cataloage/materiale/
git commit -m "feat: shared form components and materials catalog page"
```

---

### Task 8: Paginile Canturi, Debitare, Manoperă

**Files:**
- Create: `app/cataloage/canturi/page.tsx`, `app/cataloage/debitare/page.tsx`, `app/cataloage/manopera/page.tsx`

**Interfaces:**
- Consumes: componentele din Task 7, actions din Task 6.

- [ ] **Step 1: Pagina Canturi**

`app/cataloage/canturi/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { createEdgeBand, deactivateEdgeBand, updateEdgeBand } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

function EdgeBandFields({ e }: { e?: { name: string; thicknessMm: number; pricePerMl: number } }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <TextInput name="name" label="Denumire" defaultValue={e?.name} />
      <NumberInput name="thicknessMm" label="Grosime (mm)" defaultValue={e?.thicknessMm ?? 0.4} />
      <NumberInput name="pricePerMl" label="Lei/ml (aplicat)" defaultValue={e?.pricePerMl} />
    </div>
  );
}

export default async function CanturiPage() {
  const bands = await prisma.edgeBand.findMany({ where: { active: true }, orderBy: { thicknessMm: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Canturi ABS</h1>
      <ul className="space-y-4">
        {bands.map((e) => (
          <li key={e.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateEdgeBand.bind(null, e.id)} className="grow space-y-2">
                <EdgeBandFields e={e} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deactivateEdgeBand.bind(null, e.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă cant</h2>
        <form action={createEdgeBand} className="space-y-2">
          <EdgeBandFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Pagina Debitare**

`app/cataloage/debitare/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { createCuttingRate, deleteCuttingRate, updateCuttingRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

function RateFields({ r }: { r?: { maxThicknessMm: number; pricePerSheet: number } }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberInput name="maxThicknessMm" label="Până la grosimea (mm)" defaultValue={r?.maxThicknessMm} />
      <NumberInput name="pricePerSheet" label="Lei/foaie debitată" defaultValue={r?.pricePerSheet} />
    </div>
  );
}

export default async function DebitarePage() {
  const rates = await prisma.cuttingRate.findMany({ orderBy: { maxThicknessMm: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Tarife debitare (per foaie)</h1>
      <p className="text-sm text-neutral-600">
        Se aplică tariful cu cea mai mică grosime maximă care acoperă grosimea plăcii.
      </p>
      <ul className="space-y-4">
        {rates.map((r) => (
          <li key={r.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateCuttingRate.bind(null, r.id)} className="grow space-y-2">
                <RateFields r={r} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deleteCuttingRate.bind(null, r.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă tarif</h2>
        <form action={createCuttingRate} className="space-y-2">
          <RateFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Pagina Manoperă**

`app/cataloage/manopera/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { updateLaborRate } from '@/lib/catalog/actions';
import { NumberInput, SubmitButton } from '@/components/forms';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  SERTARE: 'Corp cu sertare', COLT: 'Corp de colț',
};

export default async function ManoperaPage() {
  const rates = await prisma.laborRate.findMany({ orderBy: { cabinetType: 'asc' } });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Manoperă per tip de corp</h1>
      <ul className="space-y-4">
        {rates.map((r) => (
          <li key={r.cabinetType} className="rounded border bg-white p-3">
            <form action={updateLaborRate.bind(null, r.cabinetType)} className="flex items-end gap-3">
              <div className="w-48 text-sm font-medium">{TYPE_LABELS[r.cabinetType] ?? r.cabinetType}</div>
              <div className="w-40"><NumberInput name="price" label="Lei/corp" defaultValue={r.price} /></div>
              <SubmitButton>Salvează</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Verifică și commit**

Run: `npm run build` — Expected: rutele `/cataloage/canturi`, `/cataloage/debitare`, `/cataloage/manopera` listate.
Run: `npm test` — Expected: 86/86.

```bash
git add app/cataloage/
git commit -m "feat: edge band, cutting rate and labor rate pages"
```

---

### Task 9: Paginile Feronerie și Setări

**Files:**
- Create: `app/cataloage/feronerie/page.tsx`, `app/setari/page.tsx`

**Interfaces:**
- Consumes: componentele din Task 7, actions din Task 6, `parseConstruction` din `@/lib/catalog/convert`, `DEFAULT_CONSTRUCTION` din `@/lib/engine`.

- [ ] **Step 1: Pagina Feronerie**

`app/cataloage/feronerie/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { createHardware, deactivateHardware, updateHardware } from '@/lib/catalog/actions';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { DeleteButton } from '@/components/DeleteButton';

const CATEGORY_OPTIONS = [
  { value: 'BALAMA', label: 'Balama' },
  { value: 'SERTAR', label: 'Sertar / glisiere' },
  { value: 'MANER', label: 'Mâner' },
  { value: 'PICIOR', label: 'Picior' },
  { value: 'SINA_SUSPENDARE', label: 'Șină suspendare' },
  { value: 'ACCESORIU', label: 'Accesoriu' },
];

function HardwareFields({ h }: { h?: {
  name: string; category: string; pricePerUnit: number;
  nominalLengthMm: number | null; loadClassKg: number | null;
} }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <div className="col-span-2"><TextInput name="name" label="Denumire" defaultValue={h?.name} /></div>
      <Select name="category" label="Categorie" options={CATEGORY_OPTIONS} defaultValue={h?.category ?? 'BALAMA'} />
      <NumberInput name="pricePerUnit" label="Lei/buc (set)" defaultValue={h?.pricePerUnit} />
      <NumberInput name="nominalLengthMm" label="Nominală (mm)" defaultValue={h?.nominalLengthMm} required={false} />
      <NumberInput name="loadClassKg" label="Clasă (kg)" defaultValue={h?.loadClassKg} required={false} />
    </div>
  );
}

export default async function FeroneriePage() {
  const items = await prisma.hardwareItem.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Feronerie</h1>
      <p className="text-sm text-neutral-600">
        La sertare/glisiere completează lungimea nominală — aplicația alege automat setul potrivit după adâncimea corpului.
      </p>
      <ul className="space-y-4">
        {items.map((h) => (
          <li key={h.id} className="rounded border bg-white p-3">
            <div className="flex items-end gap-3">
              <form action={updateHardware.bind(null, h.id)} className="grow space-y-2">
                <HardwareFields h={h} />
                <SubmitButton>Salvează</SubmitButton>
              </form>
              <DeleteButton action={deactivateHardware.bind(null, h.id)} />
            </div>
          </li>
        ))}
      </ul>
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Adaugă feronerie</h2>
        <form action={createHardware} className="space-y-2">
          <HardwareFields />
          <SubmitButton>Adaugă</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Pagina Setări**

`app/setari/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { updateConstruction, updateSettings } from '@/lib/catalog/actions';
import { parseConstruction } from '@/lib/catalog/convert';
import { NumberInput, Select, SubmitButton } from '@/components/forms';

const CONSTRUCTION_LABELS: Record<string, string> = {
  frontGapMm: 'Rost între fronturi (mm)',
  outerGapMm: 'Rost la marginea corpului (mm)',
  shelfSetbackMm: 'Retragere poliță (mm)',
  backRebateMm: 'Reducere spate în falț (mm)',
  boardDensityKgPerSqmPerMm: 'Densitate placă (kg/m²/mm)',
  slideClearanceMm: 'Spațiu glisieră–spate (mm)',
  palBoxSlideAllowanceMm: 'Spațiu lateral cutie sertar PAL (mm)',
  palBoxHeightDeductMm: 'Reducere înălțime cutie sertar (mm)',
  palBoxMinHeightMm: 'Înălțime minimă cutie sertar (mm)',
  metalBoxBottomDeductMm: 'Reducere fund sertar metalic (mm)',
  metalBoxBackHeightMm: 'Înălțime spate sertar metalic (mm)',
  legsPerCabinet: 'Picioare per corp',
  shelfSpanWarnMm: 'Avertizare poliță peste (mm)',
  doorMaxWidthMm: 'Avertizare ușă peste (mm)',
  blindPanelDefaultWidthMm: 'Lățime implicită panou orb (mm)',
};

export default async function SetariPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    return <p>Setările lipsesc — rulează <code>npm run db:seed</code>.</p>;
  }
  const construction = parseConstruction(settings.constructionJson);
  const hardware = await prisma.hardwareItem.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const byCategory = (cat: string) =>
    hardware.filter((h) => h.category === cat).map((h) => ({ value: h.id, label: h.name }));

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Setări</h1>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Ofertare și feronerie implicită</h2>
        <form action={updateSettings} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberInput name="markupPct" label="Adaos implicit (%)" defaultValue={settings.markupPct} />
            <NumberInput name="sheetYieldFactor" label="Factor utilizare foaie (0–1)" defaultValue={settings.sheetYieldFactor} step="0.01" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Select name="defaultHingeId" label="Balama implicită" options={byCategory('BALAMA')} defaultValue={settings.defaultHingeId} allowEmpty />
            <Select name="defaultHandleId" label="Mâner implicit" options={byCategory('MANER')} defaultValue={settings.defaultHandleId} allowEmpty />
            <Select name="defaultLegId" label="Picior implicit" options={byCategory('PICIOR')} defaultValue={settings.defaultLegId} allowEmpty />
            <Select name="defaultRailId" label="Șină implicită" options={byCategory('SINA_SUSPENDARE')} defaultValue={settings.defaultRailId} allowEmpty />
          </div>
          <SubmitButton>Salvează setările</SubmitButton>
        </form>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Constante de construcție</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Regulile după care se generează piesele. Modifică doar dacă atelierul lucrează altfel.
        </p>
        <form action={updateConstruction} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(CONSTRUCTION_LABELS).map(([key, label]) => (
              <NumberInput
                key={key} name={key} label={label}
                defaultValue={construction[key as keyof typeof construction] as number}
                step="0.001"
              />
            ))}
            <label className="col-span-2 block text-sm">
              <span className="text-neutral-600">Lungimi nominale glisiere (mm, separate prin virgulă)</span>
              <input
                type="text" name="slideNominalsMm"
                defaultValue={construction.slideNominalsMm.join(', ')}
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
          <SubmitButton>Salvează constantele</SubmitButton>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verificare finală (build + smoke pe server pornit)**

Run: `npm run build && npm test` — Expected: build ok, 86/86.

Smoke test cu serverul pornit (production build):
```bash
(npm run start &) && sleep 3
curl -s http://localhost:3000/cataloage/materiale | grep -o "Materiale plăci" | head -1
curl -s http://localhost:3000/cataloage/feronerie | grep -o "Feronerie" | head -1
curl -s http://localhost:3000/setari | grep -o "Constante de construcție" | head -1
kill %1 2>/dev/null; pkill -f "next start" 2>/dev/null || true
```
Expected: fiecare grep afișează textul căutat (paginile se randează cu date din seed).

- [ ] **Step 4: Commit**

```bash
git add app/cataloage/feronerie/ app/setari/
git commit -m "feat: hardware catalog and settings pages"
```

---

## După acest plan

Planul 3 (scris după executarea acestuia): modelele `Project`/`Cabinet` cu snapshot de prețuri, editorul de corpuri (formular șablon → piese generate live cu `expandCabinet` → feronerie editabilă), ecranul rezumat cu cele 6 categorii de cost + adaos + lei/ml, și cele 4 exporturi (ofertă PDF, necesar materiale, CSV debitare per material, listă feronerie). Criteriul de acceptanță din spec (bucătărie reală → aceleași cifre) se validează la finalul Planului 3.

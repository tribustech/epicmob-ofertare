# Proiecte + Exporturi (Plan 3/3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fluxul complet de ofertare: proiecte cu corpuri parametrice (snapshot de prețuri), editor de corp cu piese generate live, feronerie sugerată + editabilă, rezumat de cost în 6 categorii cu adaos și lei/ml, și cele 4 exporturi (ofertă printabilă → PDF, necesar materiale, CSV debitare per material, listă feronerie).

**Architecture:** Corpurile se stochează ca JSON de `CabinetInput` (formatul nativ al motorului); feroneria per corp e `null` (= sugestii automate) sau o listă de linii editate de utilizator; piese suplimentare per corp ca listă JSON. La „Recalculează", TOATE rândurile din cataloage (inclusiv cele dezactivate) se copiază în `Project.snapshotJson` — rezumatul și exporturile se calculează exclusiv din snapshot, deci ofertele vechi nu se schimbă și nu aruncă erori la referințe dezactivate; sugestiile implicite se construiesc doar din feroneria activă. **Oferta PDF** = pagină optimizată pentru print (utilizatorul face Cmd+P → Save as PDF) — zero dependențe noi. Primul task e pasul de error-handling cerut de review-ul Planului 2 (erorile de validare apar în formular, nu ca ecran generic).

**Tech Stack:** existent (Next.js 15, Prisma 6 + SQLite, zod, Tailwind v4, Vitest). Nicio dependență nouă.

## Global Constraints

- Motorul `lib/engine/**` NU se modifică. Logica de calcul a ofertei (`lib/quote/compute.ts`) e pură (fără Prisma/Next) — testabilă izolat.
- Snapshot-ul e sursa de adevăr pentru rezumat și exporturi; fără snapshot, pagina de proiect arată un îndemn la „Calculează", iar exporturile răspund 400.
- `CostCatalogs` din snapshot = toate rândurile (inclusiv `active: false`); `buildHardwareDefaults` = doar rânduri active. (Cerință din review-ul final al Planului 2.)
- Toate formularele noi și existente folosesc `ActionForm`/`DeleteButton` cu `useActionState`: acțiunile întorc `{ error?: string }` prin wrapper-ul `formAction`; erorile zod/domeniu apar inline, `redirect` se propagă nealterat.
- Texte UI românești; rute: `/proiecte`, `/proiecte/[id]`, `/proiecte/[id]/corp/[cabinetId]`, `/proiecte/[id]/oferta`, `/proiecte/[id]/export/debitare/[materialId]`, `/proiecte/[id]/export/feronerie`.
- Paginile noi sunt `force-dynamic` (ca restul admin-ului). CSV-urile se servesc cu BOM (`﻿`) pentru diacritice în Excel.
- `npm test` și `npm run build` trec după fiecare task; commit per task (conventional commits).

## File Structure

```
├── lib/
│   ├── forms/form-action.ts              # FormState + formAction wrapper (Task 1)
│   ├── format.ts                         # fmtLei / fmtNum (Task 6)
│   └── quote/
│       ├── cabinet-form.ts               # cabinetFormSchema, toCabinetInput, extraPartSchema (Task 3)
│       ├── compute.ts                    # SnapshotData, QuoteInput, computeQuote (pur) (Task 4)
│       ├── snapshot.ts                   # buildSnapshot (Prisma → SnapshotData) (Task 4)
│       ├── load.ts                       # loadProject, toQuoteInput, tryComputeQuote (Task 5)
│       ├── actions.ts                    # server actions proiecte/corpuri (Task 5)
│       └── __tests__/                    # fixtures + teste (Task 3, 4)
├── components/
│   ├── ActionForm.tsx                    # client, useActionState + eroare inline (Task 1)
│   ├── DeleteButton.tsx                  # actualizat la FormState (Task 1)
│   └── PrintButton.tsx                   # client, window.print() (Task 10)
├── app/
│   ├── layout.tsx                        # header print:hidden (Task 10), link Proiecte (Task 6)
│   └── proiecte/
│       ├── page.tsx                      # listă + creare (Task 6)
│       └── [id]/
│           ├── page.tsx                  # detaliu + rezumat + exporturi (Task 9)
│           ├── corp/[cabinetId]/page.tsx # editor corp (Task 7 + 8)
│           ├── oferta/page.tsx           # ofertă printabilă (Task 10)
│           └── export/
│               ├── debitare/[materialId]/route.ts   (Task 10)
│               └── feronerie/route.ts               (Task 10)
└── prisma/schema.prisma                  # + Project, Cabinet (Task 2)
```

---

### Task 1: Error handling pe formulare (infrastructură + retrofit cataloage)

**Files:**
- Create: `lib/forms/form-action.ts`, `components/ActionForm.tsx`
- Modify: `components/DeleteButton.tsx`, `components/forms.tsx` (prop `min`), `lib/catalog/actions.ts` (toate acțiunile împachetate), `lib/catalog/schemas.ts` (path pe refine), toate cele 6 pagini de catalog (`form` → `ActionForm`)
- Test: `lib/forms/__tests__/form-action.test.ts`

**Interfaces:**
- Produces: `FormState { error?: string }` și `formAction<A>(fn: (...args A) => Promise<void>) => (...args A) => Promise<FormState>` — TOATE acțiunile din aplicație (catalog + quote) trec prin el; `ActionForm({ action: (fd) => Promise<FormState>, children, className })`; `DeleteButton({ action: () => Promise<FormState>, label? })`.

- [ ] **Step 1: Scrie testul care pică**

`lib/forms/__tests__/form-action.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { formAction } from '../form-action';

describe('formAction', () => {
  it('succes → obiect gol', async () => {
    const fn = formAction(async (_x: number) => {});
    expect(await fn(1)).toEqual({});
  });

  it('Error → { error: mesaj }', async () => {
    const fn = formAction(async () => { throw new Error('Ceva n-a mers'); });
    expect(await fn()).toEqual({ error: 'Ceva n-a mers' });
  });

  it('ZodError → mesaje unite', async () => {
    const fn = formAction(async () => {
      z.object({ name: z.string().min(1, 'Numele lipsește') }).parse({ name: '' });
    });
    const r = await fn();
    expect(r.error).toContain('Numele lipsește');
  });

  it('NEXT_REDIRECT se propagă (nu e prins)', async () => {
    const redirectErr = Object.assign(new Error('redirect'), { digest: 'NEXT_REDIRECT;push;/x;307;' });
    const fn = formAction(async () => { throw redirectErr; });
    await expect(fn()).rejects.toBe(redirectErr);
  });
});
```

- [ ] **Step 2: Rulează — trebuie să pice**

Run: `npx vitest run lib/forms/__tests__/form-action.test.ts`
Expected: FAIL — `Cannot find module '../form-action'`.

- [ ] **Step 3: Implementează infrastructura**

`lib/forms/form-action.ts`:
```ts
import { ZodError } from 'zod';

export interface FormState {
  error?: string;
}

function isNextRedirect(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'digest' in e &&
    String((e as { digest: unknown }).digest).startsWith('NEXT_REDIRECT')
  );
}

export function formAction<A extends unknown[]>(
  fn: (...args: A) => Promise<void>,
): (...args: A) => Promise<FormState> {
  return async (...args: A) => {
    try {
      await fn(...args);
      return {};
    } catch (e) {
      if (isNextRedirect(e)) throw e;
      if (e instanceof ZodError) {
        return { error: 'Date invalide: ' + e.issues.map((i) => i.message).join('; ') };
      }
      return { error: e instanceof Error ? e.message : 'Eroare necunoscută' };
    }
  };
}
```

`components/ActionForm.tsx`:
```tsx
'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import type { FormState } from '@/lib/forms/form-action';

export function ActionForm(props: {
  action: (fd: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, dispatch] = useActionState(
    async (_prev: FormState, fd: FormData) => props.action(fd),
    {} as FormState,
  );
  return (
    <form action={dispatch} className={props.className}>
      {state.error && (
        <p className="mb-2 rounded bg-red-50 px-2 py-1 text-sm text-red-700">{state.error}</p>
      )}
      {props.children}
    </form>
  );
}
```

`components/DeleteButton.tsx` (înlocuiește complet):
```tsx
'use client';

import { useActionState } from 'react';
import type { FormState } from '@/lib/forms/form-action';

export function DeleteButton({ action, label }: { action: () => Promise<FormState>; label?: string }) {
  const [state, dispatch] = useActionState(async () => action(), {} as FormState);
  return (
    <form
      action={dispatch}
      onSubmit={(e) => {
        if (!confirm('Sigur ștergi această intrare?')) e.preventDefault();
      }}
    >
      {state.error && <p className="mb-1 max-w-56 text-xs text-red-700">{state.error}</p>}
      <button type="submit" className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
        {label ?? 'Șterge'}
      </button>
    </form>
  );
}
```

În `components/forms.tsx`, `NumberInput` primește prop opțional `min` (implicit rămâne `"0"`):
```tsx
export function NumberInput(props: {
  name: string; label: string; defaultValue?: number | null; required?: boolean; step?: string; min?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-neutral-600">{props.label}</span>
      <input
        type="number" name={props.name} step={props.step ?? '0.01'} min={props.min ?? '0'}
        defaultValue={props.defaultValue ?? undefined} required={props.required ?? true}
        className={inputCls}
      />
    </label>
  );
}
```

În `lib/catalog/schemas.ts`, refine-ul din `materialSchema` primește `path`:
```ts
    { message: 'Lipsește prețul pentru modul de preț ales', path: ['pricingMode'] },
```

- [ ] **Step 4: Împachetează acțiunile de catalog**

În `lib/catalog/actions.ts`:
1. Adaugă importul: `import { formAction } from '@/lib/forms/form-action';`
2. Transformă FIECARE export din `export async function nume(args) { corp }` în `export const nume = formAction(async (args) => { corp });` — corpurile rămân neschimbate, cu două excepții în `updateConstruction`:
   - la validarea numerică generală, respinge și negativele: `if (!Number.isFinite(n) || n < 0) throw new Error(\`Valoare invalidă pentru ${key}: ${raw}\`);`
   - pentru `slideNominalsMm`, dacă `raw` e string gol: `throw new Error('Lista de lungimi nominale nu poate fi goală');`

- [ ] **Step 5: Retrofit paginile de catalog**

În toate cele 6 pagini (`app/cataloage/{materiale,canturi,feronerie,debitare,manopera}/page.tsx`, `app/setari/page.tsx`):
1. Adaugă importul `import { ActionForm } from '@/components/ActionForm';`
2. Înlocuiește fiecare `<form action={...}` cu `<ActionForm action={...}` și `</form>` corespunzător cu `</ActionForm>` (atributele `className` rămân — `ActionForm` le acceptă). `DeleteButton` rămâne cum e (și-a schimbat doar tipul intern).

- [ ] **Step 6: Verifică**

Run: `npx vitest run lib/forms/__tests__/form-action.test.ts` — Expected: PASS (4 teste).
Run: `npm test` — Expected: 90/90.
Run: `npm run build` — Expected: build ok (toate paginile compilează cu ActionForm).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: inline form error handling via formAction wrapper and ActionForm"
```

---

### Task 2: Modelele Project și Cabinet (migrație Prisma)

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: modelele `Project` și `Cabinet` folosite de Task 5-10.

- [ ] **Step 1: Adaugă modelele la finalul `prisma/schema.prisma`**

```prisma
model Project {
  id            String    @id @default(cuid())
  name          String
  clientName    String?
  clientContact String?
  status        String    @default("CIORNA") // CIORNA | TRIMISA | ACCEPTATA
  markupPct     Float
  yieldFactor   Float
  freeLinesJson String    @default("[]")
  snapshotJson  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  cabinets      Cabinet[]
}

model Cabinet {
  id             String   @id @default(cuid())
  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  sortOrder      Int      @default(0)
  inputJson      String
  hardwareJson   String?
  extraPartsJson String   @default("[]")
  updatedAt      DateTime @updatedAt
}
```

- [ ] **Step 2: Migrează și verifică**

Run: `npx prisma migrate dev --name projects` — Expected: migrație nouă creată, client regenerat.
Run: `npx prisma validate && npm run build && npm test` — Expected: valid, build ok, 90/90.

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: project and cabinet models"
```

---

### Task 3: cabinetFormSchema + toCabinetInput (pur, TDD)

**Files:**
- Create: `lib/quote/cabinet-form.ts`
- Test: `lib/quote/__tests__/cabinet-form.test.ts`

**Interfaces:**
- Produces (folosite de actions Task 5 și editor Task 7):
```ts
export const cabinetFormSchema: z.ZodType<...>          // câmpurile formularului de corp (stringuri FormData)
export type CabinetFormData = z.infer<typeof cabinetFormSchema>
export function toCabinetInput(d: CabinetFormData): CabinetInput
export const extraPartSchema                             // name, lengthMm, widthMm, qty, materialId
export type ExtraPart = z.infer<typeof extraPartSchema>
```
Reguli: `backEnabled` e checkbox (`'on'` → true, absent → false); SERTARE cere `drawersCount ≥ 1` și `drawersBottomMaterialId`; spate activat cere `backMaterialId`; `toCabinetInput`: la SERTARE `doors = 0` și `drawers` setat (înălțimi din `drawerFrontHeightsMm` text cu virgule, dacă există); `frontMaterialId`/`frontPerimeterId` gol → `null`; `blindPanelWidthMm` doar la COLT.

- [ ] **Step 1: Scrie testul care pică**

`lib/quote/__tests__/cabinet-form.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cabinetFormSchema, toCabinetInput } from '../cabinet-form';

const BASE = {
  label: 'B1', type: 'BAZA',
  widthMm: '600', heightMm: '720', depthMm: '560',
  shelves: '1', doors: '1',
  carcassMaterialId: 'pal-alb', frontMaterialId: 'mdf-vopsit',
  backEnabled: 'on', backMaterialId: 'pfl-alb', backMount: 'FALT',
  carcassFrontEdgeId: 'abs-04', frontPerimeterId: '',
  blindPanelWidthMm: '', drawersCount: '0', drawersSystem: 'METAL_BOX',
  drawersBottomMaterialId: '', drawerFrontHeightsMm: '',
};

describe('cabinetFormSchema', () => {
  it('parsează stringuri și checkbox-ul de spate', () => {
    const d = cabinetFormSchema.parse(BASE);
    expect(d.widthMm).toBe(600);
    expect(d.backEnabled).toBe(true);
  });

  it('checkbox absent → backEnabled false (cu spate dezactivat nu cere material)', () => {
    const { backEnabled: _omit, backMaterialId: _omit2, ...rest } = BASE;
    const d = cabinetFormSchema.parse({ ...rest, backMaterialId: '' });
    expect(d.backEnabled).toBe(false);
  });

  it('SERTARE fără sertare → invalid', () => {
    expect(() => cabinetFormSchema.parse({ ...BASE, type: 'SERTARE', drawersCount: '0' })).toThrow(/sertar/i);
  });

  it('SERTARE fără material de fund → invalid', () => {
    expect(() =>
      cabinetFormSchema.parse({ ...BASE, type: 'SERTARE', drawersCount: '3', drawersBottomMaterialId: '' }),
    ).toThrow(/fund/i);
  });
});

describe('toCabinetInput', () => {
  it('BAZA: fără drawers, frontPerimeterId gol → null', () => {
    const input = toCabinetInput(cabinetFormSchema.parse(BASE));
    expect(input.drawers).toBeUndefined();
    expect(input.edgeBands.frontPerimeterId).toBeNull();
    expect(input.back).toEqual({ enabled: true, materialId: 'pfl-alb', mount: 'FALT' });
  });

  it('SERTARE: doors 0, înălțimi din text cu virgule', () => {
    const input = toCabinetInput(cabinetFormSchema.parse({
      ...BASE, type: 'SERTARE', doors: '2',
      drawersCount: '3', drawersBottomMaterialId: 'pfl-alb', drawerFrontHeightsMm: '140, 283,283',
    }));
    expect(input.doors).toBe(0);
    expect(input.drawers).toMatchObject({ count: 3, system: 'METAL_BOX', bottomMaterialId: 'pfl-alb' });
    expect(input.drawers!.frontHeightsMm).toEqual([140, 283, 283]);
  });

  it('blindPanelWidthMm se păstrează doar la COLT', () => {
    const baza = toCabinetInput(cabinetFormSchema.parse({ ...BASE, blindPanelWidthMm: '120' }));
    expect(baza.blindPanelWidthMm).toBeUndefined();
    const colt = toCabinetInput(cabinetFormSchema.parse({ ...BASE, type: 'COLT', blindPanelWidthMm: '120' }));
    expect(colt.blindPanelWidthMm).toBe(120);
  });
});
```

- [ ] **Step 2: Rulează — trebuie să pice**

Run: `npx vitest run lib/quote/__tests__/cabinet-form.test.ts`
Expected: FAIL — `Cannot find module '../cabinet-form'`.

- [ ] **Step 3: Implementează**

`lib/quote/cabinet-form.ts`:
```ts
import { z } from 'zod';
import type { CabinetInput } from '@/lib/engine';

const posNum = z.coerce.number().finite().positive();
const intNonNeg = z.coerce.number().int().min(0);
const emptyToUndefined = (v: unknown) => (v === '' || v == null ? undefined : v);
const optStr = z.preprocess(emptyToUndefined, z.string().optional());
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const cabinetFormSchema = z
  .object({
    label: z.string().trim().min(1),
    type: z.enum(['BAZA', 'SUSPENDAT', 'INALT', 'SERTARE', 'COLT']),
    widthMm: posNum,
    heightMm: posNum,
    depthMm: posNum,
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
  .refine((d) => d.type !== 'SERTARE' || d.drawersCount >= 1, {
    message: 'Corpul cu sertare are nevoie de cel puțin un sertar',
  })
  .refine((d) => d.type !== 'SERTARE' || !!d.drawersBottomMaterialId, {
    message: 'Alege materialul pentru fundul sertarelor',
  })
  .refine((d) => !d.backEnabled || !!d.backMaterialId, {
    message: 'Alege materialul pentru spate',
  });

export type CabinetFormData = z.infer<typeof cabinetFormSchema>;

export function toCabinetInput(d: CabinetFormData): CabinetInput {
  const heights = d.drawerFrontHeightsMm
    ?.split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    label: d.label,
    type: d.type,
    widthMm: d.widthMm,
    heightMm: d.heightMm,
    depthMm: d.depthMm,
    shelves: d.shelves,
    doors: d.type === 'SERTARE' ? 0 : d.doors,
    drawers:
      d.type === 'SERTARE'
        ? {
            count: d.drawersCount,
            system: d.drawersSystem,
            bottomMaterialId: d.drawersBottomMaterialId!,
            frontHeightsMm: heights && heights.length > 0 ? heights : undefined,
          }
        : undefined,
    carcassMaterialId: d.carcassMaterialId,
    frontMaterialId: d.frontMaterialId ?? null,
    back: { enabled: d.backEnabled, materialId: d.backMaterialId, mount: d.backMount },
    edgeBands: {
      carcassFrontEdgeId: d.carcassFrontEdgeId,
      frontPerimeterId: d.frontPerimeterId ?? null,
    },
    blindPanelWidthMm: d.type === 'COLT' ? d.blindPanelWidthMm : undefined,
  };
}

export const extraPartSchema = z.object({
  name: z.string().trim().min(1),
  lengthMm: posNum,
  widthMm: posNum,
  qty: z.coerce.number().int().min(1),
  materialId: z.string().min(1),
});

export type ExtraPart = z.infer<typeof extraPartSchema>;
```

- [ ] **Step 4: Rulează — trebuie să treacă**

Run: `npx vitest run lib/quote/__tests__/cabinet-form.test.ts` — Expected: PASS (7 teste).
Run: `npm test` — Expected: 97/97.

- [ ] **Step 5: Commit**

```bash
git add lib/quote/
git commit -m "feat: cabinet form schema and CabinetInput mapping"
```

---

### Task 4: computeQuote + buildSnapshot (TDD pe partea pură)

**Files:**
- Create: `lib/quote/compute.ts`, `lib/quote/snapshot.ts`, `lib/quote/__tests__/fixtures.ts`
- Test: `lib/quote/__tests__/compute.test.ts`

**Interfaces:**
- Produces:
```ts
// compute.ts (PUR — fără Prisma/Next)
export interface SnapshotData {
  takenAt: string;
  materials: (MaterialRow & { active: boolean })[];
  edgeBands: (EdgeBandRow & { active: boolean })[];
  hardware: (HardwareRow & { active: boolean })[];
  cuttingRates: CuttingRateRow[];
  laborRates: LaborRateRow[];
  settings: SettingsRow;
}
export interface QuoteCabinet { input: CabinetInput; hardwareOverrides: HardwareLine[] | null; extraParts: ExtraPart[] }
export interface QuoteInput { markupPct: number; yieldFactor: number; freeLines: FreeLine[]; cabinets: QuoteCabinet[] }
export interface QuoteResult {
  costs: CostResult; parts: Part[]; hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[]; hardwareSummary: HardwareSummaryRow[];
  cutList: CutListFile[]; warnings: Warning[]; cabinets: ExpandedCabinet[];
}
export function computeQuote(q: QuoteInput, snap: SnapshotData): QuoteResult
// snapshot.ts (server)
export async function buildSnapshot(): Promise<SnapshotData>
```
Reguli: catalogul de cost din TOATE rândurile; defaults din feroneria activă; `hardwareOverrides` non-null înlocuiește complet liniile auto ale corpului respectiv (sugestiile lui nu mai produc `unresolved`); `extraParts` devin `Part` cu `edges: {}` și `cabinetLabel` al corpului.

- [ ] **Step 1: Scrie fixtures + testul care pică**

`lib/quote/__tests__/fixtures.ts`:
```ts
import type { CabinetInput } from '@/lib/engine';
import type { SnapshotData } from '../compute';

export function makeSnapshot(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    takenAt: '2026-07-11T00:00:00.000Z',
    materials: [
      { id: 'pal-alb', name: 'PAL alb', kind: 'PAL', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 260, pricePerSqm: null, active: true },
      { id: 'pfl-alb', name: 'PFL alb', kind: 'PFL', thicknessMm: 3, sheetLengthMm: 2850, sheetWidthMm: 2070, pricingMode: 'PER_SHEET', pricePerSheet: 100, pricePerSqm: null, active: true },
      { id: 'mdf-vopsit', name: 'MDF vopsit', kind: 'MDF_VOPSIT', thicknessMm: 18, sheetLengthMm: 2800, sheetWidthMm: 2070, pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 450, active: true },
    ],
    edgeBands: [
      { id: 'abs-04', name: 'ABS 0.4mm', thicknessMm: 0.4, pricePerMl: 1, active: true },
      { id: 'abs-1', name: 'ABS 1mm', thicknessMm: 1, pricePerMl: 2, active: true },
    ],
    hardware: [
      { id: 'blum-cliptop', name: 'Balama Blum', category: 'BALAMA', pricePerUnit: 15, nominalLengthMm: null, loadClassKg: null, active: true },
      { id: 'maner-std', name: 'Mâner standard', category: 'MANER', pricePerUnit: 10, nominalLengthMm: null, loadClassKg: null, active: true },
      { id: 'picior-std', name: 'Picior reglabil', category: 'PICIOR', pricePerUnit: 2, nominalLengthMm: null, loadClassKg: null, active: true },
    ],
    // deliberat nesortate — computeCosts le sortează
    cuttingRates: [
      { maxThicknessMm: 32, pricePerSheet: 50 },
      { maxThicknessMm: 10, pricePerSheet: 33 },
    ],
    laborRates: [
      { cabinetType: 'BAZA', price: 150 }, { cabinetType: 'SUSPENDAT', price: 130 },
      { cabinetType: 'INALT', price: 200 }, { cabinetType: 'SERTARE', price: 220 },
      { cabinetType: 'COLT', price: 180 },
    ],
    settings: {
      markupPct: 30, sheetYieldFactor: 0.8, constructionJson: '{}',
      defaultHingeId: 'blum-cliptop', defaultHandleId: 'maner-std',
      defaultLegId: 'picior-std', defaultRailId: null,
    },
    ...overrides,
  };
}

export function refCabinet(): CabinetInput {
  return {
    label: 'B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: 'pal-alb', frontMaterialId: 'mdf-vopsit',
    back: { enabled: true, materialId: 'pfl-alb', mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: 'abs-04', frontPerimeterId: null },
  };
}
```

`lib/quote/__tests__/compute.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeQuote, type QuoteInput } from '../compute';
import { makeSnapshot, refCabinet } from './fixtures';

function baseQuote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    markupPct: 30, yieldFactor: 0.8, freeLines: [],
    cabinets: [{ input: refCabinet(), hardwareOverrides: null, extraParts: [] }],
    ...overrides,
  };
}

describe('computeQuote — corpul de referință (aceleași cifre ca motorul)', () => {
  const r = computeQuote(baseQuote(), makeSnapshot());

  it('totaluri identice cu calculul de mână', () => {
    expect(r.costs.totalCost).toBeCloseTo(836.16, 1);
    expect(r.costs.sellPrice).toBeCloseTo(1087.01, 1);
    expect(r.costs.leiPerMl).toBeCloseTo(1811.69, 0);
  });

  it('feronerie auto: 2 balamale, 1 mâner, 4 picioare; cutList per material', () => {
    expect(r.hardwareLines).toContainEqual({ hardwareId: 'blum-cliptop', qty: 2 });
    expect(r.unresolvedHardware).toEqual([]);
    expect(r.cutList.map((f) => f.materialId).sort()).toEqual(['mdf-vopsit', 'pal-alb', 'pfl-alb']);
  });
});

describe('computeQuote — override-uri și piese suplimentare', () => {
  it('override-ul înlocuiește complet feroneria corpului', () => {
    const q = baseQuote();
    q.cabinets[0].hardwareOverrides = [{ hardwareId: 'maner-std', qty: 10 }];
    const r = computeQuote(q, makeSnapshot());
    expect(r.costs.breakdown.hardware).toBeCloseTo(100, 5);   // 10 × 10, nu 48
    expect(r.costs.totalCost).toBeCloseTo(888.16, 1);          // 836.16 − 48 + 100
    expect(r.unresolvedHardware).toEqual([]);                  // sugestiile corpului nu mai contează
  });

  it('piesa suplimentară intră în listă fără să schimbe foile (arie mică)', () => {
    const q = baseQuote();
    q.cabinets[0].extraParts = [{ name: 'Mască soclu', lengthMm: 500, widthMm: 500, qty: 1, materialId: 'pal-alb' }];
    const r = computeQuote(q, makeSnapshot());
    expect(r.parts).toHaveLength(6);
    expect(r.costs.totalCost).toBeCloseTo(836.16, 1);          // tot 1 foaie PAL
  });

  it('feronerie dezactivată dar referențiată de override → tot se calculează (nu aruncă)', () => {
    const snap = makeSnapshot();
    snap.hardware.find((h) => h.id === 'maner-std')!.active = false;
    const q = baseQuote();
    q.cabinets[0].hardwareOverrides = [{ hardwareId: 'maner-std', qty: 2 }];
    const r = computeQuote(q, snap);
    expect(r.costs.breakdown.hardware).toBeCloseTo(20, 5);
  });
});
```

- [ ] **Step 2: Rulează — trebuie să pice**

Run: `npx vitest run lib/quote/__tests__/compute.test.ts`
Expected: FAIL — `Cannot find module '../compute'`.

- [ ] **Step 3: Implementează**

`lib/quote/compute.ts`:
```ts
import {
  buildHardwareDefaults, parseConstruction, toCostCatalogs,
  type CuttingRateRow, type EdgeBandRow, type HardwareRow,
  type LaborRateRow, type MaterialRow, type SettingsRow,
} from '@/lib/catalog/convert';
import {
  aggregateHardware, computeCosts, cutListCsv, expandCabinet, resolveSuggestions,
} from '@/lib/engine';
import type {
  CabinetInput, CostResult, CutListFile, ExpandedCabinet, FreeLine,
  HardwareLine, HardwareSuggestion, HardwareSummaryRow, Part, Warning,
} from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';

export interface SnapshotData {
  takenAt: string;
  materials: (MaterialRow & { active: boolean })[];
  edgeBands: (EdgeBandRow & { active: boolean })[];
  hardware: (HardwareRow & { active: boolean })[];
  cuttingRates: CuttingRateRow[];
  laborRates: LaborRateRow[];
  settings: SettingsRow;
}

export interface QuoteCabinet {
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
}

export interface QuoteInput {
  markupPct: number;
  yieldFactor: number;
  freeLines: FreeLine[];
  cabinets: QuoteCabinet[];
}

export interface QuoteResult {
  costs: CostResult;
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  hardwareSummary: HardwareSummaryRow[];
  cutList: CutListFile[];
  warnings: Warning[];
  cabinets: ExpandedCabinet[];
}

export function computeQuote(q: QuoteInput, snap: SnapshotData): QuoteResult {
  // catalogul de cost include TOATE rândurile — snapshot-urile vechi nu aruncă la referințe dezactivate
  const catalogs = toCostCatalogs(snap.materials, snap.edgeBands, snap.hardware, snap.cuttingRates, snap.laborRates);
  // sugestiile implicite folosesc doar feroneria activă
  const defaults = buildHardwareDefaults(snap.hardware.filter((h) => h.active), snap.settings);
  const cc = parseConstruction(snap.settings.constructionJson);

  const expanded = q.cabinets.map((c) => expandCabinet(c.input, catalogs, cc));

  const parts: Part[] = expanded.flatMap((e) => e.parts);
  for (const c of q.cabinets) {
    for (const p of c.extraParts) {
      parts.push({
        cabinetLabel: c.input.label, name: p.name,
        lengthMm: p.lengthMm, widthMm: p.widthMm, qty: p.qty,
        materialId: p.materialId, edges: {},
      });
    }
  }

  const byId = new Map<string, number>();
  const unresolvedHardware: HardwareSuggestion[] = [];
  expanded.forEach((e, i) => {
    let lines: HardwareLine[];
    const overrides = q.cabinets[i].hardwareOverrides;
    if (overrides) {
      lines = overrides;
    } else {
      const r = resolveSuggestions(e.hardware, defaults);
      unresolvedHardware.push(...r.unresolved);
      lines = r.lines;
    }
    for (const line of lines) byId.set(line.hardwareId, (byId.get(line.hardwareId) ?? 0) + line.qty);
  });
  const hardwareLines: HardwareLine[] = [...byId.entries()].map(([hardwareId, qty]) => ({ hardwareId, qty }));

  const costs = computeCosts({
    parts,
    hardwareLines,
    cabinets: q.cabinets.map((c) => c.input),
    freeLines: q.freeLines,
    markupPct: q.markupPct,
    yieldFactor: q.yieldFactor,
    catalogs,
  });

  return {
    costs,
    parts,
    hardwareLines,
    unresolvedHardware,
    hardwareSummary: aggregateHardware(hardwareLines, catalogs.hardware),
    cutList: cutListCsv(parts, catalogs),
    warnings: expanded.flatMap((e) => e.warnings),
    cabinets: expanded,
  };
}
```

`lib/quote/snapshot.ts`:
```ts
import { prisma } from '@/lib/db';
import type { SnapshotData } from './compute';

export async function buildSnapshot(): Promise<SnapshotData> {
  const [materials, edgeBands, hardware, cuttingRates, laborRates, settings] = await Promise.all([
    prisma.material.findMany(),
    prisma.edgeBand.findMany(),
    prisma.hardwareItem.findMany(),
    prisma.cuttingRate.findMany(),
    prisma.laborRate.findMany(),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!settings) throw new Error('Setările lipsesc — rulează npm run db:seed');
  return {
    takenAt: new Date().toISOString(),
    materials, edgeBands, hardware, cuttingRates, laborRates,
    settings,
  };
}
```

- [ ] **Step 4: Rulează — trebuie să treacă**

Run: `npx vitest run lib/quote/__tests__/compute.test.ts` — Expected: PASS (5 teste).
Run: `npm test && npm run build` — Expected: 102/102, build ok.

- [ ] **Step 5: Commit**

```bash
git add lib/quote/
git commit -m "feat: quote computation from snapshot with overrides and extra parts"
```

---

### Task 5: Încărcare proiect + server actions

**Files:**
- Create: `lib/quote/load.ts`, `lib/quote/actions.ts`

**Interfaces:**
- Produces (folosite de paginile din Task 6-10):
```ts
// load.ts
export interface LoadedCabinet { id: string; sortOrder: number; input: CabinetInput; hardwareOverrides: HardwareLine[] | null; extraParts: ExtraPart[] }
export async function loadProject(id: string): Promise<{ project: Project; cabinets: LoadedCabinet[]; snapshot: SnapshotData | null } | null>
export function toQuoteInput(project: { markupPct: number; yieldFactor: number; freeLinesJson: string }, cabinets: LoadedCabinet[]): QuoteInput
export function tryComputeQuote(input: QuoteInput, snapshot: SnapshotData): { quote: QuoteResult | null; error: string | null }
// actions.ts — toate prin formAction, întorc FormState
createProject(fd) [redirect], updateProjectSettings(id, fd), deleteProject(id) [redirect],
duplicateProject(id) [redirect], addFreeLine(id, fd), removeFreeLine(id, index),
addCabinet(projectId) [redirect la editor], updateCabinet(cabinetId, fd), deleteCabinet(cabinetId),
duplicateCabinet(cabinetId), saveCabinetHardware(cabinetId, fd), resetCabinetHardware(cabinetId),
addExtraPart(cabinetId, fd), removeExtraPart(cabinetId, index), recalculateProject(projectId)
```

- [ ] **Step 1: Implementează load.ts**

`lib/quote/load.ts`:
```ts
import { prisma } from '@/lib/db';
import type { Project } from '@prisma/client';
import type { CabinetInput, HardwareLine } from '@/lib/engine';
import type { ExtraPart } from './cabinet-form';
import { computeQuote, type QuoteInput, type QuoteResult, type SnapshotData } from './compute';

export interface LoadedCabinet {
  id: string;
  sortOrder: number;
  input: CabinetInput;
  hardwareOverrides: HardwareLine[] | null;
  extraParts: ExtraPart[];
}

export async function loadProject(id: string): Promise<{
  project: Project;
  cabinets: LoadedCabinet[];
  snapshot: SnapshotData | null;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { cabinets: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!project) return null;
  const cabinets: LoadedCabinet[] = project.cabinets.map((c) => ({
    id: c.id,
    sortOrder: c.sortOrder,
    input: JSON.parse(c.inputJson) as CabinetInput,
    hardwareOverrides: c.hardwareJson ? (JSON.parse(c.hardwareJson) as HardwareLine[]) : null,
    extraParts: JSON.parse(c.extraPartsJson) as ExtraPart[],
  }));
  const snapshot = project.snapshotJson ? (JSON.parse(project.snapshotJson) as SnapshotData) : null;
  return { project, cabinets, snapshot };
}

export function toQuoteInput(
  project: { markupPct: number; yieldFactor: number; freeLinesJson: string },
  cabinets: LoadedCabinet[],
): QuoteInput {
  return {
    markupPct: project.markupPct,
    yieldFactor: project.yieldFactor,
    freeLines: JSON.parse(project.freeLinesJson),
    cabinets: cabinets.map((c) => ({
      input: c.input,
      hardwareOverrides: c.hardwareOverrides,
      extraParts: c.extraParts,
    })),
  };
}

export function tryComputeQuote(
  input: QuoteInput,
  snapshot: SnapshotData,
): { quote: QuoteResult | null; error: string | null } {
  try {
    return { quote: computeQuote(input, snapshot), error: null };
  } catch (e) {
    return { quote: null, error: e instanceof Error ? e.message : 'Eroare de calcul' };
  }
}
```

- [ ] **Step 2: Implementează actions.ts**

`lib/quote/actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { formDataToObject } from '@/lib/catalog/schemas';
import { formAction } from '@/lib/forms/form-action';
import { cabinetFormSchema, extraPartSchema, toCabinetInput } from './cabinet-form';
import { buildSnapshot } from './snapshot';

const optStr = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'Numele proiectului lipsește'),
  clientName: optStr,
  clientContact: optStr,
});

const projectSettingsSchema = z.object({
  markupPct: z.coerce.number().nonnegative(),
  yieldFactor: z.coerce.number().gt(0).lte(1),
  status: z.enum(['CIORNA', 'TRIMISA', 'ACCEPTATA']),
});

const freeLineSchema = z.object({
  name: z.string().trim().min(1, 'Denumirea liniei lipsește'),
  amount: z.coerce.number().finite(),
});

export const createProject = formAction(async (fd: FormData) => {
  const d = projectFormSchema.parse(formDataToObject(fd));
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
  if (!settings) throw new Error('Setările lipsesc — rulează npm run db:seed');
  const project = await prisma.project.create({
    data: {
      name: d.name,
      clientName: d.clientName ?? null,
      clientContact: d.clientContact ?? null,
      markupPct: settings.markupPct,
      yieldFactor: settings.sheetYieldFactor,
    },
  });
  revalidatePath('/proiecte');
  redirect(`/proiecte/${project.id}`);
});

export const updateProjectSettings = formAction(async (id: string, fd: FormData) => {
  const d = projectSettingsSchema.parse(formDataToObject(fd));
  await prisma.project.update({ where: { id }, data: d });
  revalidatePath(`/proiecte/${id}`);
});

export const deleteProject = formAction(async (id: string) => {
  await prisma.project.delete({ where: { id } });
  revalidatePath('/proiecte');
  redirect('/proiecte');
});

export const duplicateProject = formAction(async (id: string) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id }, include: { cabinets: true } });
  const copy = await prisma.project.create({
    data: {
      name: `${project.name} (copie)`,
      clientName: project.clientName,
      clientContact: project.clientContact,
      markupPct: project.markupPct,
      yieldFactor: project.yieldFactor,
      freeLinesJson: project.freeLinesJson,
      cabinets: {
        create: project.cabinets.map((c) => ({
          sortOrder: c.sortOrder,
          inputJson: c.inputJson,
          hardwareJson: c.hardwareJson,
          extraPartsJson: c.extraPartsJson,
        })),
      },
    },
  });
  revalidatePath('/proiecte');
  redirect(`/proiecte/${copy.id}`);
});

export const addFreeLine = formAction(async (projectId: string, fd: FormData) => {
  const d = freeLineSchema.parse(formDataToObject(fd));
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const lines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];
  lines.push(d);
  await prisma.project.update({ where: { id: projectId }, data: { freeLinesJson: JSON.stringify(lines) } });
  revalidatePath(`/proiecte/${projectId}`);
});

export const removeFreeLine = formAction(async (projectId: string, index: number) => {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const lines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];
  lines.splice(index, 1);
  await prisma.project.update({ where: { id: projectId }, data: { freeLinesJson: JSON.stringify(lines) } });
  revalidatePath(`/proiecte/${projectId}`);
});

export const addCabinet = formAction(async (projectId: string) => {
  const pal = await prisma.material.findFirst({ where: { active: true, kind: 'PAL' }, orderBy: { name: 'asc' } });
  const pfl = await prisma.material.findFirst({ where: { active: true, kind: 'PFL' }, orderBy: { name: 'asc' } });
  const band = await prisma.edgeBand.findFirst({ where: { active: true }, orderBy: { thicknessMm: 'asc' } });
  if (!pal || !band) throw new Error('Adaugă întâi un material PAL și un cant în cataloage');
  const count = await prisma.cabinet.count({ where: { projectId } });
  const input = {
    label: `C${count + 1}`,
    type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: pal.id,
    frontMaterialId: pal.id,
    back: pfl ? { enabled: true, materialId: pfl.id, mount: 'FALT' } : { enabled: false, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: band.id, frontPerimeterId: band.id },
  };
  const cab = await prisma.cabinet.create({
    data: { projectId, sortOrder: count, inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${projectId}`);
  redirect(`/proiecte/${projectId}/corp/${cab.id}`);
});

export const updateCabinet = formAction(async (cabinetId: string, fd: FormData) => {
  const d = cabinetFormSchema.parse(formDataToObject(fd));
  const input = toCabinetInput(d);
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { inputJson: JSON.stringify(input) },
  });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const deleteCabinet = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.delete({ where: { id: cabinetId } });
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const duplicateCabinet = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const count = await prisma.cabinet.count({ where: { projectId: cab.projectId } });
  const input = JSON.parse(cab.inputJson) as { label: string };
  input.label = `${input.label} (copie)`;
  await prisma.cabinet.create({
    data: {
      projectId: cab.projectId,
      sortOrder: count,
      inputJson: JSON.stringify(input),
      hardwareJson: cab.hardwareJson,
      extraPartsJson: cab.extraPartsJson,
    },
  });
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const saveCabinetHardware = formAction(async (cabinetId: string, fd: FormData) => {
  const ids = fd.getAll('hardwareId').map(String);
  const qtys = fd.getAll('qty').map((v) => Number(v));
  const lines = ids
    .map((hardwareId, i) => ({ hardwareId, qty: qtys[i] }))
    .filter((l) => l.hardwareId !== '' && Number.isFinite(l.qty) && l.qty > 0);
  const cab = await prisma.cabinet.update({
    where: { id: cabinetId },
    data: { hardwareJson: JSON.stringify(lines) },
  });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const resetCabinetHardware = formAction(async (cabinetId: string) => {
  const cab = await prisma.cabinet.update({ where: { id: cabinetId }, data: { hardwareJson: null } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
  revalidatePath(`/proiecte/${cab.projectId}`);
});

export const addExtraPart = formAction(async (cabinetId: string, fd: FormData) => {
  const d = extraPartSchema.parse(formDataToObject(fd));
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const parts = JSON.parse(cab.extraPartsJson) as unknown[];
  parts.push(d);
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { extraPartsJson: JSON.stringify(parts) } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
});

export const removeExtraPart = formAction(async (cabinetId: string, index: number) => {
  const cab = await prisma.cabinet.findUniqueOrThrow({ where: { id: cabinetId } });
  const parts = JSON.parse(cab.extraPartsJson) as unknown[];
  parts.splice(index, 1);
  await prisma.cabinet.update({ where: { id: cabinetId }, data: { extraPartsJson: JSON.stringify(parts) } });
  revalidatePath(`/proiecte/${cab.projectId}/corp/${cabinetId}`);
});

export const recalculateProject = formAction(async (projectId: string) => {
  const snapshot = await buildSnapshot();
  await prisma.project.update({
    where: { id: projectId },
    data: { snapshotJson: JSON.stringify(snapshot) },
  });
  revalidatePath(`/proiecte/${projectId}`);
});
```

- [ ] **Step 3: Verifică și commit**

Run: `npm run build && npm test` — Expected: build ok, 102/102.

```bash
git add lib/quote/
git commit -m "feat: project loading helpers and quote server actions"
```

---

### Task 6: Pagina listă proiecte + navigare

**Files:**
- Create: `app/proiecte/page.tsx`, `lib/format.ts`
- Modify: `app/layout.tsx` (link Proiecte primul în NAV), `app/page.tsx` (link către /proiecte)

- [ ] **Step 1: Helper de formatare**

`lib/format.ts`:
```ts
export function fmtLei(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' lei';
}

export function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('ro-RO', { maximumFractionDigits: decimals });
}
```

- [ ] **Step 2: Navigare**

În `app/layout.tsx`, adaugă la începutul array-ului `NAV`:
```ts
  { href: '/proiecte', label: 'Proiecte' },
```
În `app/page.tsx`, înlocuiește paragraful și butonul cu:
```tsx
      <p className="text-neutral-600">
        Creează un proiect de ofertare din pagina Proiecte; prețurile se administrează în cataloage.
      </p>
      <div className="flex gap-3">
        <Link href="/proiecte" className="inline-block rounded bg-neutral-900 px-4 py-2 text-white">
          Proiecte
        </Link>
        <Link href="/cataloage/materiale" className="inline-block rounded border px-4 py-2">
          Cataloage
        </Link>
      </div>
```

- [ ] **Step 3: Pagina listă**

`app/proiecte/page.tsx`:
```tsx
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { createProject, deleteProject, duplicateProject } from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { SubmitButton, TextInput } from '@/components/forms';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  CIORNA: 'Ciornă', TRIMISA: 'Trimisă', ACCEPTATA: 'Acceptată',
};

export default async function ProiectePage() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { cabinets: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Proiecte</h1>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Proiect nou</h2>
        <ActionForm action={createProject} className="grid grid-cols-1 items-end gap-2 md:grid-cols-4">
          <TextInput name="name" label="Nume proiect" />
          <TextInput name="clientName" label="Client" required={false} />
          <TextInput name="clientContact" label="Contact (telefon/email)" required={false} />
          <div><SubmitButton>Creează</SubmitButton></div>
        </ActionForm>
      </section>

      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center gap-4 rounded border bg-white p-3">
            <div className="grow">
              <Link href={`/proiecte/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
              <div className="text-sm text-neutral-600">
                {p.clientName ?? 'Fără client'} · {p._count.cabinets} corpuri · {STATUS_LABELS[p.status] ?? p.status}
              </div>
            </div>
            <ActionForm action={duplicateProject.bind(null, p.id)}>
              <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">Duplică</button>
            </ActionForm>
            <DeleteButton action={deleteProject.bind(null, p.id)} />
          </li>
        ))}
        {projects.length === 0 && <li className="text-sm text-neutral-500">Niciun proiect încă.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Verifică și commit**

Run: `npm run build && npm test` — Expected: ruta `/proiecte` dinamică (ƒ), 102/102.

```bash
git add app/ lib/format.ts
git commit -m "feat: projects list page and navigation"
```

---

### Task 7: Editorul de corp — formular + piese generate live

**Files:**
- Create: `app/proiecte/[id]/corp/[cabinetId]/page.tsx`

Pagina randează: formularul complet al corpului (toate câmpurile `cabinetFormSchema`, cu selecturi populate din cataloagele ACTIVE), avertismentele și tabelul de piese generate din inputul salvat, folosind cataloagele live (nu snapshot — e o previzualizare; cifrele finale vin din snapshot la Recalculează, pe pagina proiectului). Dacă `expandCabinet` aruncă (dimensiuni imposibile), pagina arată eroarea în loc de tabel.

- [ ] **Step 1: Implementează pagina**

`app/proiecte/[id]/corp/[cabinetId]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { parseConstruction, toCostCatalogs } from '@/lib/catalog/convert';
import { expandCabinet, type CabinetInput, type ExpandedCabinet } from '@/lib/engine';
import { updateCabinet } from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_OPTIONS = [
  { value: 'BAZA', label: 'Corp bază' },
  { value: 'SUSPENDAT', label: 'Corp suspendat' },
  { value: 'INALT', label: 'Corp înalt' },
  { value: 'SERTARE', label: 'Corp cu sertare' },
  { value: 'COLT', label: 'Corp de colț' },
];

export default async function CorpPage({ params }: { params: Promise<{ id: string; cabinetId: string }> }) {
  const { id, cabinetId } = await params;
  const cab = await prisma.cabinet.findUnique({ where: { id: cabinetId } });
  if (!cab || cab.projectId !== id) notFound();
  const input = JSON.parse(cab.inputJson) as CabinetInput;

  const [materials, edgeBands, settings] = await Promise.all([
    prisma.material.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.edgeBand.findMany({ where: { active: true }, orderBy: { thicknessMm: 'asc' } }),
    prisma.appSettings.findUnique({ where: { id: 1 } }),
  ]);
  const materialOptions = materials.map((m) => ({ value: m.id, label: m.name }));
  const bandOptions = edgeBands.map((e) => ({ value: e.id, label: e.name }));
  const materialName = (mid: string) => materials.find((m) => m.id === mid)?.name ?? mid;
  const bandName = (bid?: string) => (bid ? (edgeBands.find((e) => e.id === bid)?.name ?? bid) : '');

  let expanded: ExpandedCabinet | null = null;
  let expandError: string | null = null;
  try {
    const catalogs = toCostCatalogs(
      materials.map((m) => m),
      edgeBands.map((e) => e),
      [],
      [],
      [
        { cabinetType: 'BAZA', price: 0 }, { cabinetType: 'SUSPENDAT', price: 0 },
        { cabinetType: 'INALT', price: 0 }, { cabinetType: 'SERTARE', price: 0 },
        { cabinetType: 'COLT', price: 0 },
      ],
    );
    const cc = parseConstruction(settings?.constructionJson ?? '{}');
    expanded = expandCabinet(input, catalogs, cc);
  } catch (e) {
    expandError = e instanceof Error ? e.message : 'Eroare la generarea pieselor';
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Corp: {input.label}</h1>
        <Link href={`/proiecte/${id}`} className="text-sm text-neutral-600 hover:underline">← Înapoi la proiect</Link>
      </div>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Dimensiuni și opțiuni</h2>
        <p className="mb-3 text-sm text-neutral-600">
          Câmpurile de sertare contează doar la tipul „Corp cu sertare"; panoul orb doar la „Corp de colț". Salvează pentru a regenera piesele.
        </p>
        <ActionForm action={updateCabinet.bind(null, cabinetId)} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <TextInput name="label" label="Etichetă" defaultValue={input.label} />
            <Select name="type" label="Tip corp" options={TYPE_OPTIONS} defaultValue={input.type} />
            <NumberInput name="widthMm" label="Lățime L (mm)" defaultValue={input.widthMm} step="1" />
            <NumberInput name="heightMm" label="Înălțime H (mm)" defaultValue={input.heightMm} step="1" />
            <NumberInput name="depthMm" label="Adâncime A (mm)" defaultValue={input.depthMm} step="1" />
            <NumberInput name="shelves" label="Polițe" defaultValue={input.shelves} step="1" />
            <NumberInput name="doors" label="Uși" defaultValue={input.doors} step="1" />
            <Select name="carcassMaterialId" label="Material carcasă" options={materialOptions} defaultValue={input.carcassMaterialId} />
            <Select name="frontMaterialId" label="Material fronturi" options={materialOptions} defaultValue={input.frontMaterialId} allowEmpty />
            <Select name="carcassFrontEdgeId" label="Cant carcasă" options={bandOptions} defaultValue={input.edgeBands.carcassFrontEdgeId} />
            <Select name="frontPerimeterId" label="Cant fronturi" options={bandOptions} defaultValue={input.edgeBands.frontPerimeterId} allowEmpty />
            <NumberInput name="blindPanelWidthMm" label="Panou orb (mm, colț)" defaultValue={input.blindPanelWidthMm ?? null} required={false} step="1" />
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="backEnabled" defaultChecked={input.back.enabled} />
              <span>Cu spate</span>
            </label>
            <Select name="backMaterialId" label="Material spate" options={materialOptions} defaultValue={input.back.materialId} allowEmpty />
            <Select
              name="backMount" label="Montaj spate"
              options={[{ value: 'FALT', label: 'În falț' }, { value: 'APLICAT', label: 'Aplicat' }]}
              defaultValue={input.back.mount}
            />
            <NumberInput name="drawersCount" label="Nr. sertare" defaultValue={input.drawers?.count ?? 0} step="1" />
            <Select
              name="drawersSystem" label="Sistem sertare"
              options={[{ value: 'METAL_BOX', label: 'Blum (laterale metalice)' }, { value: 'PAL_BOX', label: 'Cutie din PAL' }]}
              defaultValue={input.drawers?.system ?? 'METAL_BOX'}
            />
            <Select name="drawersBottomMaterialId" label="Fund sertare" options={materialOptions} defaultValue={input.drawers?.bottomMaterialId} allowEmpty />
            <div className="col-span-2">
              <TextInput
                name="drawerFrontHeightsMm" label="Înălțimi fronturi sertar (mm, cu virgulă; gol = egale)"
                defaultValue={input.drawers?.frontHeightsMm?.join(', ') ?? ''} required={false}
              />
            </div>
          </div>

          <SubmitButton>Salvează corpul</SubmitButton>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Piese generate</h2>
        {expandError && <p className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">{expandError}</p>}
        {expanded && (
          <>
            {expanded.warnings.length > 0 && (
              <ul className="mb-2 space-y-1">
                {expanded.warnings.map((w, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">⚠ {w.message}</li>
                ))}
              </ul>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-600">
                  <th className="py-1">Piesă</th><th>Dimensiuni (mm)</th><th>Buc</th><th>Material</th><th>Canturi</th>
                </tr>
              </thead>
              <tbody>
                {expanded.parts.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1">{p.name}</td>
                    <td>{fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)}</td>
                    <td>{p.qty}</td>
                    <td>{materialName(p.materialId)}</td>
                    <td className="text-neutral-500">
                      {[p.edges.l1, p.edges.l2, p.edges.w1, p.edges.w2].filter(Boolean).map((b) => bandName(b)).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verifică și commit**

Run: `npm run build && npm test` — Expected: ruta editor dinamică, 102/102.

```bash
git add app/proiecte/
git commit -m "feat: cabinet editor with live generated parts preview"
```

---

### Task 8: Editorul de corp — feronerie editabilă + piese suplimentare

**Files:**
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (două secțiuni noi la final, înaintea închiderii `</div>`)

Feronerie: dacă `hardwareJson` e null, se afișează sugestiile motorului (rezolvate pe feroneria activă) ca listă read-only + buton „Preia în editor" (le salvează ca override); dacă există override, se afișează rânduri editabile (select + cantitate + ștergere pe rând prin cantitate 0) + rând nou + „Revino la sugestii".

- [ ] **Step 1: Adaugă secțiunile**

În pagina editorului, după secțiunea „Piese generate", adaugă (și completează importurile: `buildHardwareDefaults` din `@/lib/catalog/convert`, `resolveSuggestions`, tip `HardwareLine` din `@/lib/engine`, `saveCabinetHardware`, `resetCabinetHardware`, `addExtraPart`, `removeExtraPart` din `@/lib/quote/actions`, `DeleteButton` din `@/components/DeleteButton`, plus interogarea `hardwareItems` și parsarea `extraParts`/`overrides` — vezi mai jos):

Adaugă la interogările existente:
```tsx
  const hardwareItems = await prisma.hardwareItem.findMany({ where: { active: true }, orderBy: [{ category: 'asc' }, { name: 'asc' }] });
  const hardwareOptions = hardwareItems.map((h) => ({ value: h.id, label: `${h.name} (${h.pricePerUnit} lei)` }));
  const hardwareName = (hid: string) => hardwareItems.find((h) => h.id === hid)?.name ?? hid;
  const overrides = cab.hardwareJson ? (JSON.parse(cab.hardwareJson) as HardwareLine[]) : null;
  const extraParts = JSON.parse(cab.extraPartsJson) as ExtraPart[];
```
(importă și `type ExtraPart` din `@/lib/quote/cabinet-form`)

Iar după blocul `try/catch` de expandare, calculează liniile sugerate (doar dacă expandarea a reușit și settings există):
```tsx
  let suggestedLines: HardwareLine[] = [];
  if (expanded && settings) {
    const defaults = buildHardwareDefaults(hardwareItems, settings);
    suggestedLines = resolveSuggestions(expanded.hardware, defaults).lines;
  }
```

Secțiunile noi (JSX, după „Piese generate"):
```tsx
      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Feronerie</h2>
        {overrides === null ? (
          <>
            <p className="mb-2 text-sm text-neutral-600">
              Sugestii automate (se recalculează la fiecare salvare a corpului). Preia-le în editor doar dacă vrei să le modifici.
            </p>
            <ul className="mb-3 space-y-1 text-sm">
              {suggestedLines.map((l) => (
                <li key={l.hardwareId}>{l.qty} × {hardwareName(l.hardwareId)}</li>
              ))}
              {suggestedLines.length === 0 && <li className="text-neutral-500">Nicio sugestie (corp fără fronturi/sertare).</li>}
            </ul>
            <ActionForm action={saveCabinetHardware.bind(null, cabinetId)}>
              {suggestedLines.map((l) => (
                <span key={l.hardwareId}>
                  <input type="hidden" name="hardwareId" value={l.hardwareId} />
                  <input type="hidden" name="qty" value={l.qty} />
                </span>
              ))}
              <SubmitButton>Preia în editor</SubmitButton>
            </ActionForm>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-neutral-600">
              Feronerie editată manual — sugestiile automate nu se mai aplică acestui corp. Cantitate 0 = rândul dispare la salvare.
            </p>
            <ActionForm action={saveCabinetHardware.bind(null, cabinetId)} className="space-y-2">
              {overrides.map((l, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="col-span-2">
                    <Select name="hardwareId" label="Produs" options={hardwareOptions} defaultValue={l.hardwareId} />
                  </div>
                  <NumberInput name="qty" label="Buc" defaultValue={l.qty} step="1" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="col-span-2">
                  <Select name="hardwareId" label="Adaugă produs" options={hardwareOptions} allowEmpty />
                </div>
                <NumberInput name="qty" label="Buc" defaultValue={0} required={false} step="1" />
              </div>
              <div className="flex gap-2">
                <SubmitButton>Salvează feroneria</SubmitButton>
              </div>
            </ActionForm>
            <div className="mt-2">
              <ActionForm action={resetCabinetHardware.bind(null, cabinetId)}>
                <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                  Revino la sugestiile automate
                </button>
              </ActionForm>
            </div>
          </>
        )}
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Piese suplimentare</h2>
        <ul className="mb-3 space-y-2">
          {extraParts.map((p, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className="grow">{p.name} — {fmtNum(p.lengthMm, 1)} × {fmtNum(p.widthMm, 1)} mm × {p.qty} buc ({materialName(p.materialId)})</span>
              <DeleteButton action={removeExtraPart.bind(null, cabinetId, i)} label="Șterge" />
            </li>
          ))}
          {extraParts.length === 0 && <li className="text-sm text-neutral-500">Nicio piesă suplimentară.</li>}
        </ul>
        <ActionForm action={addExtraPart.bind(null, cabinetId)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-6">
          <TextInput name="name" label="Denumire" />
          <NumberInput name="lengthMm" label="Lungime (mm)" step="1" />
          <NumberInput name="widthMm" label="Lățime (mm)" step="1" />
          <NumberInput name="qty" label="Buc" defaultValue={1} step="1" />
          <Select name="materialId" label="Material" options={materialOptions} />
          <div><SubmitButton>Adaugă</SubmitButton></div>
        </ActionForm>
      </section>
```

- [ ] **Step 2: Verifică și commit**

Run: `npm run build && npm test` — Expected: build ok, 102/102.

```bash
git add app/proiecte/
git commit -m "feat: editable cabinet hardware overrides and extra parts"
```

---

### Task 9: Pagina de proiect — corpuri, linii libere, rezumat, snapshot

**Files:**
- Create: `app/proiecte/[id]/page.tsx`

- [ ] **Step 1: Implementează pagina**

`app/proiecte/[id]/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import {
  addCabinet, addFreeLine, deleteCabinet, deleteProject, duplicateCabinet,
  recalculateProject, removeFreeLine, updateProjectSettings,
} from '@/lib/quote/actions';
import { ActionForm } from '@/components/ActionForm';
import { DeleteButton } from '@/components/DeleteButton';
import { NumberInput, Select, SubmitButton, TextInput } from '@/components/forms';
import { fmtLei, fmtNum } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Bază', SUSPENDAT: 'Suspendat', INALT: 'Înalt', SERTARE: 'Sertare', COLT: 'Colț',
};
const STATUS_OPTIONS = [
  { value: 'CIORNA', label: 'Ciornă' },
  { value: 'TRIMISA', label: 'Trimisă' },
  { value: 'ACCEPTATA', label: 'Acceptată' },
];
const CATEGORY_LABELS: [key: string, label: string][] = [
  ['boards', 'Plăci'], ['edging', 'Cant ABS'], ['cuttingService', 'Debitare'],
  ['hardware', 'Feronerie'], ['labor', 'Manoperă'], ['freeLines', 'Linii libere'],
];

export default async function ProiectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, cabinets, snapshot } = data;
  const freeLines = JSON.parse(project.freeLinesJson) as { name: string; amount: number }[];

  const computed = snapshot ? tryComputeQuote(toQuoteInput(project, cabinets), snapshot) : null;
  const quote = computed?.quote ?? null;
  const materialName = (mid: string) =>
    snapshot?.materials.find((m) => m.id === mid)?.name ?? mid;
  const bandLabel = (bid: string) =>
    snapshot?.edgeBands.find((b) => b.id === bid)?.name ?? bid;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-sm text-neutral-600">{project.clientName ?? 'Fără client'} {project.clientContact ? `· ${project.clientContact}` : ''}</p>
        </div>
        <DeleteButton action={deleteProject.bind(null, project.id)} label="Șterge proiectul" />
      </div>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Setările proiectului</h2>
        <ActionForm action={updateProjectSettings.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
          <NumberInput name="markupPct" label="Adaos (%)" defaultValue={project.markupPct} />
          <NumberInput name="yieldFactor" label="Factor utilizare foaie" defaultValue={project.yieldFactor} step="0.01" />
          <Select name="status" label="Stare" options={STATUS_OPTIONS} defaultValue={project.status} />
          <div><SubmitButton>Salvează</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Corpuri</h2>
          <ActionForm action={addCabinet.bind(null, project.id)}>
            <SubmitButton>Adaugă corp</SubmitButton>
          </ActionForm>
        </div>
        <ul className="space-y-2">
          {cabinets.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              <span className="grow">
                <Link href={`/proiecte/${project.id}/corp/${c.id}`} className="font-medium hover:underline">{c.input.label}</Link>
                {' '}— {TYPE_LABELS[c.input.type] ?? c.input.type} · {c.input.widthMm}×{c.input.heightMm}×{c.input.depthMm} mm
                {c.hardwareOverrides ? ' · feronerie editată' : ''}
              </span>
              <ActionForm action={duplicateCabinet.bind(null, c.id)}>
                <button type="submit" className="rounded border px-3 py-1.5 hover:bg-neutral-50">Duplică</button>
              </ActionForm>
              <DeleteButton action={deleteCabinet.bind(null, c.id)} />
            </li>
          ))}
          {cabinets.length === 0 && <li className="text-neutral-500">Niciun corp — adaugă primul.</li>}
        </ul>
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-semibold">Linii libere (blat, transport…)</h2>
        <ul className="mb-3 space-y-1 text-sm">
          {freeLines.map((l, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="grow">{l.name} — {fmtLei(l.amount)}</span>
              <DeleteButton action={removeFreeLine.bind(null, project.id, i)} label="Șterge" />
            </li>
          ))}
          {freeLines.length === 0 && <li className="text-neutral-500">Nicio linie liberă.</li>}
        </ul>
        <ActionForm action={addFreeLine.bind(null, project.id)} className="grid grid-cols-2 items-end gap-2 md:grid-cols-4">
          <TextInput name="name" label="Denumire" />
          <NumberInput name="amount" label="Suma (lei)" />
          <div><SubmitButton>Adaugă</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="rounded border bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Calcul și ofertă</h2>
          <ActionForm action={recalculateProject.bind(null, project.id)}>
            <SubmitButton>{snapshot ? 'Recalculează cu prețurile curente' : 'Calculează'}</SubmitButton>
          </ActionForm>
        </div>

        {!snapshot && <p className="text-sm text-neutral-600">Apasă „Calculează" pentru a copia prețurile curente în proiect și a vedea rezumatul.</p>}
        {computed?.error && <p className="rounded bg-red-50 px-2 py-1 text-sm text-red-700">{computed.error}</p>}

        {quote && snapshot && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">Prețuri copiate la: {new Date(snapshot.takenAt).toLocaleString('ro-RO')}</p>

            {quote.warnings.length > 0 && (
              <ul className="space-y-1">
                {quote.warnings.map((w, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">⚠ {w.cabinetLabel ? `${w.cabinetLabel}: ` : ''}{w.message}</li>
                ))}
              </ul>
            )}
            {quote.unresolvedHardware.length > 0 && (
              <ul className="space-y-1">
                {quote.unresolvedHardware.map((s, i) => (
                  <li key={i} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                    ⚠ Feronerie fără produs implicit: {s.name} × {s.qty} — setează implicitul în Setări sau editează feroneria corpului.
                  </li>
                ))}
              </ul>
            )}

            <table className="w-full max-w-md text-sm">
              <tbody>
                {CATEGORY_LABELS.map(([key, label]) => (
                  <tr key={key} className="border-b">
                    <td className="py-1 text-neutral-600">{label}</td>
                    <td className="text-right">{fmtLei(quote.costs.breakdown[key as keyof typeof quote.costs.breakdown])}</td>
                  </tr>
                ))}
                <tr className="border-b font-medium">
                  <td className="py-1">Cost total</td>
                  <td className="text-right">{fmtLei(quote.costs.totalCost)}</td>
                </tr>
                <tr className="text-lg font-bold">
                  <td className="py-1">Preț de vânzare (adaos {fmtNum(project.markupPct)}%)</td>
                  <td className="text-right">{fmtLei(quote.costs.sellPrice)}</td>
                </tr>
                {quote.costs.leiPerMl !== null && (
                  <tr className="text-sm text-neutral-500">
                    <td className="py-1">Echivalent lei/ml corpuri de bază</td>
                    <td className="text-right">{fmtNum(quote.costs.leiPerMl, 0)} lei/ml</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div>
              <h3 className="mb-1 font-medium">Necesar de materiale</h3>
              <ul className="text-sm">
                {quote.costs.needs.boards.map((b) => (
                  <li key={b.materialId}>
                    {materialName(b.materialId)}: {fmtNum(b.totalAreaSqm)} m²{b.sheets !== null ? ` → ${b.sheets} foi` : ' (la m²)'}
                  </li>
                ))}
                {quote.costs.needs.edging.map((e) => (
                  <li key={e.edgeBandId}>{bandLabel(e.edgeBandId)}: {fmtNum(e.totalMl)} ml</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-1 font-medium">Listă feronerie</h3>
              <ul className="text-sm">
                {quote.hardwareSummary.map((h) => (
                  <li key={h.name}>{h.qty} × {h.name}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/proiecte/${project.id}/oferta`} className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white">
                Ofertă pentru client (print/PDF)
              </Link>
              {quote.cutList.map((f) => (
                <a key={f.materialId} href={`/proiecte/${project.id}/export/debitare/${f.materialId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                  CSV debitare: {f.materialName}
                </a>
              ))}
              <a href={`/proiecte/${project.id}/export/feronerie`} className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50">
                CSV feronerie
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verifică și commit**

Run: `npm run build && npm test` — Expected: build ok, 102/102.

```bash
git add app/proiecte/
git commit -m "feat: project detail page with cost summary and snapshot"
```

---

### Task 10: Exporturile — ofertă printabilă + rute CSV

**Files:**
- Create: `app/proiecte/[id]/oferta/page.tsx`, `components/PrintButton.tsx`, `app/proiecte/[id]/export/debitare/[materialId]/route.ts`, `app/proiecte/[id]/export/feronerie/route.ts`
- Modify: `app/layout.tsx` (header capătă clasa `print:hidden`)

- [ ] **Step 1: PrintButton + header ascuns la print**

`components/PrintButton.tsx`:
```tsx
'use client';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded bg-neutral-900 px-4 py-2 text-white print:hidden"
    >
      Printează / Salvează PDF
    </button>
  );
}
```
În `app/layout.tsx`, pe `<header className="border-b bg-white">` adaugă clasa: `className="border-b bg-white print:hidden"`.

- [ ] **Step 2: Pagina de ofertă**

`app/proiecte/[id]/oferta/page.tsx`:
```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';
import { PrintButton } from '@/components/PrintButton';
import { fmtLei } from '@/lib/format';

export const dynamic = 'force-dynamic';

const TYPE_LABELS: Record<string, string> = {
  BAZA: 'Corp bază', SUSPENDAT: 'Corp suspendat', INALT: 'Corp înalt',
  SERTARE: 'Corp cu sertare', COLT: 'Corp de colț',
};

export default async function OfertaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) notFound();
  const { project, cabinets, snapshot } = data;

  if (!snapshot) {
    return (
      <p className="text-sm">
        Proiectul nu are un calcul salvat — <Link href={`/proiecte/${id}`} className="underline">înapoi la proiect</Link> și apasă „Calculează".
      </p>
    );
  }
  const { quote, error } = tryComputeQuote(toQuoteInput(project, cabinets), snapshot);
  if (!quote) return <p className="text-sm text-red-700">Eroare de calcul: {error}</p>;

  const materialName = (mid: string | null) =>
    mid ? (snapshot.materials.find((m) => m.id === mid)?.name ?? mid) : '—';

  return (
    <div className="mx-auto max-w-2xl space-y-6 bg-white p-6 print:p-0">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">EpicMob — Ofertă de preț</h1>
          <p className="text-sm text-neutral-600">
            {new Date().toLocaleDateString('ro-RO')} · Proiect: {project.name}
          </p>
          {project.clientName && (
            <p className="text-sm text-neutral-600">Client: {project.clientName} {project.clientContact ? `· ${project.clientContact}` : ''}</p>
          )}
        </div>
        <PrintButton />
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-neutral-600">
            <th className="py-1">Corp</th><th>Tip</th><th>Dimensiuni (L×H×A mm)</th><th>Fronturi</th>
          </tr>
        </thead>
        <tbody>
          {cabinets.map((c) => (
            <tr key={c.id} className="border-b last:border-0">
              <td className="py-1">{c.input.label}</td>
              <td>{TYPE_LABELS[c.input.type] ?? c.input.type}</td>
              <td>{c.input.widthMm} × {c.input.heightMm} × {c.input.depthMm}</td>
              <td>{materialName(c.input.frontMaterialId)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded border p-4 text-right">
        <div className="text-sm text-neutral-600">Preț total (materiale, feronerie, manoperă și montaj incluse)</div>
        <div className="text-3xl font-bold">{fmtLei(quote.costs.sellPrice)}</div>
      </div>

      <p className="text-xs text-neutral-500">
        Ofertă valabilă 30 de zile de la data emiterii. Execuție și montaj asumate prin contract.
        EpicMob · contact@epicmob.ro · +40 750 402 027
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Rutele CSV**

`app/proiecte/[id]/export/debitare/[materialId]/route.ts`:
```ts
import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  const { id, materialId } = await params;
  const data = await loadProject(id);
  if (!data) return new Response('Proiect inexistent', { status: 404 });
  if (!data.snapshot) return new Response('Proiectul nu are un calcul salvat — apasă „Calculează" întâi.', { status: 400 });
  const { quote, error } = tryComputeQuote(toQuoteInput(data.project, data.cabinets), data.snapshot);
  if (!quote) return new Response(`Eroare de calcul: ${error}`, { status: 400 });
  const file = quote.cutList.find((f) => f.materialId === materialId);
  if (!file) return new Response('Material fără piese în acest proiect', { status: 404 });
  return new Response('\uFEFF' + file.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="debitare-${materialId}.csv"`,
    },
  });
}
```

`app/proiecte/[id]/export/feronerie/route.ts`:
```ts
import { loadProject, toQuoteInput, tryComputeQuote } from '@/lib/quote/load';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProject(id);
  if (!data) return new Response('Proiect inexistent', { status: 404 });
  if (!data.snapshot) return new Response('Proiectul nu are un calcul salvat — apasă „Calculează" întâi.', { status: 400 });
  const { quote, error } = tryComputeQuote(toQuoteInput(data.project, data.cabinets), data.snapshot);
  if (!quote) return new Response(`Eroare de calcul: ${error}`, { status: 400 });
  const csv = ['Denumire;Buc', ...quote.hardwareSummary.map((h) => `${h.name};${h.qty}`)].join('\n') + '\n';
  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="feronerie.csv"',
    },
  });
}
```

- [ ] **Step 4: Verifică și commit**

Run: `npm run build && npm test` — Expected: build ok (rutele noi listate), 102/102.

```bash
git add app/ components/PrintButton.tsx
git commit -m "feat: printable quote page and csv export routes"
```

---

### Task 11: Smoke test end-to-end + verificare finală

**Files:**
- Create: `scripts/smoke-quote.ts`

- [ ] **Step 1: Scrie scriptul**

`scripts/smoke-quote.ts` (rulat cu tsx; creează un proiect real în DB, îl calculează, verifică cifrele, apoi îl șterge):
```ts
import { PrismaClient } from '@prisma/client';
import { buildSnapshot } from '../lib/quote/snapshot';
import { computeQuote } from '../lib/quote/compute';
import type { CabinetInput } from '../lib/engine';

const prisma = new PrismaClient();

async function main() {
  const pal = await prisma.material.findFirstOrThrow({ where: { kind: 'PAL', active: true } });
  const pfl = await prisma.material.findFirstOrThrow({ where: { kind: 'PFL', active: true } });
  const band = await prisma.edgeBand.findFirstOrThrow({ where: { active: true } });

  const input: CabinetInput = {
    label: 'SMOKE-B1', type: 'BAZA',
    widthMm: 600, heightMm: 720, depthMm: 560,
    shelves: 1, doors: 1,
    carcassMaterialId: pal.id, frontMaterialId: pal.id,
    back: { enabled: true, materialId: pfl.id, mount: 'FALT' },
    edgeBands: { carcassFrontEdgeId: band.id, frontPerimeterId: band.id },
  };

  const project = await prisma.project.create({
    data: {
      name: 'SMOKE TEST', markupPct: 30, yieldFactor: 0.8,
      cabinets: { create: [{ sortOrder: 0, inputJson: JSON.stringify(input) }] },
    },
  });

  try {
    const snapshot = await buildSnapshot();
    const quote = computeQuote(
      { markupPct: 30, yieldFactor: 0.8, freeLines: [], cabinets: [{ input, hardwareOverrides: null, extraParts: [] }] },
      snapshot,
    );
    if (!(quote.costs.totalCost > 0)) throw new Error('Cost total zero');
    if (!(quote.costs.sellPrice > quote.costs.totalCost)) throw new Error('Adaosul nu s-a aplicat');
    if (quote.parts.length < 5) throw new Error('Prea puține piese generate');
    if (quote.cutList.length < 1) throw new Error('Lista de debitare e goală');
    console.log('SMOKE OK:', {
      piese: quote.parts.length,
      costTotal: quote.costs.totalCost.toFixed(2),
      pretVanzare: quote.costs.sellPrice.toFixed(2),
      leiPerMl: quote.costs.leiPerMl?.toFixed(0),
    });
  } finally {
    await prisma.project.delete({ where: { id: project.id } });
  }
}

main()
  .catch((e) => { console.error('SMOKE FAIL:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Rulează smoke pe calcul**

Run: `npx tsx scripts/smoke-quote.ts`
Expected: `SMOKE OK: { piese: 5, costTotal: ..., pretVanzare: ..., leiPerMl: ... }` (valorile depind de prețurile din seed; toate > 0).

- [ ] **Step 3: Smoke pe pagini (production build)**

```bash
npm run build
(npm run start &) && sleep 3
curl -s http://localhost:3000/proiecte | grep -o "Proiect nou" | head -1
kill %1 2>/dev/null; pkill -f "next start" 2>/dev/null || true
```
Expected: `Proiect nou`.

- [ ] **Step 4: Verificare finală și commit**

Run: `npm test` — Expected: 102/102.

```bash
git add scripts/
git commit -m "test: end-to-end smoke script for quote computation"
```

---

### Task 12: Convențiile atelierului EpicMob (rosturi fronturi + hint uși)

Context: utilizatorul a furnizat convențiile reale ale atelierului — rost 2mm între uși; ușă unică = L−2mm pe lățime și H−2mm pe înălțime; două uși peste 600mm lățime = L/2−2mm fiecare. Formula generală a motorului `(L − 2·outerGap − (n−1)·frontGap)/n` reproduce EXACT aceste valori cu `outerGapMm = 1` și `frontGapMm = 2` (⇒ L/n − 2 pentru orice n). NU se modifică motorul și NU se modifică `DEFAULT_CONSTRUCTION` (cifrele de referință din teste depind de el) — doar valorile seed-ului, pe care utilizatorul le poate schimba oricând din Setări.

**Files:**
- Modify: `prisma/seed.ts` (constructionJson cu override), `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (hint uși)

- [ ] **Step 1: Seed cu valorile atelierului**

În `prisma/seed.ts`, înlocuiește linia `constructionJson: JSON.stringify(DEFAULT_CONSTRUCTION),` cu:
```ts
    // convenția atelierului EpicMob: rost 2mm între uși, 1mm la margine → ușă = L/n − 2mm, H − 2mm
    constructionJson: JSON.stringify({ ...DEFAULT_CONSTRUCTION, frontGapMm: 2, outerGapMm: 1 }),
```

- [ ] **Step 2: Hint pentru numărul de uși în editor**

În pagina editorului de corp, sub grila cu câmpul „Uși" (după primul `</div>` al grilei), adaugă:
```tsx
          <p className="text-xs text-neutral-500">
            Convenție atelier: până în 600mm lățime → 1 ușă; peste → 2 uși. Corpurile suspendate tip hotă se fac cu tipul „Corp suspendat".
          </p>
```

- [ ] **Step 3: Aplică seed-ul pe DB-ul local și verifică**

Run: `npm run db:seed` — Expected: "Seed complet." (upsert actualizează setările existente).
Run: `npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.appSettings.findUnique({ where: { id: 1 } }).then(s => { const c = JSON.parse(s!.constructionJson); console.log(c.frontGapMm, c.outerGapMm); return p.\$disconnect(); });"` — Expected: `2 1`.
Run: `npm test && npm run build` — Expected: 102/102 (testele motorului folosesc DEFAULT_CONSTRUCTION, neafectate), build ok.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts app/proiecte/
git commit -m "feat: EpicMob workshop front gap conventions in seed defaults"
```

---

## După acest plan

Aplicația e completă pe scopul v1 din spec. **Criteriul de acceptanță** se validează manual cu utilizatorul: introduce o bucătărie reală (deja ofertată manual), cu prețurile reale în cataloage, și compară necesarul de materiale + costul cu realitatea. Diferențele se calibrează din Setări (factor de utilizare, constante) și cataloage — nu din cod.

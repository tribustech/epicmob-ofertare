# Fronturi MDF vopsit — Plan de implementare

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. Execută task-cu-task, TDD unde există suprafață, commit-uri dese.

**Goal:** Un front de corp poate fi „MDF vopsit" (arhetip *front finisat*, cotat per m² după furnizor + model-formă + finisaj + fețe + culoare RAL), pe lângă plăcile existente.

**Architecture:** Catalog nou în DB (`FrontSupplier`/`FrontModel`/`FrontPrice`) seed-uit din oferta Paint Mob. Frontul corpului capătă `frontKind` + `mdfFront` în `inputJson`. Costing-ul rutează costul pieselor-front: placă → material din catalog (ca azi); MDF vopsit → formulă per m² în EUR × curs `eurToRon`. UI: selector „Tip front" + sub-formular vopsit în `CabinetEditorForm` (redesignat, cu `SectionAccordion`/`SegmentedControl`). RAL din `data/ral/ral-classic.json`.

**Tech Stack:** Next 15 App Router, Prisma/SQLite, React 19, Tailwind v4, shadcn (`radix-ui`), Vitest, `tsx`.

**Design de referință:** `docs/plans/2026-07-15-fronturi-mdf-vopsit-design.md`.

**Mediu:** worktree `.worktrees/fronturi-mdf-vopsit`, branch `feat/fronturi-mdf-vopsit` (off `main` cu redesign inclus). Baseline: `npm test` = 129 verzi, `tsc` 0. `dev.db` la `prisma/dev.db` (are catalogul melaminat + feronerie seed-uite). ⚠️ Lucrează EXCLUSIV în acest worktree.

---

## Date de referință — oferta Paint Mob (coloana „cu MDF", EUR fără TVA)

**Tier → model** (din lista de prețuri):
- `PLAN` — fronturi plane (fără frezare).
- `SIMPLU` — Front Mob: F2, F3, F7, F11, F12, F13.
- `MEDIU` — FAGG: G10, M10, V90, V120, LV55, LM66 · Front Mob: F1, F4, F6, F9, F18, F19, F21, F23.
- `COMPLEX` — FAGG: KV5, KS8, KL5 · Front Mob: F5, F8, F10, F14, F15, F16, F17, F20, F22, F24.
- `COMPLEX2` — FAGG: KM44, KR28, KG63.
- `RIFLAJ` — Front Mob: R3, R6, R7.
- `RIFLAJ2` — Front Mob: R1, R2, R4, R5.
- `PERFORAT_FAGG` — uși zăbrele FAGG: F1, F2, F3, F1A, F2A, F3A (⚠️ coliziune de cod cu frezatele Front Mob — vezi seed).
- `PERFORAT_STD` — uși zăbrele obișnuite (4/6/8 ochiuri).
- `DRESSING` — uși dressing FAGG: D1, D2, D3, D4.

**Preț/m² „cu MDF" (EUR):**
| tier | grosime | mat 1f | mat 2f | lucios 1f | lucios 2f |
|---|---|---|---|---|---|
| PLAN | 18 | 70 | 102 | 95 | 148 |
| PLAN | 40 | 102 | 145 | 127 | 195 |
| SIMPLU | 18 | 105 | — | — | — |
| MEDIU | 18 | 115 | — | — | — |
| COMPLEX | 18 | 120 | — | — | — |
| COMPLEX2 | 18 | 135 | — | — | — |
| RIFLAJ | 18 | 135 | — | — | — |
| RIFLAJ2 | 18 | 145 | — | — | — |
| PERFORAT_FAGG | 18 | 150 | — | — | — |
| PERFORAT_STD | 18 | 125 | — | — | — |
| DRESSING | 18 | 158 | — | — | — |

„—" = necotat în ofertă → la lookup lipsă, costing marchează „preț la cerere" (nu crapă).

**Constante furnizor (EUR):** `handleMillingEur=7` (frezare mâner J/T „cu MDF", per buc), `vividSurchargeEur=13`, `metallicSurchargeEur=36`, `blackGlossEurPerFace=6`.
**Shape family:** R*→RIFLAJ · F*(frezate clasice), G/M/V/L*→CLASIC · K*→(Modern) CLASIC · perforate/D*→PERFORAT · plan→PLAN.
**Curs implicit:** `eurToRon=4.97` (actualizabil în setări).

---

## Task 1: Model DB (FrontSupplier/FrontModel/FrontPrice) + eurToRon + migrare

**Files:** Modify `prisma/schema.prisma`.

**Step 1:** Adaugă modelele:
```prisma
model FrontSupplier {
  id                  String   @id @default(cuid())
  name                String
  productType         String   // VOPSIT | INFOLIAT
  currency            String   @default("EUR")
  handleMillingEur    Float    @default(0)
  vividSurchargeEur   Float    @default(0)
  metallicSurchargeEur Float   @default(0)
  blackGlossEurPerFace Float   @default(0)
  active              Boolean  @default(true)
  updatedAt           DateTime @updatedAt
  models              FrontModel[]
  prices              FrontPrice[]
}
model FrontModel {
  id              String  @id
  supplierId      String
  supplier        FrontSupplier @relation(fields: [supplierId], references: [id])
  code            String
  name            String
  shapeFamily     String  // PLAN|CLASIC|RIFLAJ|MANER|PERFORAT
  tier            String  // cheie spre FrontPrice
  collection      String? // Clasic|Modern|Line|Front|Dressing
  hasHandleMilling Boolean @default(false)
  imageUrl        String?
  active          Boolean @default(true)
  @@index([supplierId])
}
model FrontPrice {
  id            String @id @default(cuid())
  supplierId    String
  supplier      FrontSupplier @relation(fields: [supplierId], references: [id])
  tier          String
  finish        String // MAT|LUCIOS
  faces         Int    // 1|2
  thicknessMm   Int    @default(18)
  pricePerSqmEur Float
  @@unique([supplierId, tier, finish, faces, thicknessMm])
}
```
Și în `model AppSettings` adaugă: `eurToRon Float @default(4.97)`.

**Step 2:** `npx prisma migrate dev --name fronturi-mdf-vopsit` → aplicată + client generat.
**Step 3:** `npx tsc --noEmit` → curat.
**Step 4:** commit `feat(db): tabele FrontSupplier/FrontModel/FrontPrice + eurToRon`.

---

## Task 2: Seed Paint Mob (db:seed-fronturi)

**Files:** Create `scripts/seed-fronturi.ts`; Modify `package.json`.

**Step 1:** Scrie `scripts/seed-fronturi.ts` (mirror `scripts/seed-decoruri.ts` pentru stil/PrismaClient), idempotent:
- upsert `FrontSupplier` „Paint Mob Design" (id determinist `supplier-paint-mob`, productType VOPSIT, constantele EUR de mai sus).
- upsert `FrontModel`-uri din maparea tier→model de mai sus. id determinist `model-paint-mob-{collection}-{code}` (⚠️ include `collection` ca să eviți coliziunea F1/F2/F3 dintre frezatele Front Mob și perforatele FAGG). `hasHandleMilling=true` pentru seria M (M1–M3, M10*) și modelele cu mâner integrat; `imageUrl=null` deocamdată (galeria de forme e o iterare ulterioară).
- upsert `FrontPrice` din tabelul de preț (doar celulele cotate; nu inventa „—").
**Step 2:** `package.json` scripts: `"db:seed-fronturi": "tsx scripts/seed-fronturi.ts"`.
**Step 3:** `npm run db:seed-fronturi` → rulează fără erori; loghează câți furnizori/modele/prețuri.
**Step 4:** Verifică în DB (groupBy tier) + idempotență (a doua rulare = același count).
**Step 5:** commit `feat(seed): db:seed-fronturi — furnizor Paint Mob + modele + matrice preț`.

---

## Task 3: Loader RAL + helper preț front (TDD)

**Files:** Create `lib/quote/front-pricing.ts`; Test `lib/quote/__tests__/front-pricing.test.ts`. Create `lib/ral.ts` (loader server-side al `data/ral/ral-classic.json`).

**Step 1 (TDD):** scrie testul pentru `frontVopsitCostEur(args)` care implementează formula din design:
```ts
frontVopsitCostEur({
  areaSqm, frontCount, pricePerSqmEur, faces, finish,
  colorCategory, ralBlack, supplier // constantele EUR
}) => number
```
Cazuri: mat/normala 1 față (doar aria×preț); vie (+13/m²); metalizat (+36/m²); lucios+negru (+6×fețe/m²); cu frezare mâner (+handleMillingEur×frontCount). Verifică numeric.
**Step 2:** rulează → FAIL.
**Step 3:** implementează `front-pricing.ts` pur (fără DB). Adaugă `lib/ral.ts` cu `getRalColors()` (citește JSON) + `isRalBlack(code)` / `ralIsVivid(code)`.
**Step 4:** `npm test -- front-pricing` → PASS; suită completă verde.
**Step 5:** commit `feat(costing): helper frontVopsitCostEur + loader RAL`.

---

## Task 4: Schema input corp — frontKind + mdfFront

**Files:** Modify `lib/quote/cabinet-form.ts` (zod schema + `toCabinetInput`), `lib/engine/types.ts` (CabinetInput).

**Step 1:** În schema zod adaugă:
```ts
frontKind: z.enum(['PAL','MDF_MELAMINAT','MDF_INFOLIAT','MDF_VOPSIT']).default('PAL'),
mdfSupplierId: optStr, mdfModelId: optStr,
mdfFinish: z.enum(['MAT','LUCIOS']).default('MAT'),
mdfFaces: z.coerce.number().int().min(1).max(2).default(1),
mdfRalCode: optStr,
mdfColorCategory: z.enum(['NORMALA','VIE','METALIZAT']).default('NORMALA'),
```
Refine: dacă `frontType!=='FARA' && frontKind==='MDF_VOPSIT'` → cer `mdfSupplierId,mdfModelId,mdfRalCode`. Când `frontKind==='MDF_VOPSIT'`, `frontMaterialId` și `frontPerimeterId` NU sunt cerute (relaxează refine-ul existent „Fronturile cer un material de front" pentru cazul vopsit).
**Step 2:** `toCabinetInput`: mapează în `CabinetInput` un obiect `mdfFront` (când vopsit) și `frontKind`. `frontMaterialId=null` la vopsit.
**Step 3:** `lib/engine/types.ts`: adaugă pe `CabinetInput` `frontKind?: string` și `mdfFront?: { supplierId; modelId; finish; faces; ralCode; colorCategory }`.
**Step 4:** `npx tsc --noEmit` curat; teste verzi (fixture-urile default rămân `frontKind: 'PAL'`).
**Step 5:** commit `feat(schema): frontKind + mdfFront pe inputul de corp`.

---

## Task 5: Costing — ramura MDF vopsit în engine (TDD)

**Files:** Modify `lib/engine/costing.ts` (+ `lib/catalog/convert.ts` dacă e nevoie de catalogul de fronturi în CostCatalogs); Test `lib/engine/__tests__/costing.test.ts`.

**Step 1:** Decide transportul datelor de front în engine: extinde `CostCatalogs` cu `frontModels`, `frontPrices`, `frontSuppliers`, `eurToRon` (populat din snapshot, ca materialele). Adaugă în `toCostCatalogs`.
**Step 2 (TDD):** test: un corp cu `frontKind='MDF_VOPSIT'` (model tier MEDIU, mat, 1 față, RAL normal) → costul fronturilor = `ariaFront × 115 × eurToRon` (fără cost placă-front, fără cant pe fronturi). Un corp cu frezare mâner → + `7×N×eurToRon`.
**Step 3:** implementează în `computeCosts`: când cabinetul e vopsit, exclude piesele-front din costul de placă și din edging; calculează `frontVopsitCostEur(...)` din `FrontPrice(tier,finish,faces)` + constantele furnizorului, × `eurToRon`; adaugă la `boards` (cost material). Piese-front identificabile după `name`/rol (vezi cum le marchează `expandCabinet`). Dacă `FrontPrice` lipsește pt. combinația cerută → warning „preț la cerere" (cost 0), nu throw.
**Step 4:** teste verzi (noi + existente).
**Step 5:** commit `feat(costing): fronturi MDF vopsit cotate per m² (EUR×curs)`.

---

## Task 6: RalPicker + FrontModelPicker (componente)

**Files:** Create `components/RalPicker.tsx`, `components/FrontModelPicker.tsx`. Expose RAL to client: `app/.../` server passfor or a route; cel mai simplu — server component citește `getRalColors()` și pasează lista în `CabinetEditorForm` prin props (ca `snapshot`).

**Step 1:** `RalPicker` (radix `Popover` + căutare, ca `MaterialPicker`): swatch (bg=hex) + cod + nume; căutare pe cod/nume; la alegere → `onChange(ralCode)` + sugerează `colorCategory='VIE'` dacă `vivid` (callback `onVividHint`). Fără dependințe noi.
**Step 2:** `FrontModelPicker`: listă modele (din `snapshot.frontModels` filtrate pe furnizor), grupate pe `collection`; afișează cod + nume + tier (+ poză dacă `imageUrl`). radix Popover + căutare.
**Step 3:** `npx tsc --noEmit` curat; `npm run build` OK.
**Step 4:** commit `feat(ui): RalPicker + FrontModelPicker`.

---

## Task 7: „Tip front" + sub-formular vopsit în CabinetEditorForm

**Files:** Modify `components/CabinetEditorForm.tsx`, `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (pasează frontSuppliers/frontModels + ralColors în snapshot/props), `lib/quote/snapshot.ts` + `lib/quote/compute.ts` (SnapshotData) pentru noile cataloage.

**Step 1:** `buildSnapshot` încarcă `frontSuppliers/frontModels/frontPrices` + `settings.eurToRon`; adaugă în `SnapshotData`. `toCostCatalogs` le folosește (Task 5).
**Step 2:** În secțiunea „Materiale și canturi", la „Material fronturi" adaugă un `SegmentedControl` **„Tip front"** = PAL·MDF melaminat·MDF infoliat(disabled)·MDF vopsit (leagă de `values.frontKind`).
- `frontKind` placă (PAL/MDF melaminat) → `MaterialPicker` (filtrat pe kind) + „Cant fronturi" — ca azi.
- `frontKind==='MDF_VOPSIT'` → ascunde MaterialPicker-ul de front + cantul; arată: **Furnizor** (Select din frontSuppliers) · **`FrontModelPicker`** · **Finisaj** (SegmentedControl MAT/LUCIOS) · **Nr. fețe** (SegmentedControl 1/2) · **`RalPicker`** · **Categorie culoare** (SegmentedControl NORMALA/VIE/METALIZAT, presetată din sugestia RAL). Preț live se recalculează (catalogs includ frontModels/prices).
**Step 3:** `app/.../corp/[cabinetId]/page.tsx`: pasează noile date; asigură `frontKind` inițial din input.
**Step 4:** `npm run build` OK; `npx tsc` curat; teste verzi.
**Step 5:** Verificare live (skill `verify` / argent Chromium): un corp cu uși → alege „MDF vopsit", furnizor Paint Mob, model MEDIU, RAL 7016 → preț live apare; cantul dispare; salvează → reîncarcă → persistă.
**Step 6:** commit `feat(corp): tip front + sub-formular MDF vopsit`.

---

## Task 8: Setare curs EUR→RON

**Files:** Modify `app/setari/page.tsx` (+ action de update settings dacă există).

**Step 1:** Adaugă câmp „Curs EUR→RON" legat de `AppSettings.eurToRon`, salvabil.
**Step 2:** build OK; commit `feat(setari): curs EUR→RON`.

---

## Task 9: Afișare front vopsit în Ofertă + rezumate

**Files:** Modify `app/proiecte/[id]/oferta/page.tsx` (+ eventual `CabinetsTable`).

**Step 1:** Când frontul e MDF vopsit, afișează în loc de numele materialului: `„MDF vopsit · {model.code} · {finisaj} · {RAL}"`. Fără crash dacă `FrontPrice` lipsește (marchează „preț la cerere").
**Step 2:** build OK; commit `feat(oferta): afișare fronturi MDF vopsit`.

---

## Task 10: Verificare finală + code review

**Step 1:** `npm test` (verde), `npm run build` (OK), `npx tsc --noEmit` (0).
**Step 2:** Flux manual: seed → corp cu MDF vopsit → preț live corect (ex. MEDIU mat 1f RAL 7016 = arie×115×curs) → ofertă.
**Step 3:** `superpowers:requesting-code-review` → `superpowers:finishing-a-development-branch`.

---

## Note
- **Nu** atinge alte branch-uri/worktree-uri. Lucrează în `.worktrees/fronturi-mdf-vopsit`.
- Path-uri cu `[id]`/`[cabinetId]` = quote în ghilimele simple / pathspec `:(literal)` la git.
- Coliziune cod F1/F2/F3 (frezate Front Mob vs perforate FAGG) → dezambiguizată prin `collection` în id-ul modelului.
- Out of scope (design): infoliat, piese liniare/ML, „fără MDF", comenzi mici, galeria de forme (poze).

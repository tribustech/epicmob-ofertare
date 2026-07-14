# Catalog decoruri → Materiale (galerie + picker pe corp) — Plan de implementare

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cele 640 decoruri din `catalog-decoruri.json` devin materiale selectabile în DB; pagina Materiale devine galerie shadcn cu poze/căutare/filtre; selectoarele de material din corp devin picker cu poză+căutare; materialele fără preț sunt semnalate cu badge peste tot.

**Architecture:** Seedăm catalogul în tabela `Material` (coloane noi opționale: `imageUrl/decorCode/brand/structura/category`). Engine-ul de costing rămâne intact — doar relaxăm `toBoardMaterial` să nu crape pe preț null (→ 0). UI: galerie (`/cataloage/materiale`) + `MaterialPicker` (radix `Popover` + input custom, fără cmdk) în `CabinetEditorForm`. Badge „fără preț" în galerie, picker și ofertă.

**Tech Stack:** Next 15 (App Router, server components + server actions), Prisma/SQLite, React 19, Tailwind v4, shadcn (`radix-ui` unified), Vitest.

**Design de referință:** `docs/plans/2026-07-14-catalog-decoruri-materiale-design.md`

**Mediu:** worktree `.worktrees/catalog-materiale`, branch `feature/catalog-materiale`. `dev.db` la `prisma/dev.db`. Baseline: `npm test` = 126 teste verzi.

---

## Task 1: Extindere model Material + migrare

**Files:**
- Modify: `prisma/schema.prisma` (model `Material`)
- Modify: `lib/catalog/convert.ts` (interfața `MaterialRow`)

**Step 1: Adaugă coloanele în schema.prisma**

În `model Material`, după `pricePerSqm Float?`:
```prisma
  imageUrl      String?
  decorCode     String?
  brand         String?
  structura     String?
  category      String   @default("PLACA") // PLACA | BLAT
```

**Step 2: Rulează migrarea**

Run: `npx prisma migrate dev --name material-decor-fields`
Expected: migrare aplicată, `prisma generate` rulează automat, fără erori.

**Step 3: Extinde `MaterialRow`** (`lib/catalog/convert.ts:7-11`) — câmpuri opționale pass-through:
```ts
export interface MaterialRow {
  id: string; name: string; kind: string; thicknessMm: number;
  sheetLengthMm: number; sheetWidthMm: number;
  pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
  imageUrl?: string | null; decorCode?: string | null;
  brand?: string | null; structura?: string | null; category?: string | null;
}
```

**Step 4: Verifică build de tipuri**

Run: `npx tsc --noEmit`
Expected: fără erori noi.

**Step 5: Commit**
```bash
git add prisma/schema.prisma prisma/migrations lib/catalog/convert.ts
git commit -m "feat(db): coloane decor pe Material (imageUrl/decorCode/brand/structura/category)"
```

---

## Task 2: Relaxare validare preț în `toBoardMaterial` (TDD)

**Files:**
- Modify: `lib/catalog/convert.ts:29-48` (`toBoardMaterial`)
- Test: `lib/catalog/__tests__/convert.test.ts`

**Step 1: Scrie testul care eșuează**

În `convert.test.ts`, adaugă:
```ts
it('materialul PER_SHEET fără preț → pricePerSheet 0 (nu aruncă)', () => {
  const row: MaterialRow = {
    id: 'm1', name: 'PAL fără preț', kind: 'PAL', thicknessMm: 18,
    sheetLengthMm: 2800, sheetWidthMm: 2070,
    pricingMode: 'PER_SHEET', pricePerSheet: null, pricePerSqm: null,
  };
  const bm = toBoardMaterial(row);
  expect(bm.pricing).toEqual({ mode: 'PER_SHEET', pricePerSheet: 0 });
});
```
(asigură importul `MaterialRow`/`toBoardMaterial` deja prezent în fișier)

**Step 2: Rulează testul — trebuie să eșueze**

Run: `npm test -- convert`
Expected: FAIL — aruncă „nu are preț per foaie".

**Step 3: Implementează relaxarea** — în `toBoardMaterial`, ramura PER_SHEET și PER_SQM:
```ts
  if (row.pricingMode === 'PER_SHEET') {
    pricing = { mode: 'PER_SHEET', pricePerSheet: row.pricePerSheet ?? 0 };
  } else if (row.pricingMode === 'PER_SQM') {
    pricing = { mode: 'PER_SQM', pricePerSqm: row.pricePerSqm ?? 0 };
  } else {
    throw new Error(`Mod de preț necunoscut: ${row.pricingMode} (${row.name})`);
  }
```

**Step 4: Rulează testele**

Run: `npm test -- convert`
Expected: PASS (inclusiv testele existente care verificau prețuri valide).

**Step 5: Commit**
```bash
git add lib/catalog/convert.ts lib/catalog/__tests__/convert.test.ts
git commit -m "feat(costing): materialele fără preț → 0 în loc de eroare"
```

---

## Task 3: Helper `materialsWithoutPrice`

**Files:**
- Create: `lib/quote/material-price.ts`
- Test: `lib/quote/__tests__/material-price.test.ts`

**Step 1: Scrie testul care eșuează**

`material-price.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { materialHasNoPrice } from '../material-price';

describe('materialHasNoPrice', () => {
  it('true când PER_SHEET și pricePerSheet null/0', () => {
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: null, pricePerSqm: null })).toBe(true);
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: 0, pricePerSqm: null })).toBe(true);
  });
  it('false când are preț', () => {
    expect(materialHasNoPrice({ pricingMode: 'PER_SHEET', pricePerSheet: 404.71, pricePerSqm: null })).toBe(false);
    expect(materialHasNoPrice({ pricingMode: 'PER_SQM', pricePerSheet: null, pricePerSqm: 120 })).toBe(false);
  });
});
```

**Step 2: Rulează — eșuează**

Run: `npm test -- material-price`
Expected: FAIL — modul inexistent.

**Step 3: Implementează**

`lib/quote/material-price.ts`:
```ts
export function materialHasNoPrice(m: {
  pricingMode: string; pricePerSheet: number | null; pricePerSqm: number | null;
}): boolean {
  const price = m.pricingMode === 'PER_SQM' ? m.pricePerSqm : m.pricePerSheet;
  return price == null || price === 0;
}
```

**Step 4: Rulează — pass**

Run: `npm test -- material-price`
Expected: PASS.

**Step 5: Commit**
```bash
git add lib/quote/material-price.ts lib/quote/__tests__/material-price.test.ts
git commit -m "feat: helper materialHasNoPrice pentru semnalare preț lipsă"
```

---

## Task 4: Script de seed `db:seed-decoruri`

**Files:**
- Create: `scripts/seed-decoruri.ts`
- Modify: `package.json` (scripts)

**Step 1: Scrie scriptul**

`scripts/seed-decoruri.ts` — citește `data/decoruri-furnizori/catalog-decoruri.json`, upsert idempotent pe id determinist:
```ts
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CatalogRow = {
  brand: string; cod_decor: string | null; cod_normalizat: string;
  denumire: string; structura: string | null; image: string | null;
  pret_ron: number | null; tip: string; grosime_mm?: number | null;
};

function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

function kindFor(brand: string): string {
  if (brand === 'AGT') return 'MDF_MELAMINAT';
  return 'PAL'; // Egger, Kastamonu
}

async function main() {
  const rows: CatalogRow[] = JSON.parse(
    readFileSync('data/decoruri-furnizori/catalog-decoruri.json', 'utf8'),
  );
  let seeded = 0, noPrice = 0;
  for (const r of rows) {
    const isBlat = r.tip === 'blat' || r.tip === 'panou_spate';
    const id = `decor-${slug(r.brand)}-${slug(r.cod_normalizat)}`;
    const name = r.cod_decor ? `${r.cod_decor} · ${r.denumire}` : r.denumire;
    const data = {
      name,
      kind: kindFor(r.brand),
      thicknessMm: isBlat ? (r.grosime_mm ?? 38) : 18,
      sheetLengthMm: 2800,
      sheetWidthMm: 2070,
      pricingMode: 'PER_SHEET',
      pricePerSheet: r.pret_ron,
      pricePerSqm: null,
      imageUrl: r.image,
      decorCode: r.cod_decor,
      brand: r.brand,
      structura: r.structura,
      category: isBlat ? 'BLAT' : 'PLACA',
      active: true,
    };
    await prisma.material.upsert({ where: { id }, create: { id, ...data }, update: data });
    seeded++;
    if (r.pret_ron == null) noPrice++;
  }
  console.log(`Seed decoruri: ${seeded} materiale (${noPrice} fără preț).`);
}

main().finally(() => prisma.$disconnect());
```

**Step 2: Adaugă comanda npm** — în `package.json` `scripts`, după `db:seed`:
```json
    "db:seed-decoruri": "tsx scripts/seed-decoruri.ts",
```

**Step 3: Rulează seed-ul**

Run: `npm run db:seed-decoruri`
Expected: `Seed decoruri: 640 materiale (~69 fără preț).`

**Step 4: Verifică în DB**

Run: `npx tsx -e "import {PrismaClient} from '@prisma/client'; const p=new PrismaClient(); p.material.groupBy({by:['brand','category'],_count:true}).then(r=>{console.log(r);return p.\$disconnect()})"`
Expected: grupuri Egger/Kastamonu/AGT × PLACA/BLAT.

**Step 5: Re-rulează (idempotență)**

Run: `npm run db:seed-decoruri` din nou → același total, fără dubluri (verifică `count`).

**Step 6: Commit**
```bash
git add scripts/seed-decoruri.ts package.json
git commit -m "feat(seed): db:seed-decoruri importă catalogul în Material (idempotent)"
```

---

## Task 5: Badge „fără preț" reutilizabil

**Files:**
- Create: `components/NoPriceBadge.tsx`

**Step 1: Implementează** (folosește `Badge` shadcn existent, variantă destructive):
```tsx
import { Badge } from '@/components/ui/badge';

export function NoPriceBadge({ className }: { className?: string }) {
  return <Badge variant="destructive" className={className}>fără preț</Badge>;
}
```

**Step 2: Verifică tipuri**

Run: `npx tsc --noEmit`
Expected: fără erori (confirmă că `Badge` acceptă `variant="destructive"` — altfel folosește clasă Tailwind roșie).

**Step 3: Commit**
```bash
git add components/NoPriceBadge.tsx
git commit -m "feat(ui): NoPriceBadge"
```

---

## Task 6: Pagina Materiale → galerie shadcn

**Files:**
- Create: `components/MaterialeGalerie.tsx` (client)
- Modify: `app/cataloage/materiale/page.tsx`

**Step 1: Client component galerie**

`components/MaterialeGalerie.tsx`:
- props: `materials: MaterialCard[]` (id, name, kind, thicknessMm, brand, category, imageUrl, decorCode, pricePerSheet, pricingMode, pricePerSqm)
- state: `q` (căutare), `brand` filtru, `category` filtru
- filtrare case-insensitive pe `name+decorCode`; chips brand (toate/Egger/Kastamonu/AGT/manual=brand null) și categorie (toate/Plăci/Blaturi)
- grid `grid-cols-[repeat(auto-fill,minmax(150px,1fr))]`, carduri `Card` cu:
  - thumbnail: `<img src={imageUrl}>` sau placeholder „fără imagine"
  - `decorCode` (bold), `name`/denumire, `Badge` brand, preț sau `<NoPriceBadge/>`, `kind`+grosime
- contor rezultate

**Step 2: Server page** — `app/cataloage/materiale/page.tsx`:
- încarcă `prisma.material.findMany({ where: { active: true }, orderBy: [{ brand: 'asc' }, { name: 'asc' }] })`
- randează `<MaterialeGalerie materials={...} />`
- păstrează `createMaterial/updateMaterial/deactivateMaterial` accesibile (buton „Adaugă manual" + editare per card într-un `<details>`/dialog simplu — reutilizează `MaterialFields` existent)

**Step 3: Build + verificare vizuală**

Run: `npm run build`
Expected: build OK.
Apoi `npm run dev`, deschide `/cataloage/materiale` → galerie cu poze, filtre funcționale, badge „fără preț" pe AGT fără preț.
(verificare cu skill `verify` / manual în browser)

**Step 4: Commit**
```bash
git add components/MaterialeGalerie.tsx app/cataloage/materiale/page.tsx
git commit -m "feat(materiale): galerie shadcn cu poze, căutare și filtre"
```

---

## Task 7: `MaterialPicker` (combobox cu poză) + integrare în corp

**Files:**
- Create: `components/MaterialPicker.tsx` (client, radix `Popover` + input custom)
- Modify: `components/CabinetEditorForm.tsx` (înlocuiește `SelectField` la carcasă/fronturi/spate/fund sertar)
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx` dacă e nevoie să treacă lista completă de materiale (deja are `snapshot.materials`)

**Step 1: `MaterialPicker`**
- props: `label`, `value` (id), `onChange`, `materials` (lista din `snapshot.materials`, filtrată `category !== 'BLAT'`), `allowEmpty`
- trigger: buton cu thumbnail mic + `decorCode`/`name` selectat; dacă materialul selectat are preț lipsă → `<NoPriceBadge/>` lângă
- deschide `Popover.Content`: input de căutare (`Input`), listă scroll cu rânduri (thumb + cod + denumire + preț/`NoPriceBadge`), click → `onChange(id)` + închide
- filtrare pe `q` (cod+denumire), opțional filtru brand
- fallback: dacă `value` nu e în listă (material dezactivat), afișează-l totuși (ca `optionsWithCurrent`)

**Step 2: Integrare în `CabinetEditorForm`** (`components/CabinetEditorForm.tsx:219-222`, `276-277`, `319`):
- înlocuiește cele 4 `SelectField` de material cu `MaterialPicker`, pasând `snapshot.materials.filter(m => m.category !== 'BLAT')`
- canturile (`SelectField` band) rămân neschimbate
- adaugă un mic banner sub secțiunea „Materiale și canturi": dacă vreun material selectat are `materialHasNoPrice` → text „Materiale fără preț: … (apar cu 0 lei)"

**Step 3: Build + verificare**

Run: `npm run build` → OK.
`npm run dev` → deschide un corp, pickerul arată poze+căutare, blaturile lipsesc, badge la materialele fără preț, prețul live se recalculează la schimbare.

**Step 4: Commit**
```bash
git add components/MaterialPicker.tsx components/CabinetEditorForm.tsx app/proiecte
git commit -m "feat(corp): picker material cu poză+căutare, badge fără preț, blaturi excluse"
```

---

## Task 8: Badge „fără preț" în pagina Ofertă

**Files:**
- Modify: `app/proiecte/[id]/oferta/page.tsx`

**Step 1:** Găsește unde se listează materialele/corpurile (`grep -n "material" app/proiecte/[id]/oferta/page.tsx`).

**Step 2:** Pentru fiecare material afișat care satisface `materialHasNoPrice`, randează `<NoPriceBadge/>` lângă nume; opțional un rând de avertisment agregat.

**Step 3: Build + verificare**

Run: `npm run build` → OK. Verifică pagina ofertă cu un corp ce folosește material fără preț.

**Step 4: Commit**
```bash
git add app/proiecte/[id]/oferta/page.tsx
git commit -m "feat(oferta): badge fără preț pe materialele fără preț"
```

---

## Task 9: Verificare finală

**Step 1:** `npm test` → toate verzi (inclusiv testele noi).
**Step 2:** `npm run build` → OK.
**Step 3:** `npx tsc --noEmit` → fără erori.
**Step 4:** Flux manual: seed → galerie → adaugă corp → alege decor din picker → preț live → ofertă cu badge.
**Step 5:** Skill `superpowers:requesting-code-review` înainte de merge; apoi `superpowers:finishing-a-development-branch`.

---

## Note

- **Nu atinge** branch-ul `montaj-feronerie-manere` (celălalt agent). Lucrăm doar în worktree.
- `dev.db` e local worktree-ului; seed-ul rulează pe copia din `prisma/dev.db`.
- Re-seed suprascrie editările manuale pe rândurile `decor-*` (documentat în design).

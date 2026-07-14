# Montaj blat/fund, feronerie pe fronturi, mânere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montaj aplicat/încadrat pentru blatul și fundul corpului, selecția feroneriei pe tip de front (balamale la uși; glisiere Tandem + cutie PAL vs Tandembox complet fără debitare), și 7 tipuri de mânere (aplicat/buton/îngropat/profil J/GOLA/push/fără) cu efecte pe preț și pe dimensiunile fronturilor.

**Architecture:** Motorul pur `lib/engine` primește câmpuri noi OPȚIONALE pe `CabinetInput` (`mount`, `hardwareSel`, `handle`) cu default-uri = comportamentul istoric, deci datele vechi rămân valide fără migrare de dimensiuni. Moștenirea mânerului din proiect se rezolvă în stratul quote (`withResolvedHandle`) înainte de expand. Costurile atipice (profil J per front, GOLA per ml) intră în bucket-ul de feronerie printr-un parametru nou `extraHardware` la `computeCosts` (primesc manopera %). Sistemul METAL_BOX devine TANDEMBOX (normalizare la load + script idempotent).

**Tech Stack:** Next.js 15 (App Router, server actions), Prisma + SQLite, zod, vitest (doar suita existentă), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-07-14-montaj-feronerie-manere-design.md`

## Global Constraints

- **DIRECTIVĂ UTILIZATOR: fără teste noi.** Gate per task = `npx tsc --noEmit` curat + `npm test` verde (suita EXISTENTĂ; testele existente care ating comportamente schimbate SE ACTUALIZEAZĂ, nu se șterg) + `npm run build` la task-urile de UI. Golurile de acoperire se notează în raport, nu se rezolvă.
- Tot textul UI/mesaje/comentarii în română, stilul existent (diacritice, ghilimele „").
- Zero dependențe noi.
- Default montaj: **încadrat + încadrat** (= comportamentul actual; `mount` lipsă din JSON ⇒ încadrat).
- TANDEMBOX = sertar metalic complet: **zero piese la debitare**; PAL_BOX = cutie debitată + glisiere Tandem.
- Constante noi de construcție (default-uri): `tandemboxFrontClearanceMm: 30`, `golaFrontDeductMm: 35`, `frontExtensionDefaultMm: 30`. Se ELIMINĂ `metalBoxBottomDeductMm` și `metalBoxBackHeightMm`.
- Prețuri noi în AppSettings (default 0): `profilJPerFront` (lei/front), `golaPricePerMl` (lei/ml).
- Regulă UX: orice selecție care folosește valori din Setări afișează o notă cu valoarea aplicată.
- Directorul de lucru: `/Users/andrewradulescu/Documents/Projects/EpicMob/epic-mob-ofertare`. Branch de lucru nou: `montaj-feronerie-manere` din `main`.

---

### Task 1: Motor — montaj blat/fund în `expandCarcass`

**Files:**
- Modify: `lib/engine/types.ts` (tip nou + câmp pe CabinetInput)
- Modify: `lib/engine/carcass.ts:30-41`

**Interfaces:**
- Produces: `PanelMount = 'INCADRAT' | 'APLICAT'`; `CabinetInput.mount?: { top?: PanelMount; bottom?: PanelMount }`. Piese: montaj identic sus/jos ⇒ o linie „Blat corp / Fund corp" qty 2; diferit ⇒ două linii „Blat corp" / „Fund corp". Laterala se scurtează cu `t` per capăt aplicat.

- [ ] **Step 1: `lib/engine/types.ts`** — adaugă după `export type CabinetType ...`:

```ts
export type PanelMount = 'INCADRAT' | 'APLICAT';
```

și în `CabinetInput`, după `depthMm`:

```ts
  mount?: { top?: PanelMount; bottom?: PanelMount }; // lipsă = încadrat (comportamentul istoric)
```

- [ ] **Step 2: `lib/engine/carcass.ts`** — importă `PanelMount` în lista de tipuri și înlocuiește construcția `parts` (liniile cu `Laterală` + `Blat corp / Fund corp`) cu:

```ts
  const mountTop: PanelMount = input.mount?.top ?? 'INCADRAT';
  const mountBottom: PanelMount = input.mount?.bottom ?? 'INCADRAT';
  // capetele aplicate acoperă toată lățimea și scurtează lateralele cu grosimea plăcii
  const sideH = assertPositiveDim(
    H - (mountTop === 'APLICAT' ? t : 0) - (mountBottom === 'APLICAT' ? t : 0),
    'înălțime laterală', label,
  );
  const panelW = (m: PanelMount) => (m === 'APLICAT' ? W : innerW);

  const parts: Part[] = [
    {
      cabinetLabel: label, name: 'Laterală',
      lengthMm: sideH, widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    },
  ];
  if (mountTop === mountBottom) {
    parts.push({
      cabinetLabel: label, name: 'Blat corp / Fund corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 2,
      materialId: carcass.id, edges: { l1: fe },
    });
  } else {
    parts.push({
      cabinetLabel: label, name: 'Blat corp',
      lengthMm: panelW(mountTop), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
    });
    parts.push({
      cabinetLabel: label, name: 'Fund corp',
      lengthMm: panelW(mountBottom), widthMm: D, qty: 1,
      materialId: carcass.id, edges: { l1: fe },
    });
  }
```

Restul funcției (polițe, spate, warnings) rămâne neschimbat. `innerW` rămâne `W − 2t` (interiorul nu se schimbă — polițele stau între laterale în ambele montaje).

- [ ] **Step 3: Gate** — `npx vitest run lib/engine` (default-urile păstrează comportamentul; testele existente trec nemodificate) și `npx tsc --noEmit`.

- [ ] **Step 4: Commit** — `git add lib/engine && git commit -m "feat(engine): montaj aplicat/încadrat pentru blatul și fundul corpului"`

---

### Task 2: Motor — TANDEMBOX fără debitare, constante noi

**Files:**
- Modify: `lib/engine/types.ts` (`DrawerSystem`, `DrawerOptions.bottomMaterialId?`, `ConstructionConstants`)
- Modify: `lib/engine/constants.ts`, `lib/engine/drawers.ts`
- Test (actualizare existente): `lib/engine/__tests__/drawers.test.ts`, `lib/engine/__tests__/constants.test.ts` (dacă enumeră cheile), orice test cu `METAL_BOX`

**Interfaces:**
- Produces: `DrawerSystem = 'PAL_BOX' | 'TANDEMBOX'`; `DrawerOptions.bottomMaterialId?: string` (cerut doar la PAL_BOX); `expandDrawerBoxes` întoarce zero piese la TANDEMBOX; `ConstructionConstants` pierde `metalBoxBottomDeductMm`/`metalBoxBackHeightMm` și primește `tandemboxFrontClearanceMm`, `golaFrontDeductMm`, `frontExtensionDefaultMm`.

- [ ] **Step 1: `lib/engine/types.ts`:**

```ts
export type DrawerSystem = 'PAL_BOX' | 'TANDEMBOX';

export interface DrawerOptions {
  count: number;
  frontHeightsMm?: number[];       // dacă lipsește: împărțire egală
  system: DrawerSystem;
  bottomMaterialId?: string;       // fund sertar (doar PAL_BOX; TANDEMBOX e complet)
}
```

În `ConstructionConstants` șterge liniile `metalBoxBottomDeductMm` și `metalBoxBackHeightMm` și adaugă:

```ts
  tandemboxFrontClearanceMm: number; // rezervă: laterala Tandembox ≤ front − această valoare
  golaFrontDeductMm: number;         // GOLA: scurtarea fronturilor (profilul ocupă din înălțime)
  frontExtensionDefaultMm: number;   // „fără mâner": prelungirea implicită a frontului
```

- [ ] **Step 2: `lib/engine/constants.ts`** — în `DEFAULT_CONSTRUCTION` șterge `metalBoxBottomDeductMm: 87` și `metalBoxBackHeightMm: 70`, adaugă:

```ts
  tandemboxFrontClearanceMm: 30,
  golaFrontDeductMm: 35,
  frontExtensionDefaultMm: 30,
```

- [ ] **Step 3: `lib/engine/drawers.ts`** — în `expandDrawerBoxes`, imediat după guard-ul `if (!drawers || drawers.count <= 0)`:

```ts
  // TANDEMBOX = sertar metalic complet preasamblat — nimic la debitare, doar setul din feronerie
  if (drawers.system !== 'PAL_BOX') return { parts: [], warnings: [] };
  if (!drawers.bottomMaterialId) {
    throw new Error(`Corpul ${input.label}: cutia de sertar din PAL cere materialul fundului`);
  }
```

Apoi șterge întreaga ramură `else { ... }` (fostul METAL_BOX cu `Fund sertar` + `Spate sertar`) și condiționalul `if (drawers.system === 'PAL_BOX')` — corpul buclei `for (const frontH of heights)` rămâne doar cu logica PAL_BOX. Mută `const bottom = findMaterial(catalogs, drawers.bottomMaterialId);` DUPĂ noul guard.

- [ ] **Step 4: Actualizează testele existente** care folosesc `METAL_BOX` (grep `METAL_BOX` în `lib/`): în `drawers.test.ts` testele fostului METAL_BOX se rescriu să verifice că TANDEMBOX întoarce `parts: []`; fixture-urile din alte teste (`templates.test.ts`, `hardware.test.ts`, `fronts.test.ts`, `lib/quote/__tests__/cabinet-form.test.ts` — acesta se repară complet în Task 7, aici doar dacă pică compilarea) trec pe `system: 'TANDEMBOX'` sau `'PAL_BOX'` după intenția testului. Testele care verifică piesele cutiei folosesc `PAL_BOX`.

- [ ] **Step 5: Gate** — `npx vitest run lib/engine && npx tsc --noEmit 2>&1 | head -20`. Erorile tsc rămase trebuie să fie DOAR în fișiere din afara `lib/engine` care referă `METAL_BOX`/constantele șterse (le rezolvă Task-urile 5–8; listează-le în raport).

- [ ] **Step 6: Commit** — `git add lib/engine && git commit -m "feat(engine): TANDEMBOX fără piese la debitare; constante Tandembox/GOLA/prelungire"`

---

### Task 3: Motor — tipuri de mâner și efectele pe fronturi + previzualizare

**Files:**
- Modify: `lib/engine/types.ts` (`HandleType`, `HandleConfig`, `CabinetInput.handle`, `CabinetInput.hardwareSel`)
- Modify: `lib/engine/fronts.ts`
- Modify: `lib/iso/geometry.ts`

**Interfaces:**
- Produces:

```ts
export type HandleType = 'APLICAT' | 'BUTON' | 'INGROPAT' | 'PROFIL_J' | 'GOLA' | 'PUSH' | 'FARA';
export interface HandleConfig {
  type: HandleType;
  itemId?: string;           // produs MANER (aplicat/buton/îngropat) sau ACCESORIU (push)
  frontExtensionMm?: number; // doar FARA: prelungirea frontului (uși)
}
```

`CabinetInput.handle?: HandleConfig` (REZOLVAT — moștenirea din proiect se face în stratul quote; lipsă = APLICAT cu produsul implicit). `CabinetInput.hardwareSel?: { hingeId?: string; slideId?: string; tandemboxHeightMm?: number }`. Efecte dimensionale: GOLA scade `cc.golaFrontDeductMm` din înălțimea ușilor/panoului orb și din PRIMUL front de sertar (cel de sus); FARA cu `frontExtensionMm` prelungește DOAR ușile.

- [ ] **Step 1: `lib/engine/types.ts`** — adaugă tipurile de mai sus (după `PanelMount`), iar în `CabinetInput`, după `blindPanelWidthMm`:

```ts
  hardwareSel?: {
    hingeId?: string;           // uși: model balama; lipsă = default global
    slideId?: string;           // PAL_BOX: model glisiere Tandem; lipsă = cel mai ieftin la nominală
    tandemboxHeightMm?: number; // TANDEMBOX: înălțimea lateralei alese (M/K/C/D)
  };
  handle?: HandleConfig;        // rezolvat (excepția corpului sau moștenirea proiectului); lipsă = APLICAT + produs implicit
```

- [ ] **Step 2: `lib/engine/fronts.ts`** — în `expandFronts`, înlocuiește linia `const frontH = assertPositiveDim(...)` cu:

```ts
  let frontH = assertPositiveDim(input.heightMm - 2 * cc.outerGapMm, 'înălțime front', input.label);
  const handleType = input.handle?.type;
  if (handleType === 'GOLA') {
    frontH = assertPositiveDim(frontH - cc.golaFrontDeductMm, 'înălțime front (GOLA)', input.label);
  }
  if (handleType === 'FARA' && input.handle?.frontExtensionMm && input.doors > 0) {
    frontH += input.handle.frontExtensionMm; // front prelungit ca să ai de unde deschide
  }
```

iar în ramura sertarelor, imediat după `const heights = drawerFrontHeights(input, cc);`:

```ts
    // GOLA: profilul ocupă din frontul de sus al stivei de sertare
    const adjusted = handleType === 'GOLA' && heights.length > 0
      ? [assertPositiveDim(heights[0] - cc.golaFrontDeductMm, 'front sertar sus (GOLA)', input.label), ...heights.slice(1)]
      : heights;
```

și folosește `adjusted` în loc de `heights` în restul ramurii (gruparea pe înălțimi + `fronts.push`).

- [ ] **Step 3: `lib/iso/geometry.ts`** — oglindește aceleași ajustări ca desenul să corespundă pieselor:

După `const frontH = H - 2 * g;` adaugă:

```ts
  const handleType = input.handle?.type;
  const showHandle = handleType === undefined
    || handleType === 'APLICAT' || handleType === 'BUTON' || handleType === 'INGROPAT';
  const doorH = handleType === 'GOLA' ? frontH - cc.golaFrontDeductMm
    : handleType === 'FARA' && input.handle?.frontExtensionMm ? frontH + input.handle.frontExtensionMm
    : frontH;
```

- Panoul orb și ușile folosesc `doorH` în loc de `frontH` (`hMm: doorH`), iar ușile prelungite coboară sub corp: la FARA cu prelungire, `yMm: g - (doorH - frontH)` pentru uși (prelungirea e în jos).
- La sertare, aplică pe prima înălțime: după calculul `heights`, `if (handleType === 'GOLA' && heights.length > 0) heights = [heights[0] - cc.golaFrontDeductMm, ...heights.slice(1)];` (declară `heights` cu `let`).
- Toate `handle: {...}` de pe fronturi devin condiționate: `...(showHandle ? { handle: {...} } : {})`.

- [ ] **Step 4: Gate** — `npx vitest run lib/engine lib/iso 2>/dev/null; npx vitest run lib/engine` (nu există teste lib/iso) și `npx tsc --noEmit` (aceleași excepții cunoscute din Task 2).

- [ ] **Step 5: Commit** — `git add lib/engine lib/iso && git commit -m "feat(engine): tipuri de mâner cu efecte pe fronturi (GOLA, front prelungit) + preview"`

---

### Task 4: Motor — sugestii feronerie v2 (preferredId, Tandembox pe înălțime) + `extraHardware` în costuri

**Files:**
- Modify: `lib/engine/types.ts` (`HardwareSuggestion`, `HardwareItem.boxHeightMm`)
- Modify: `lib/engine/hardware.ts` (suggestHardware + resolveSuggestions)
- Modify: `lib/engine/costing.ts`, `lib/engine/index.ts` (propagare `extraHardware` + hardware la resolve)
- Test (actualizare existente): `lib/engine/__tests__/hardware.test.ts` (semnătura `resolveSuggestions`), `lib/engine/__tests__/integration.test.ts`, `lib/engine/__tests__/costing.test.ts` (doar dacă pică compilarea)

**Interfaces:**
- Consumes: `HandleConfig`, `hardwareSel` (Task 3), `tandemboxFrontClearanceMm` (Task 2).
- Produces:
  - `HardwareItem.boxHeightMm?: number` (prezent = set Tandembox).
  - `HardwareSuggestion` += `preferredId?: string; boxHeightMm?: number`.
  - `resolveSuggestions(suggestions, defaults, hardware: HardwareItem[])` — 3 parametri; rezolvare: `preferredId` → potrivire Tandembox (`boxHeightMm` egal + nominala cea mai apropiată) → default pe categorie (glisierele simple exclud item-ele cu `boxHeightMm`).
  - `computeCosts(args)` += `extraHardware?: FreeLine[]` — sumele intră în bucket-ul `hardware` (primesc manopera %).

- [ ] **Step 1: `lib/engine/types.ts`:** în `HardwareItem` adaugă `boxHeightMm?: number;` după `loadClassKg`; în `HardwareSuggestion` adaugă:

```ts
  preferredId?: string;  // produs ales explicit pe corp — are prioritate la rezolvare
  boxHeightMm?: number;  // set Tandembox: potrivire pe înălțimea lateralei
```

- [ ] **Step 2: `lib/engine/hardware.ts` — `suggestHardware`:**

Balamale (în ramura `doors.length > 0`), pe obiectul push-uit adaugă `preferredId: input.hardwareSel?.hingeId,`.

Înlocuiește ramura `if (drawerFronts.length > 0)` cu:

```ts
  if (drawerFronts.length > 0 && input.drawers) {
    const { nominalMm, warnings: sw } = pickSlideNominal(input.depthMm, cc);
    warnings.push(...sw.map((w) => ({ ...w, cabinetLabel: input.label })));
    if (input.drawers.system === 'TANDEMBOX') {
      const boxH = input.hardwareSel?.tandemboxHeightMm;
      const minFrontH = Math.min(...drawerFronts.map((f) => f.heightMm));
      if (boxH !== undefined && boxH > minFrontH - cc.tandemboxFrontClearanceMm) {
        warnings.push({
          code: 'TANDEMBOX_HEIGHT',
          message: `Laterala Tandembox de ${boxH}mm nu încape în frontul de ${Math.round(minFrontH)}mm (rezervă ${cc.tandemboxFrontClearanceMm}mm)`,
          cabinetLabel: input.label,
        });
      }
      suggestions.push({
        category: 'SERTAR',
        name: `Set Tandembox ${nominalMm}mm${boxH !== undefined ? ` H${boxH}` : ''}`,
        qty: drawerFronts.length,
        nominalLengthMm: nominalMm,
        boxHeightMm: boxH,
      });
    } else {
      suggestions.push({
        category: 'SERTAR',
        name: `Set glisiere Tandem ${nominalMm}mm`,
        qty: drawerFronts.length,
        nominalLengthMm: nominalMm,
        preferredId: input.hardwareSel?.slideId,
      });
    }
  }
```

Înlocuiește ramura `if (fronts.length > 0) { ... MANER ... }` cu logica pe tip de mâner:

```ts
  const handle = input.handle ?? { type: 'APLICAT' as const };
  const HANDLE_WITH_ITEM: HandleType[] = ['APLICAT', 'BUTON', 'INGROPAT'];
  if (fronts.length > 0 && HANDLE_WITH_ITEM.includes(handle.type)) {
    suggestions.push({ category: 'MANER', name: 'Mâner', qty: fronts.length, preferredId: handle.itemId });
  } else if (handle.type === 'PUSH' && doors.length > 0) {
    // la sertare TANDEMBOX push-ul e în setul TIP-ON ales; mecanismul separat e doar pentru uși
    suggestions.push({ category: 'ACCESORIU', name: 'Mecanism push (TIP-ON)', qty: doors.length, preferredId: handle.itemId });
  }
  // PROFIL_J, GOLA, FARA: fără produs per front — costul lor intră separat (stratul de calcul al proiectului)
```

(importă `HandleType` în lista de tipuri).

- [ ] **Step 3: `lib/engine/hardware.ts` — `resolveSuggestions`** devine:

```ts
export function resolveSuggestions(
  suggestions: HardwareSuggestion[],
  defaults: HardwareDefaults,
  hardware: HardwareItem[],
): { lines: HardwareLine[]; unresolved: HardwareSuggestion[] } {
  const byId = new Map<string, number>();
  const unresolved: HardwareSuggestion[] = [];

  for (const s of suggestions) {
    let id: string | null = null;
    if (s.preferredId) {
      id = s.preferredId;
    } else if (s.category === 'SERTAR' && s.boxHeightMm !== undefined) {
      // set Tandembox: aceeași înălțime de laterală + nominala cea mai apropiată
      const sets = hardware.filter(
        (h) => h.category === 'SERTAR' && h.boxHeightMm === s.boxHeightMm && h.nominalLengthMm != null,
      );
      if (sets.length > 0 && s.nominalLengthMm !== undefined) {
        const target = s.nominalLengthMm;
        id = sets.reduce((a, b) =>
          Math.abs(b.nominalLengthMm! - target) < Math.abs(a.nominalLengthMm! - target) ? b : a,
        ).id;
      }
    } else if (s.category === 'BALAMA') id = defaults.hingeId;
    else if (s.category === 'MANER') id = defaults.handleId;
    else if (s.category === 'PICIOR') id = defaults.legId;
    else if (s.category === 'SINA_SUSPENDARE') id = defaults.railId;
    else if (s.category === 'SERTAR' && s.nominalLengthMm !== undefined) {
      const nominals = Object.keys(defaults.slideIdsByNominal).map(Number);
      if (nominals.length > 0) {
        const target = s.nominalLengthMm;
        const closest = nominals.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
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

- [ ] **Step 4: `lib/engine/costing.ts`** — în args-ul `computeCosts` adaugă `extraHardware?: FreeLine[];` iar după bucla de hardware:

```ts
  // costuri de feronerie calculate în amonte (profil GOLA per ml, prelucrare profil J per front)
  for (const line of args.extraHardware ?? []) hardware += line.amount;
```

`lib/engine/index.ts` — `computeProject`: apelul `resolveSuggestions(suggestions, catalogs.hardwareDefaults)` devine `resolveSuggestions(suggestions, catalogs.hardwareDefaults, catalogs.hardware)`; `ProjectInput` += `extraHardware?: FreeLine[]` propagat în `computeCosts` (importă `FreeLine` dacă lipsește).

- [ ] **Step 5: Actualizează apelurile `resolveSuggestions` din afara motorului** ca să compileze: `lib/quote/compute.ts` (`resolveSuggestions(e.hardware, cabinetDefaults, catalogs.hardware)`), `lib/quote/estimate.ts` (`resolveSuggestions(expanded.hardware, defaults, catalogs.hardware)`), `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (`resolveSuggestions(expanded.hardware, defaults, hardwareItems.map((h) => toHardwareItemLike(h)))` — aici folosește direct lista Prisma mapată minim: `{ id, name, category: h.category as HardwareCategory, pricePerUnit: h.pricePerUnit, nominalLengthMm: h.nominalLengthMm ?? undefined, boxHeightMm: undefined }`; câmpul `boxHeightMm` devine real în Task 5, pune `(h as { boxHeightMm?: number | null }).boxHeightMm ?? undefined` ca să compileze în ambele stări). Actualizează și `buildHardwareDefaults` din `lib/catalog/convert.ts`: în bucla `slideIdsByNominal`, sari peste seturile Tandembox — condiția devine `if (h.category !== 'SERTAR' || h.nominalLengthMm == null || (h as { boxHeightMm?: number | null }).boxHeightMm != null) continue;` (cast temporar până la Task 5, unde `HardwareRow` primește câmpul real — atunci scoate cast-urile).

- [ ] **Step 6: Gate** — `npx vitest run` (actualizează testele existente care apelează `resolveSuggestions` cu 2 argumente — adaugă `[]` sau lista de test) + `npx tsc --noEmit` (excepțiile cunoscute: fișiere UI cu METAL_BOX, rezolvate în task-urile următoare; listează-le).

- [ ] **Step 7: Commit** — `git add lib app && git commit -m "feat(engine): selecție feronerie pe corp, seturi Tandembox pe înălțime, extraHardware în costuri"`

---

### Task 5: Prisma + cataloage — `boxHeightMm`, `handleType`/`handleItemId`, prețuri J/GOLA

**Files:**
- Modify: `prisma/schema.prisma`, `prisma/seed.ts`
- Create: migrare aditivă via `npx prisma migrate dev --name manere_feronerie` (dacă CLI-ul cere confirmare interactivă, scrie manual SQL-ul aditiv ca la migrarea `manopera_pct`)
- Modify: `lib/catalog/schemas.ts`, `lib/catalog/actions.ts`, `lib/catalog/convert.ts` (`HardwareRow`, `SettingsRow`), `app/cataloage/feronerie/page.tsx`, `app/setari/page.tsx`

**Interfaces:**
- Produces: coloane `HardwareItem.boxHeightMm Float?`, `Project.handleType String @default("APLICAT")`, `Project.handleItemId String?`, `AppSettings.profilJPerFront Float @default(0)`, `AppSettings.golaPricePerMl Float @default(0)`. `HardwareRow.boxHeightMm: number | null`; `SettingsRow.profilJPerFront?: number | null; golaPricePerMl?: number | null` (opționale — snapshot-urile vechi nu le au); `toHardwareItem` mapează `boxHeightMm`.

- [ ] **Step 1: `prisma/schema.prisma`:** în `HardwareItem` adaugă `boxHeightMm Float?` după `loadClassKg`; în `Project` adaugă `handleType String @default("APLICAT")` și `handleItemId String?` după `yieldFactor`; în `AppSettings` adaugă `profilJPerFront Float @default(0)` și `golaPricePerMl Float @default(0)` după `laborPct`.

- [ ] **Step 2: Migrarea.** `npx prisma migrate dev --name manere_feronerie`. Dacă CLI-ul refuză non-interactiv: creează manual `prisma/migrations/<timestamp>_manere_feronerie/migration.sql` cu:

```sql
ALTER TABLE "HardwareItem" ADD COLUMN "boxHeightMm" REAL;
ALTER TABLE "Project" ADD COLUMN "handleType" TEXT NOT NULL DEFAULT 'APLICAT';
ALTER TABLE "Project" ADD COLUMN "handleItemId" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "profilJPerFront" REAL NOT NULL DEFAULT 0;
ALTER TABLE "AppSettings" ADD COLUMN "golaPricePerMl" REAL NOT NULL DEFAULT 0;
```

apoi `npx prisma migrate dev`. Verifică cu `sqlite3 prisma/dev.db ".schema Project"` că valorile există.

- [ ] **Step 3: `prisma/seed.ts`** — în array-ul de feronerie existent (păstrează forma obiectelor de acolo) adaugă 4 seturi Tandembox:

```ts
    { id: 'tandembox-m-500', name: 'Tandembox antaro M (83mm) 500mm', category: 'SERTAR', pricePerUnit: 120, nominalLengthMm: 500, boxHeightMm: 83 },
    { id: 'tandembox-k-500', name: 'Tandembox antaro K (115mm) 500mm', category: 'SERTAR', pricePerUnit: 135, nominalLengthMm: 500, boxHeightMm: 115 },
    { id: 'tandembox-c-500', name: 'Tandembox antaro C (192mm) 500mm', category: 'SERTAR', pricePerUnit: 155, nominalLengthMm: 500, boxHeightMm: 192 },
    { id: 'tandembox-d-500', name: 'Tandembox antaro D (224mm) 500mm', category: 'SERTAR', pricePerUnit: 170, nominalLengthMm: 500, boxHeightMm: 224 },
```

și în obiectul `settings` adaugă `profilJPerFront: 25, golaPricePerMl: 90` (valori de pornire; utilizatorul le ajustează).

- [ ] **Step 4: Straturile de catalog:**
- `lib/catalog/schemas.ts`: `hardwareSchema` += `boxHeightMm: optPosNum,`; `settingsSchema` += `profilJPerFront: num.nonnegative(), golaPricePerMl: num.nonnegative(),`.
- `lib/catalog/actions.ts`: în `createHardware`/`updateHardware` adaugă `boxHeightMm: d.boxHeightMm ?? null,` lângă `nominalLengthMm`; în `updateSettings` adaugă `profilJPerFront: d.profilJPerFront, golaPricePerMl: d.golaPricePerMl,`.
- `lib/catalog/convert.ts`: `HardwareRow` += `boxHeightMm: number | null;`; `toHardwareItem` += `boxHeightMm: row.boxHeightMm ?? undefined,`; `SettingsRow` += `profilJPerFront?: number | null; golaPricePerMl?: number | null;`. Scoate cast-urile temporare `(h as { boxHeightMm?: ... })` puse în Task 4 (în `buildHardwareDefaults` și în pagina corpului).

- [ ] **Step 5: UI cataloage:**
- `app/cataloage/feronerie/page.tsx`: în `HardwareFields` schimbă grid-ul în `md:grid-cols-7` și adaugă `<NumberInput name="boxHeightMm" label="Laterală box (mm)" defaultValue={h?.boxHeightMm} required={false} />`; extinde tipul prop-ului `h` cu `boxHeightMm: number | null;`. Actualizează hint-ul paginii: „La sertare/glisiere completează lungimea nominală — aplicația alege automat setul după adâncimea corpului. La seturile Tandembox completează și înălțimea lateralei (83/115/192/224)."
- `app/setari/page.tsx`: în cardul „Ofertare și feronerie implicită" adaugă `<NumberInput name="profilJPerFront" label="Profil J (lei/front frezat)" defaultValue={settings.profilJPerFront} />` și `<NumberInput name="golaPricePerMl" label="Profil GOLA (lei/ml)" defaultValue={settings.golaPricePerMl} />`. În `CONSTRUCTION_LABELS` șterge `metalBoxBottomDeductMm`/`metalBoxBackHeightMm` și adaugă `tandemboxFrontClearanceMm: 'Rezervă laterală Tandembox (mm)'`, `golaFrontDeductMm: 'GOLA: scurtare fronturi (mm)'`, `frontExtensionDefaultMm: 'Prelungire front fără mâner (mm)'`.

- [ ] **Step 6: Gate** — `npx prisma migrate status` (up to date), `npm run db:seed`, `npx tsc --noEmit` (excepții doar UI cu METAL_BOX rămase), `npx vitest run`.

- [ ] **Step 7: Commit** — `git add prisma lib app && git commit -m "feat(db,catalog): boxHeightMm pe feronerie, mâner pe proiect, prețuri profil J/GOLA"`

---

### Task 6: Stratul quote — normalizare input, rezolvare mâner, costuri J/GOLA, script migrare

**Files:**
- Create: `lib/quote/handle.ts`
- Create: `lib/quote/normalize-input.ts`; Delete: `lib/quote/migrate-sertare.ts`, `lib/quote/__tests__/migrate-sertare.test.ts`, `scripts/migrate-sertare.ts`
- Create: `scripts/migrate-inputs.ts`; Modify: `package.json` (`db:migrate-sertare` → `db:migrate-inputs`)
- Modify: `lib/quote/compute.ts`, `lib/quote/estimate.ts`, `lib/quote/load.ts`, `lib/quote/actions.ts`, `lib/quote/snapshot.ts` (nimic — settings vine întreg din Prisma), `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (parse prin normalize)

**Interfaces:**
- Produces:

```ts
// lib/quote/handle.ts
export interface ProjectHandle { type: HandleType; itemId: string | null }
export const HANDLE_TYPE_OPTIONS: { value: HandleType; label: string }[]  // cele 7 etichete RO
export function withResolvedHandle(input: CabinetInput, project: ProjectHandle): CabinetInput
export function handleExtraCost(input: CabinetInput, prices: { profilJPerFront: number; golaPricePerMl: number }): FreeLine[]

// lib/quote/normalize-input.ts
export function normalizeCabinetInput(raw: unknown): CabinetInput  // SERTARE→BAZA, METAL_BOX→TANDEMBOX, altfel passthrough
```

`QuoteInput` += `projectHandle: ProjectHandle`; `estimateCabinetCost` opts += `projectHandle: ProjectHandle`; `toQuoteInput` primește și `handleType`/`handleItemId` de pe proiect.

- [ ] **Step 1: `lib/quote/handle.ts`:**

```ts
import type { CabinetInput, FreeLine, HandleType } from '@/lib/engine';

export interface ProjectHandle { type: HandleType; itemId: string | null }

export const HANDLE_TYPE_OPTIONS: { value: HandleType; label: string }[] = [
  { value: 'APLICAT', label: 'Mâner aplicat' },
  { value: 'BUTON', label: 'Buton' },
  { value: 'INGROPAT', label: 'Mâner îngropat' },
  { value: 'PROFIL_J', label: 'Profil J (freză)' },
  { value: 'GOLA', label: 'Sistem GOLA' },
  { value: 'PUSH', label: 'Push (TIP-ON)' },
  { value: 'FARA', label: 'Fără mâner (front prelungit)' },
];

/** Moștenirea: corpul fără excepție primește mânerul proiectului. */
export function withResolvedHandle(input: CabinetInput, project: ProjectHandle): CabinetInput {
  if (input.handle) return input;
  return { ...input, handle: { type: project.type, itemId: project.itemId ?? undefined } };
}

/** Costurile atipice de mâner — intră în bucket-ul de feronerie (primesc manopera %). */
export function handleExtraCost(
  input: CabinetInput,
  prices: { profilJPerFront: number; golaPricePerMl: number },
): FreeLine[] {
  const h = input.handle;
  if (!h) return [];
  const frontCount = (input.doors > 0 ? input.doors : 0) + (input.drawers?.count ?? 0);
  const lines: FreeLine[] = [];
  if (h.type === 'PROFIL_J' && frontCount > 0) {
    lines.push({ name: `Prelucrare profil J — ${input.label}`, amount: frontCount * prices.profilJPerFront });
  }
  if (h.type === 'GOLA') {
    lines.push({ name: `Profil GOLA — ${input.label}`, amount: (input.widthMm / 1000) * prices.golaPricePerMl });
  }
  return lines;
}
```

- [ ] **Step 2: `lib/quote/normalize-input.ts`:**

```ts
import type { CabinetInput } from '@/lib/engine';

// inputJson vechi poate conține tipul dispărut 'SERTARE' și sistemul redenumit 'METAL_BOX'
export function normalizeCabinetInput(raw: unknown): CabinetInput {
  const input = raw as CabinetInput & { type: CabinetInput['type'] | 'SERTARE' };
  const type = input.type === 'SERTARE' ? 'BAZA' : input.type;
  const drawers = input.drawers && (input.drawers.system as string) === 'METAL_BOX'
    ? { ...input.drawers, system: 'TANDEMBOX' as const }
    : input.drawers;
  if (type === input.type && drawers === input.drawers) return input as CabinetInput;
  return { ...(input as CabinetInput), type, drawers };
}
```

Șterge `lib/quote/migrate-sertare.ts` + testul lui (`lib/quote/__tests__/migrate-sertare.test.ts` — dacă există) + `scripts/migrate-sertare.ts`.

- [ ] **Step 3: `scripts/migrate-inputs.ts`** (același pattern ca fostul migrate-sertare):

```ts
import { PrismaClient } from '@prisma/client';
import { normalizeCabinetInput } from '../lib/quote/normalize-input';

const prisma = new PrismaClient();

async function main() {
  const cabinets = await prisma.cabinet.findMany();
  let migrated = 0;
  for (const cab of cabinets) {
    const raw = JSON.parse(cab.inputJson);
    const input = normalizeCabinetInput(raw);
    const next = JSON.stringify(input);
    if (next === cab.inputJson) continue;
    await prisma.cabinet.update({ where: { id: cab.id }, data: { inputJson: next } });
    migrated += 1;
  }
  console.log(`Migrate: ${migrated} corpuri normalizate (din ${cabinets.length} total).`);
}

main().finally(() => prisma.$disconnect());
```

`package.json`: înlocuiește `"db:migrate-sertare": "tsx scripts/migrate-sertare.ts"` cu `"db:migrate-inputs": "tsx scripts/migrate-inputs.ts"`. Rulează `npm run db:migrate-inputs` de două ori (a doua = 0).

- [ ] **Step 4: `lib/quote/compute.ts`:**
- `QuoteInput` += `projectHandle: ProjectHandle;` (import din `./handle`).
- În `computeQuote`, înainte de expand: `const inputs = q.cabinets.map((c) => withResolvedHandle(c.input, q.projectHandle));` și folosește `inputs[i]` peste tot unde era `c.input`/`q.cabinets.map((c) => c.input)` (expand, `computeCosts.cabinets`).
- Prețurile: `const handlePrices = { profilJPerFront: snap.settings.profilJPerFront ?? 0, golaPricePerMl: snap.settings.golaPricePerMl ?? 0 };`
- `const extraHardware = inputs.flatMap((input) => handleExtraCost(input, handlePrices));` transmis în `computeCosts({ ..., extraHardware })`.

- [ ] **Step 5: `lib/quote/estimate.ts`:** opts devine `{ laborPct: number; yieldFactor: number; legHeightMm: number | null; projectHandle: ProjectHandle }`; după `const cc = ...`: `const input = withResolvedHandle(cabinet.input, opts.projectHandle);` — folosește `input` în `expandCabinet` și în restul funcției; înainte de `const cost = ...`:

```ts
    const handlePrices = {
      profilJPerFront: snap.settings.profilJPerFront ?? 0,
      golaPricePerMl: snap.settings.golaPricePerMl ?? 0,
    };
    const extras = handleExtraCost(input, handlePrices).reduce((s, l) => s + l.amount, 0);
    const cost = boards + cutting + edging + hardware + extras;
```

- [ ] **Step 6: `lib/quote/load.ts` și `lib/quote/actions.ts`:**
- `load.ts`: `JSON.parse(c.inputJson)` → `normalizeCabinetInput(JSON.parse(c.inputJson))`; `toQuoteInput` param `project` += `handleType: string; handleItemId: string | null` și în return `projectHandle: { type: project.handleType as HandleType, itemId: project.handleItemId },`.
- `actions.ts`: `projectSettingsSchema` += `handleType: z.enum(['APLICAT', 'BUTON', 'INGROPAT', 'PROFIL_J', 'GOLA', 'PUSH', 'FARA']), handleItemId: optStr,` — obiectul `data` se spread-uiește deja; asigură `handleItemId: d.handleItemId ?? null` în data (spread-ul cu `undefined` NU șterge coloana — setează explicit). `duplicateProject`: copiază `handleType: project.handleType, handleItemId: project.handleItemId,`.
- `app/proiecte/[id]/corp/[cabinetId]/page.tsx`: `JSON.parse(cab.inputJson)` → `normalizeCabinetInput(JSON.parse(cab.inputJson))` (import).
- `scripts/smoke-quote.ts`: obiectul de `computeQuote` construit manual primește `projectHandle: { type: 'APLICAT', itemId: null },`.

- [ ] **Step 7: Gate** — `npx tsc --noEmit` (rămân DOAR erorile din `CabinetEditorForm.tsx`/pagini legate de props noi — le rezolvă Task 7–8; dacă `estimateCabinetCost`/`toQuoteInput` au call-site-uri care nu compilează în pagini, adaptează-le acum minim: transmite `projectHandle` din `project.handleType`/`project.handleItemId`), `npx vitest run` (actualizează `lib/quote/__tests__/*` la noile semnături — `projectHandle: { type: 'APLICAT', itemId: null }` în fixtures).

- [ ] **Step 8: Commit** — `git add lib scripts package.json app && git commit -m "feat(quote): mâner moștenit din proiect, costuri profil J/GOLA, normalizare METAL_BOX→TANDEMBOX"`

---

### Task 7: Formular — câmpuri montaj, feronerie, mâner în schema corpului

**Files:**
- Modify: `lib/quote/cabinet-form.ts`
- Test (actualizare existente): `lib/quote/__tests__/cabinet-form.test.ts`

**Interfaces:**
- Consumes: tipurile din Task 1–3.
- Produces: câmpuri noi în `cabinetFormSchema` (numele EXACTE, Task 8 depinde de ele): `mountTop`, `mountBottom`, `hingeId`, `slideId`, `tandemboxHeightMm`, `handleMode` (`'PROIECT' | 'CUSTOM'`), `handleType`, `handleItemId`, `frontExtensionMm`; `drawersSystem: 'PAL_BOX' | 'TANDEMBOX'` (default `TANDEMBOX`); fundul sertarului cerut DOAR la PAL_BOX.

- [ ] **Step 1: `lib/quote/cabinet-form.ts`** — în obiectul schemei:
- după `depthMm`: `mountTop: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'), mountBottom: z.enum(['INCADRAT', 'APLICAT']).default('INCADRAT'),`
- `drawersSystem: z.enum(['PAL_BOX', 'TANDEMBOX']).default('TANDEMBOX'),`
- după `drawerFrontHeightsMm`: `hingeId: optStr, slideId: optStr, tandemboxHeightMm: z.preprocess(emptyToUndefined, posNum.optional()), handleMode: z.enum(['PROIECT', 'CUSTOM']).default('PROIECT'), handleType: z.enum(['APLICAT', 'BUTON', 'INGROPAT', 'PROFIL_J', 'GOLA', 'PUSH', 'FARA']).default('APLICAT'), handleItemId: optStr, frontExtensionMm: z.preprocess(emptyToUndefined, posNum.optional()),`
- refine-ul fundului devine: `.refine((d) => d.frontType !== 'SERTARE' || d.drawersSystem !== 'PAL_BOX' || !!d.drawersBottomMaterialId, { message: 'Alege materialul pentru fundul sertarelor (cutie PAL)' })`

- [ ] **Step 2: `toCabinetInput`** — adaugă în obiectul returnat:

```ts
    mount: { top: d.mountTop, bottom: d.mountBottom },
```

în `drawers` (ramura SERTARE): `bottomMaterialId: d.drawersSystem === 'PAL_BOX' ? d.drawersBottomMaterialId : undefined,` (scoate `!`), iar după `blindPanelWidthMm`:

```ts
    hardwareSel: (() => {
      const sel = {
        hingeId: d.frontType === 'USI' ? d.hingeId : undefined,
        slideId: d.frontType === 'SERTARE' && d.drawersSystem === 'PAL_BOX' ? d.slideId : undefined,
        tandemboxHeightMm: d.frontType === 'SERTARE' && d.drawersSystem === 'TANDEMBOX' ? d.tandemboxHeightMm : undefined,
      };
      return sel.hingeId || sel.slideId || sel.tandemboxHeightMm !== undefined ? sel : undefined;
    })(),
    handle: d.handleMode === 'CUSTOM'
      ? {
          type: d.handleType,
          itemId: d.handleItemId,
          frontExtensionMm: d.handleType === 'FARA' ? d.frontExtensionMm : undefined,
        }
      : undefined,
```

- [ ] **Step 3: Actualizează `lib/quote/__tests__/cabinet-form.test.ts`** — obiectul `base` primește câmpurile noi (`mountTop: 'INCADRAT', mountBottom: 'INCADRAT', hingeId: '', slideId: '', tandemboxHeightMm: '', handleMode: 'PROIECT', handleType: 'APLICAT', handleItemId: '', frontExtensionMm: ''`) și `drawersSystem: 'TANDEMBOX'` unde era METAL_BOX; testul „sertare fără fund → eroare" adaugă `drawersSystem: 'PAL_BOX'` (la TANDEMBOX fundul nu se mai cere — asserția existentă pe TANDEMBOX fără fund devine `success === true` dacă testul rămâne relevant). Așteptările `toEqual` pe `drawers` se adaptează (`bottomMaterialId: undefined` la TANDEMBOX).

- [ ] **Step 4: Gate** — `npx vitest run lib/quote && npx tsc --noEmit` (excepții doar UI, Task 8).

- [ ] **Step 5: Commit** — `git add lib/quote && git commit -m "feat(form): montaj, selecție feronerie și mâner în schema corpului"`

---

### Task 8: Editor UI — montaj, feronerie pe fronturi, mâner, note UX

**Files:**
- Modify: `components/CabinetEditorForm.tsx`
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx` (`cabinetInputToFormValues` + props noi)

**Interfaces:**
- Consumes: câmpurile din Task 7; `HANDLE_TYPE_OPTIONS`, `ProjectHandle` din `lib/quote/handle.ts`; `cc.tandemboxFrontClearanceMm`, `cc.golaFrontDeductMm`, `cc.frontExtensionDefaultMm`; `estimateCabinetCost` cu `projectHandle` în opts.
- Produces: `CabinetEditorFormProps` += `projectHandle: { type: string; itemId: string | null; label: string }` și `hardwareSelOptions: { hinges: FieldOption[]; slides: FieldOption[]; tandemboxHeights: number[]; handleItems: FieldOption[]; pushItems: FieldOption[]; defaultHingeName: string | null }`.

- [ ] **Step 1: `cabinetInputToFormValues`** (pagina corpului) — adaugă în obiectul returnat:

```ts
    mountTop: input.mount?.top ?? 'INCADRAT',
    mountBottom: input.mount?.bottom ?? 'INCADRAT',
    hingeId: input.hardwareSel?.hingeId ?? '',
    slideId: input.hardwareSel?.slideId ?? '',
    tandemboxHeightMm: input.hardwareSel?.tandemboxHeightMm != null ? String(input.hardwareSel.tandemboxHeightMm) : '',
    handleMode: input.handle ? 'CUSTOM' : 'PROIECT',
    handleType: input.handle?.type ?? 'APLICAT',
    handleItemId: input.handle?.itemId ?? '',
    frontExtensionMm: input.handle?.frontExtensionMm != null ? String(input.handle.frontExtensionMm) : '',
```

și schimbă `drawersSystem: input.drawers?.system ?? 'METAL_BOX'` în `?? 'TANDEMBOX'`.

- [ ] **Step 2: Props noi din pagina corpului** — construiește și transmite:

```ts
  const hinges = hardwareItems.filter((h) => h.active && h.category === 'BALAMA');
  const slides = hardwareItems.filter((h) => h.active && h.category === 'SERTAR' && h.boxHeightMm == null && h.nominalLengthMm != null);
  const tandemboxHeights = [...new Set(
    hardwareItems.filter((h) => h.active && h.category === 'SERTAR' && h.boxHeightMm != null).map((h) => h.boxHeightMm as number),
  )].sort((a, b) => a - b);
  const handleItems = hardwareItems.filter((h) => h.active && h.category === 'MANER');
  const pushItems = hardwareItems.filter((h) => h.active && h.category === 'ACCESORIU');
  const defaultHinge = settings?.defaultHingeId ? hardwareItems.find((h) => h.id === settings.defaultHingeId) : null;
```

```tsx
  projectHandle={{
    type: project.handleType, itemId: project.handleItemId,
    label: HANDLE_TYPE_OPTIONS.find((o) => o.value === project.handleType)?.label ?? project.handleType,
  }}
  hardwareSelOptions={{
    hinges: hinges.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    slides: slides.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    tandemboxHeights,
    handleItems: handleItems.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    pushItems: pushItems.map((h) => ({ value: h.id, label: hardwareLabel(h) })),
    defaultHingeName: defaultHinge?.name ?? null,
  }}
```

și `estimateCabinetCost` NU se apelează în pagină (doar în component) — dar componentul îl apelează: acolo opts primește `projectHandle: { type: projectHandle.type as HandleType, itemId: projectHandle.itemId }`.

- [ ] **Step 3: `CabinetEditorForm.tsx` — montaj.** În `CardContent`-ul „Identificare și dimensiuni", după grid-ul de dimensiuni:

```tsx
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Blat corp (sus)" value={values.mountTop} onChange={(v) => set('mountTop', v)} options={MOUNT_OPTIONS} />
              <SelectField label="Fund corp (jos)" value={values.mountBottom} onChange={(v) => set('mountBottom', v)} options={MOUNT_OPTIONS} />
            </div>
```

cu, lângă celelalte constante:

```ts
const MOUNT_OPTIONS: FieldOption[] = [
  { value: 'INCADRAT', label: 'Încadrat (între laterale)' },
  { value: 'APLICAT', label: 'Aplicat (peste laterale)' },
];
const DRAWER_SYSTEM_OPTIONS: FieldOption[] = [
  { value: 'TANDEMBOX', label: 'Tandembox (sertar metalic complet)' },
  { value: 'PAL_BOX', label: 'Cutie PAL + glisiere Tandem' },
];
```

(înlocuiește `DRAWER_SYSTEM_OPTIONS` existent — dispare METAL_BOX.)

- [ ] **Step 4: `CabinetEditorForm.tsx` — feronerie în cardul Fronturi.**

În ramura `frontType === 'USI'`, după blocul cu numărul de uși:

```tsx
                <div className="grid grid-cols-2 gap-3">
                  <SelectField label="Model balamale" value={values.hingeId} onChange={(v) => set('hingeId', v)} options={hardwareSelOptions.hinges} allowEmpty />
                </div>
                <p className="text-xs text-muted-foreground">
                  {values.hingeId
                    ? 'Balamale alese pe corp; numărul rămâne calculat automat.'
                    : `Balamale: ${hardwareSelOptions.defaultHingeName ?? 'default global nesetat'} — default din Setări; numărul se calculează automat.`}
                </p>
```

În ramura `frontType === 'SERTARE'`: câmpul „Fund sertare" devine condiționat de `values.drawersSystem === 'PAL_BOX'`; adaugă sub grid:

```tsx
                {values.drawersSystem === 'PAL_BOX' && (
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Model glisiere" value={values.slideId} onChange={(v) => set('slideId', v)} options={hardwareSelOptions.slides} allowEmpty />
                  </div>
                )}
                {values.drawersSystem === 'TANDEMBOX' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1">
                        <Label>Înălțime laterală (mm)</Label>
                        <select className={selectCls} value={values.tandemboxHeightMm ?? ''} onChange={(e) => set('tandemboxHeightMm', e.target.value)}>
                          <option value="">— alege —</option>
                          {hardwareSelOptions.tandemboxHeights.map((h) => {
                            const fits = minDrawerFrontH === null || h <= minDrawerFrontH - cc.tandemboxFrontClearanceMm;
                            return (
                              <option key={h} value={h} disabled={!fits}>
                                {h}mm{fits ? '' : ` — nu încape (front min. ${fmtNum(minDrawerFrontH ?? 0, 0)}mm)`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sertar metalic complet — nu se debitează nimic. Adâncimea nominală se alege automat; rezervă front {fmtNum(cc.tandemboxFrontClearanceMm, 0)}mm (Setări).
                    </p>
                    {noTandemboxFits && (
                      <p className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-800">
                        ⚠ Nicio înălțime de laterală nu încape în fronturile configurate.
                      </p>
                    )}
                  </div>
                )}
```

cu, lângă calculele de sertare existente:

```ts
  const minDrawerFrontH = drawersCount > 0 && drawerHeights.length === drawersCount
    ? Math.min(...drawerHeights) : null;
  const noTandemboxFits = values.drawersSystem === 'TANDEMBOX' && minDrawerFrontH !== null
    && hardwareSelOptions.tandemboxHeights.length > 0
    && hardwareSelOptions.tandemboxHeights.every((h) => h > minDrawerFrontH - cc.tandemboxFrontClearanceMm);
```

- [ ] **Step 5: `CabinetEditorForm.tsx` — secțiunea Mâner** (în cardul Fronturi, după ramurile USI/SERTARE/FARA, vizibilă când `frontType !== 'FARA'` SAU există sertare — adică `frontType !== 'FARA'`):

```tsx
            {frontType !== 'FARA' && (
              <div className="space-y-2 border-t pt-3">
                <Label>Mâner</Label>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Tip"
                    value={values.handleMode === 'PROIECT' ? '' : values.handleType}
                    onChange={(v) => setValues((prev) => ({
                      ...prev,
                      handleMode: v === '' ? 'PROIECT' : 'CUSTOM',
                      ...(v !== '' ? { handleType: v } : {}),
                      ...(v === 'FARA' && !prev.frontExtensionMm
                        ? { frontExtensionMm: String(cc.frontExtensionDefaultMm) } : {}),
                    }))}
                    options={[{ value: '', label: `Ca proiectul (${projectHandle.label})` },
                      ...HANDLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
                  />
                  {values.handleMode === 'CUSTOM' && ['APLICAT', 'BUTON', 'INGROPAT'].includes(values.handleType) && (
                    <SelectField label="Produs" value={values.handleItemId} onChange={(v) => set('handleItemId', v)} options={hardwareSelOptions.handleItems} allowEmpty />
                  )}
                  {values.handleMode === 'CUSTOM' && values.handleType === 'PUSH' && (
                    <SelectField label="Mecanism (uși)" value={values.handleItemId} onChange={(v) => set('handleItemId', v)} options={hardwareSelOptions.pushItems} allowEmpty />
                  )}
                  {values.handleMode === 'CUSTOM' && values.handleType === 'FARA' && (
                    <NumField label="Prelungire front (mm)" value={values.frontExtensionMm} onChange={(v) => set('frontExtensionMm', v)} />
                  )}
                </div>
                {values.handleMode === 'CUSTOM' && values.handleType === 'GOLA' && (
                  <p className="text-xs text-muted-foreground">
                    GOLA: fronturile se scurtează cu {fmtNum(cc.golaFrontDeductMm, 0)}mm, profil {'≈'}{fmtNum(Number(values.widthMm) / 1000, 2)}ml — valori din Setări.
                  </p>
                )}
                {values.handleMode === 'CUSTOM' && values.handleType === 'FARA' && (
                  <p className="text-xs text-muted-foreground">
                    Front prelungit în jos (default {fmtNum(cc.frontExtensionDefaultMm, 0)}mm din Setări) — util la corpurile suspendate.
                  </p>
                )}
              </div>
            )}
```

Importă `HANDLE_TYPE_OPTIONS` din `@/lib/quote/handle`; adaugă `projectHandle` și `hardwareSelOptions` în `CabinetEditorFormProps` + destructurare; `estimateCabinetCost` opts += `projectHandle: { type: projectHandle.type as HandleType, itemId: projectHandle.itemId }` (import `HandleType` din `@/lib/engine`), și în deps-ul memo-ului `live` adaugă `projectHandle`.

**Live preview cu moștenire:** înainte de `expandCabinet` în memo-ul `live`, rezolvă mânerul ca la calcul: `const input = withResolvedHandle(toCabinetInput(parsed.data), { type: projectHandle.type as HandleType, itemId: projectHandle.itemId });` (import `withResolvedHandle`) — astfel „Ca proiectul (GOLA)" scurtează fronturile și în piesele live + desen.

- [ ] **Step 6: Gate** — `npx tsc --noEmit` ZERO erori repo-wide; `npm test` verde; `npm run build` OK.

- [ ] **Step 7: Commit** — `git add components app && git commit -m "feat(ui): montaj, selecție feronerie pe fronturi și mâner în editorul de corp"`

---

### Task 9: Pagina proiect — tipul de mâner al proiectului

**Files:**
- Modify: `app/proiecte/[id]/page.tsx` (cardul „Setările proiectului")

**Interfaces:**
- Consumes: `HANDLE_TYPE_OPTIONS` din `lib/quote/handle.ts`; `projectSettingsSchema` cu `handleType`/`handleItemId` (Task 6).

- [ ] **Step 1:** În `ActionForm`-ul din „Setările proiectului", după select-ul de stare:

```tsx
                <Select
                  name="handleType" label="Tip mâner (proiect)"
                  options={HANDLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  defaultValue={project.handleType}
                />
                <Select
                  name="handleItemId" label="Produs mâner implicit"
                  options={handleProducts.map((h) => ({ value: h.id, label: `${h.name} (${h.pricePerUnit} lei)` }))}
                  defaultValue={project.handleItemId}
                  allowEmpty
                />
```

cu datele încărcate în componenta de pagină (lângă celelalte query-uri): `const handleProducts = await prisma.hardwareItem.findMany({ where: { active: true, category: { in: ['MANER', 'ACCESORIU'] } }, orderBy: { name: 'asc' } });` și importul `HANDLE_TYPE_OPTIONS`. Sub form, nota UX: `<p className="text-xs text-muted-foreground">Corpurile fără excepție de mâner moștenesc tipul proiectului.</p>`

Verifică semnătura componentei `Select` din `components/forms.tsx` înainte (are `allowEmpty`? — dacă opțiunea goală se numește altfel, adaptează).

- [ ] **Step 2: Gate + commit** — `npx tsc --noEmit && npm run build`; `git add app && git commit -m "feat(ui): tip de mâner pe proiect cu moștenire pe corpuri"`

---

### Task 10: Verificare finală end-to-end

**Files:** niciunul nou.

- [ ] **Step 1:** `npm test && npx tsc --noEmit && npm run build && npx tsx scripts/smoke-quote.ts` — totul verde.

- [ ] **Step 2:** `npm run db:migrate-inputs` (idempotent, a doua rulare = 0).

- [ ] **Step 3: Verificare manuală (`npm run dev`, port liber):**
1. Corp existent: piese identice cu înainte (montaj default încadrat), preț neschimbat la corpuri cu uși.
2. Schimbă „Fund corp (jos)" pe Aplicat → „Piese generate" arată laterala scurtată cu 18mm și linia „Fund corp" la lățime completă.
3. Sertare TANDEMBOX: piesele de cutie dispar din listă; selectul de înălțime arată variantele care încap; alege una prea mare la fronturi mici → opțiune dezactivată/avertizare.
4. Sertare PAL_BOX: cutia apare la debitare + select glisiere + fund sertar cerut.
5. Uși: select balamale cu nota default-ului global.
6. Proiect: setează tip mâner GOLA → corpurile fără excepție au fronturile scurtate (piese + desen), rezumatul are linia „Profil GOLA — {corp}"; profil J → linia de prelucrare; corp cu excepție „Fără mâner" + prelungire → frontul mai lung în piese și desen.
7. Setări: noile câmpuri (Profil J lei/front, GOLA lei/ml, constante noi) apar și se salvează.

- [ ] **Step 4:** Actualizează memoria proiectului (`epic-mob-ofertare-app.md`) și ledger-ul cu stadiul.

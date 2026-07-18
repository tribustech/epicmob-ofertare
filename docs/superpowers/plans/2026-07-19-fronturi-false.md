# Fronturi false + lufturi 1-2-1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fronturi false verticale setabile în mm (stânga/dreapta) pe corpurile cu uși, formula globală de lufturi 1-2-1, panoul orb de COLȚ absorbit în fronturi false, bon de calcul (`calc`) pe toate fronturile.

**Architecture:** Motorul (`lib/engine`) primește `falseFronts` pe `CabinetInput` cu fallback legacy pentru `blindPanelWidthMm`; geometria fronturilor din `fronts.ts` trece pe modelul „felii nominale" (fals la ras la margine, −1mm spre vecin). Formularul expune două câmpuri noi doar la fronturi tip USI. Spec: `docs/superpowers/specs/2026-07-19-fronturi-false-design.md`.

**Tech Stack:** Next.js + TypeScript, Zod (formulare), Vitest (teste existente), Prisma (nu se schimbă schema DB — inputul corpului e JSON).

## Global Constraints

- Directiva „fără teste noi până la final": NU se scriu teste noi; testele existente care pică din cauza schimbării de comportament se ACTUALIZEAZĂ la noile valori. Gate: `npx tsc --noEmit` + `npm run build` + `npx vitest run` + smoke manual în app.
- Constante noi: `outerGapMm: 1`, `frontGapMm: 2` (era 2/3).
- Piesa de fals: nominal − `frontGapMm/2` spre vecin, la ras la marginea corpului (fără luft exterior pe partea cu fals).
- Falsul NU intră în `fronts[]` (`FrontInfo`) — zero balamale/mânere/Aventos.
- Chei piese: `fals:stanga` / `fals:dreapta`; cheia `panou-orb` dispare complet.
- Comentariile/etichetele noi în română, ca restul codebase-ului.
- Toate comenzile se rulează din `epic-mob-ofertare/`.

---

### Task 1: Constante 1-2-1 + actualizarea testelor de cote

**Files:**
- Modify: `lib/engine/constants.ts:7-8`
- Modify: `lib/engine/__tests__/constants.test.ts`
- Modify: `lib/engine/__tests__/fronts.test.ts` (doar valorile numerice)
- Modify: alte teste care pică pe cote (`lib/quote/__tests__/estimate.test.ts`, `lib/engine/__tests__/integration.test.ts`, `lib/engine/__tests__/drawers.test.ts` etc. — după rulare)

**Interfaces:**
- Consumes: `DEFAULT_CONSTRUCTION` din `lib/engine/constants.ts`.
- Produces: `outerGapMm === 1`, `frontGapMm === 2` — toate task-urile următoare presupun aceste valori.

- [ ] **Step 1: Schimbă constantele**

În `lib/engine/constants.ts`:

```ts
export const DEFAULT_CONSTRUCTION: ConstructionConstants = {
  frontGapMm: 2,
  outerGapMm: 1,
  // … restul neschimbat
```

- [ ] **Step 2: Actualizează constants.test.ts**

```ts
expect(DEFAULT_CONSTRUCTION.frontGapMm).toBe(2);
expect(DEFAULT_CONSTRUCTION.outerGapMm).toBe(1);
```

- [ ] **Step 3: Rulează testele și vezi ce pică**

Run: `npx vitest run`
Expected: FAIL în `fronts.test.ts` (și posibil `estimate.test.ts`, `integration.test.ts`, `costing.test.ts`, `compute.test.ts`) — cote calculate cu 2-3-2.

- [ ] **Step 4: Actualizează valorile numerice din testele picate**

Formulele noi (corp 600×720, o ușă): înălțime front `720 − 2·1 = 718` (era 716), lățime `600 − 2·1 = 598` (era 596). Două uși: `(598 − 1·2)/2 = 298` (era 296.5). Trei sertare: `(720 − 2·1 − 2·2)/3 = 238` (era ≈236.67). Panou orb COLȚ (încă pe geometria veche în acest task): ușă `600 − 2·1 − 100 = 498` (era 496). Actualizează și textele descriptive ale testelor („W−4 × H−4" → „W−2 × H−2" etc.). La testele de costuri/estimate, valorile derivate (m², foi, lei) se recalculează — verifică fiecare valoare nouă rulând testul și confirmând manual formula din comentariul testului (ex. aria ușii devine 0.598×0.718).

- [ ] **Step 5: Rulează tot și confirmă verde**

Run: `npx vitest run`
Expected: PASS (toate).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): lufturi 1-2-1 — outerGap 1mm, frontGap 2mm"
```

---

### Task 2: `falseFronts` în motor — geometrie, piese, legacy, 3D/izometrie

**Files:**
- Modify: `lib/engine/types.ts:117` (câmpul nou + legacy)
- Modify: `lib/engine/fronts.ts` (geometria)
- Modify: `lib/engine/costing.ts:49` (`FRONT_PART_NAMES`)
- Modify: `lib/engine/placement.ts:35-37,90-92` (plasare 3D)
- Modify: `lib/iso/geometry.ts:10,38-41,64-66` (izometrie)
- Modify: `components/CabinetIsoSvg.tsx:119-120` (randare)
- Modify: `lib/engine/__tests__/fronts.test.ts` (blocul „panou orb" → „fronturi false")

**Interfaces:**
- Consumes: constantele din Task 1.
- Produces: `CabinetInput.falseFronts?: { stangaMm?: number; dreaptaMm?: number }`; `resolveFalseFronts(input: CabinetInput, cc: ConstructionConstants): { stangaMm: number; dreaptaMm: number }` exportat din `lib/engine/fronts.ts`; chei de piesă `fals:stanga`/`fals:dreapta` cu nume `'Front fals'`; `IsoFrontRect.kind` folosește `'FALS'` în loc de `'PANOU_ORB'`. Task 4 se bazează pe `falseFronts` și pe fallback-ul legacy.

- [ ] **Step 1: Schimbă tipurile**

În `lib/engine/types.ts`, înlocuiește linia `blindPanelWidthMm?: number;      // doar COLT; implicit cc.blindPanelDefaultWidthMm` cu:

```ts
  /** fronturi false verticale (piese fixe, fără feronerie): la ras cu marginea corpului,
   *  −frontGapMm/2 spre frontul vecin. Setabile doar la corpuri cu uși. */
  falseFronts?: { stangaMm?: number; dreaptaMm?: number };
  /** LEGACY (pre-fronturi-false): panoul orb de COLȚ — citit doar ca fallback
   *  pentru inputJson-uri nemigrate; se mapează pe falseFronts.stangaMm. */
  blindPanelWidthMm?: number;
```

Actualizează și comentariul cheilor de piesă de la `types.ts:156`: `'panou-orb'` → `'fals:stanga' | 'fals:dreapta'`.

- [ ] **Step 2: Rescrie geometria în `fronts.ts`**

Adaugă exportul (după importuri):

```ts
/** Falsurile rezolvate (0 = lipsă). Corpurile vechi de COLȚ fără falseFronts cad pe
 *  blindPanelWidthMm (legacy) sau pe defaultul din setări — păstrează comportamentul
 *  panoului orb, inclusiv la COLȚ cu sertare. */
export function resolveFalseFronts(
  input: CabinetInput, cc: ConstructionConstants,
): { stangaMm: number; dreaptaMm: number } {
  if (input.falseFronts) {
    return { stangaMm: input.falseFronts.stangaMm ?? 0, dreaptaMm: input.falseFronts.dreaptaMm ?? 0 };
  }
  if (input.type === 'COLT') {
    return { stangaMm: input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm, dreaptaMm: 0 };
  }
  return { stangaMm: 0, dreaptaMm: 0 };
}
```

În `expandFronts`, șterge blocul `blindPanelWidthMm` (liniile 54-59 vechi) și calculul `usableW`, înlocuiește cu:

```ts
  const { stangaMm: fS, dreaptaMm: fD } = resolveFalseFronts(input, cc);
  if (fS < 0 || fD < 0) {
    throw new Error(`Corpul ${input.label}: frontul fals nu poate fi negativ`);
  }
  // fals = piesă fixă la ras cu marginea: pe partea lui nu se scade luftul exterior,
  // ci jumătate din luftul dintre fronturi (spre frontul vecin)
  const luftS = fS > 0 ? cc.frontGapMm / 2 : cc.outerGapMm;
  const luftD = fD > 0 ? cc.frontGapMm / 2 : cc.outerGapMm;
  const usableW = assertPositiveDim(
    input.widthMm - fS - fD - luftS - luftD, 'lățime utilă fronturi', input.label,
  );
```

Înlocuiește blocul `if (blindW > 0) { … pieces.push({ key: 'panou-orb', … }) }` cu (plasat după calculul `frontH`, înaintea blocului de sertare):

```ts
  for (const [side, nominal] of [['stanga', fS], ['dreapta', fD]] as const) {
    if (nominal <= 0) continue;
    pieces.push({
      key: `fals:${side}`, cabinetLabel: input.label, name: 'Front fals',
      label: side === 'stanga' ? 'Front fals stânga' : 'Front fals dreapta',
      lengthMm: frontH,
      widthMm: assertPositiveDim(nominal - cc.frontGapMm / 2, `front fals ${side}`, input.label),
      materialId: material.id,
      edges: perim, edgeAxis: FRONT_AXES,
    });
  }
```

Restul funcției (sertare, uși) rămâne — folosește deja `usableW`.

- [ ] **Step 3: `costing.ts` — numele de front**

```ts
export const FRONT_PART_NAMES = new Set(['Ușă', 'Front sertar', 'Front fals']);
```

- [ ] **Step 4: `placement.ts` — plasarea falsurilor**

Înlocuiește calculul `blindW`/`frontX0` (liniile 35-37) cu:

```ts
  const { stangaMm: fS, dreaptaMm: fD } = hasFronts
    ? resolveFalseFronts(input, cc) : { stangaMm: 0, dreaptaMm: 0 };
  // ușile/sertarele încep după piesa de fals (nominal − gap/2) + luftul spre ea
  const frontX0 = fS > 0 ? fS + cc.frontGapMm / 2 : g;
```

(importă `resolveFalseFronts` din `./fronts` — e deja importat `drawerFrontHeights` de acolo).

Înlocuiește cazul `panou-orb` cu:

```ts
      case pc.key === 'fals:stanga':
        pc.placement = { x: 0, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
        break;
      case pc.key === 'fals:dreapta':
        pc.placement = { x: W - pc.widthMm, y: frontTopY - pc.lengthMm, z: D, w: pc.widthMm, h: pc.lengthMm, d: FRONT_THICKNESS_MM };
        break;
```

- [ ] **Step 5: `lib/iso/geometry.ts` — izometria**

Schimbă tipul: `kind: 'USA' | 'SERTAR' | 'FALS';` (linia 10). Înlocuiește calculul `blindW`/`frontX0`/`usableW` (liniile 38-41) cu:

```ts
  const { stangaMm: fS, dreaptaMm: fD } = hasFronts
    ? resolveFalseFronts(input, cc) : { stangaMm: 0, dreaptaMm: 0 };
  const luftS = fS > 0 ? gap / 2 : g;
  const luftD = fD > 0 ? gap / 2 : g;
  const frontX0 = fS > 0 ? fS + gap / 2 : g;
  const usableW = W - fS - fD - luftS - luftD;
  const frontH = H - 2 * g;
```

(importă `resolveFalseFronts` din `@/lib/engine/fronts` sau din barrel-ul `@/lib/engine` dacă e re-exportat). Înlocuiește blocul `if (blindW > 0)` cu:

```ts
  if (fS > 0) fronts.push({ kind: 'FALS', xMm: 0, yMm: doorY, wMm: fS - gap / 2, hMm: doorH });
  if (fD > 0) fronts.push({ kind: 'FALS', xMm: W - (fD - gap / 2), yMm: doorY, wMm: fD - gap / 2, hMm: doorH });
```

- [ ] **Step 6: `components/CabinetIsoSvg.tsx` — randarea**

Liniile 119-120: `f.kind === 'PANOU_ORB'` → `f.kind === 'FALS'` (ambele apariții; hașura rămâne aceeași).

- [ ] **Step 7: Actualizează blocul de teste „panou orb" din `fronts.test.ts`**

Înlocuiește describe-ul `expandFronts — panou orb (COLT)` cu (aceleași cazuri, adaptate — actualizare, nu teste noi):

```ts
describe('expandFronts — fronturi false', () => {
  it('fals stânga: piesă nominal−1, la ras; ușa pe lățimea rămasă', () => {
    const input = bazaInput({ falseFronts: { stangaMm: 100 } });
    const { pieces, fronts } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    const fals = pieces.find((p) => p.key === 'fals:stanga')!;
    const door = pieces.find((p) => p.name === 'Ușă')!;
    expect(fals).toMatchObject({ name: 'Front fals', widthMm: 99, lengthMm: 718 });
    expect(door.widthMm).toBeCloseTo(498, 5); // 600 − 100 − 1 − 1
    expect(fronts).toHaveLength(1); // falsul NU e FrontInfo (fără balamale)
  });

  it('COLT legacy: blindPanelWidthMm devine fals stânga', () => {
    const input = bazaInput({ type: 'COLT', blindPanelWidthMm: 100 });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(pieces.find((p) => p.key === 'fals:stanga')!.widthMm).toBe(99);
  });

  it('COLT legacy fără valoare: defaultul din constante', () => {
    const input = bazaInput({ type: 'COLT' });
    const { pieces } = expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION);
    expect(pieces.find((p) => p.key === 'fals:stanga')!.widthMm).toBe(99);
  });

  it('fals ≥ lățimea corpului → eroare', () => {
    const input = bazaInput({ falseFronts: { stangaMm: 600 } });
    expect(() => expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/imposibilă/i);
  });

  it('fals negativ → eroare', () => {
    const input = bazaInput({ falseFronts: { stangaMm: -10 } });
    expect(() => expandFronts(input, TEST_CATALOGS, DEFAULT_CONSTRUCTION)).toThrow(/negativ/i);
  });
});
```

Notă: alte teste care construiesc COLT (ex. `cabinet-form.test.ts:141`) pică abia la Task 4 — nu le atinge aici decât dacă pică acum.

- [ ] **Step 8: Verifică**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. Dacă `tsc` acuză importul `resolveFalseFronts` în `lib/iso/geometry.ts`, verifică barrel-ul `lib/engine/index.ts` și exportă de acolo.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(engine): fronturi false stânga/dreapta — înlocuiesc panoul orb de COLȚ"
```

---

### Task 3: Bonul de calcul (`calc`) pe uși, fronturi de sertar și falsuri

**Files:**
- Modify: `lib/engine/carcass.ts:13` (exportă `dim`)
- Modify: `lib/engine/fronts.ts` (atașează `calc`)

**Interfaces:**
- Consumes: `dim(label, terms)` din `carcass.ts` (verifică la implementare că `resultMm` = suma termenilor — vezi corpul funcției la `carcass.ts:13`); `DimTerm`/`DimCalc` din `types.ts`.
- Produces: `PieceInstance.calc` pe toate piesele generate de `expandFronts` — `PiecePanel` (components/configurator) le afișează deja automat; `toParts` (`pieces.ts:108`) le copiază deja.

- [ ] **Step 1: Exportă `dim` din `carcass.ts`**

`function dim(` → `export function dim(` (linia 13) și importă-l în `fronts.ts` alături de `assertPositiveDim`.

- [ ] **Step 2: Construiește termenii de înălțime în `expandFronts`**

După calculul `frontH` (inclusiv GOLA/prelungire):

```ts
  const frontHTerms: DimTerm[] = [
    { label: 'înălțime corp', valueMm: input.heightMm },
    ...(legDeduct > 0 ? [{ label: 'picior', valueMm: -legDeduct }] : []),
    { label: 'luft sus + jos', valueMm: -2 * cc.outerGapMm },
    ...(handleType === 'GOLA' ? [{ label: 'profil GOLA', valueMm: -cc.golaFrontDeductMm }] : []),
    ...(handleType === 'FARA' && input.handle?.frontExtensionMm && input.doors > 0
      ? [{ label: 'prelungire front', valueMm: input.handle.frontExtensionMm }] : []),
  ];
  const frontHCalc = dim('Înălțime', frontHTerms);
```

(adaugă `DimTerm, DimCalc` la importul de tipuri). Termenii trebuie să însumeze exact `frontH` — dacă nu, e un bug de implementare.

- [ ] **Step 3: Termenii de lățime (comuni uși + sertare + fals)**

```ts
  const widthTermsBase: DimTerm[] = [
    { label: 'lățime corp', valueMm: input.widthMm },
    ...(fS > 0 ? [{ label: 'fals stânga', valueMm: -fS }] : []),
    ...(fD > 0 ? [{ label: 'fals dreapta', valueMm: -fD }] : []),
    { label: 'luft stânga', valueMm: -luftS },
    { label: 'luft dreapta', valueMm: -luftD },
  ];
```

- [ ] **Step 4: Atașează `calc` pe fiecare piesă**

Fals (în bucla din Task 2):

```ts
      calc: {
        length: frontHCalc,
        width: dim('Lățime', [
          { label: 'fals nominal', valueMm: nominal },
          { label: 'luft spre front', valueMm: -cc.frontGapMm / 2 },
        ]),
      },
```

Ușă (`doorW` există deja):

```ts
      calc: {
        length: frontHCalc,
        width: dim('Lățime', [
          ...widthTermsBase,
          ...(input.doors > 1 ? [
            { label: `${input.doors - 1}× luft între uși`, valueMm: -(input.doors - 1) * cc.frontGapMm },
            { label: `partea celorlalte ${input.doors - 1} uși`, valueMm: -doorW * (input.doors - 1) },
          ] : []),
        ]),
      },
```

Front sertar — lățimea la fel ca `widthTermsBase` (fără termenii de împărțire), înălțimea doar la împărțirea automată (la `frontHeightsMm` explicite omite `calc.length`):

```ts
      calc: {
        ...(input.drawers!.frontHeightsMm ? {} : {
          length: dim('Înălțime', [
            { label: 'înălțime corp', valueMm: input.heightMm },
            ...(legDeduct > 0 ? [{ label: 'picior', valueMm: -legDeduct }] : []),
            { label: 'luft sus + jos', valueMm: -2 * cc.outerGapMm },
            ...(n > 1 ? [
              { label: `${n - 1}× luft între fronturi`, valueMm: -(n - 1) * cc.frontGapMm },
              { label: `partea celorlalte ${n - 1} fronturi`, valueMm: -(heights[i]) * (n - 1) },
            ] : []),
            ...(handleType === 'GOLA' ? [{ label: 'profil GOLA', valueMm: -cc.golaFrontDeductMm }] : []),
          ]),
        }),
        width: dim('Lățime', widthTermsBase),
      },
```

unde `n = input.drawers!.count` și `heights[i]` e înălțimea NEajustată GOLA a rândului (termenii însumează `adjusted[i]`). Panoul-orb nu mai există; nu adăuga `calc` pe piesele din `carcass.ts` — le au deja.

- [ ] **Step 5: Verifică sumele și rulează**

Run: `npx vitest run lib/engine/__tests__/fronts.test.ts && npx tsc --noEmit`
Expected: PASS (testele existente folosesc `toMatchObject`, câmpul `calc` în plus nu le strică). Verifică manual în cod: pentru fiecare `dim(...)`, suma termenilor = dimensiunea piesei.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): bon de calcul pe uși, fronturi de sertar și falsuri"
```

---

### Task 4: Formular corp, pagina de corp, setări

**Files:**
- Modify: `lib/quote/cabinet-form.ts` (schema + `toCabinetInput`)
- Modify: `components/CabinetEditorForm.tsx` (câmpuri + prefill COLȚ + fieldMap)
- Modify: `app/proiecte/[id]/corp/[cabinetId]/page.tsx:59` (valori inițiale)
- Modify: `app/setari/page.tsx:26` (etichetă)
- Modify: `lib/quote/__tests__/cabinet-form.test.ts:141-145` (testul de COLT)

**Interfaces:**
- Consumes: `CabinetInput.falseFronts` + fallback legacy din Task 2; `cc.blindPanelDefaultWidthMm` (prop `cc` există deja în `CabinetEditorForm`).
- Produces: câmpurile de formular `falsStangaMm`, `falsDreaptaMm` (string, goale = lipsă); `toCabinetInput` NU mai emite `blindPanelWidthMm`.

- [ ] **Step 1: Schema Zod (`cabinet-form.ts`)**

Înlocuiește linia `blindPanelWidthMm: …` (linia 40) cu:

```ts
    falsStangaMm: z.preprocess(emptyToUndefined, posNum.optional()),
    falsDreaptaMm: z.preprocess(emptyToUndefined, posNum.optional()),
```

Adaugă refine (după cel de la `doors`):

```ts
  .refine((d) => d.frontType !== 'USI'
    || (d.falsStangaMm ?? 0) + (d.falsDreaptaMm ?? 0) < d.widthMm, {
    message: 'Fronturile false depășesc lățimea corpului',
    path: ['falsStangaMm'],
  })
```

- [ ] **Step 2: `toCabinetInput`**

Înlocuiește linia `blindPanelWidthMm: d.type === 'COLT' ? d.blindPanelWidthMm : undefined,` cu:

```ts
    falseFronts: d.frontType === 'USI' && (d.falsStangaMm !== undefined || d.falsDreaptaMm !== undefined)
      ? { stangaMm: d.falsStangaMm, dreaptaMm: d.falsDreaptaMm }
      : undefined,
```

Notă: la COLȚ cu frontType FARA/SERTARE nu emitem `falseFronts` — motorul aplică fallback-ul legacy (Task 2), deci comportamentul vechi se păstrează.

- [ ] **Step 3: Valorile inițiale ale formularului (`corp/[cabinetId]/page.tsx`)**

Înlocuiește linia `blindPanelWidthMm: …` cu (pagina are deja `cc` — îl pasează formularului):

```ts
    falsStangaMm: input.falseFronts?.stangaMm != null ? String(input.falseFronts.stangaMm)
      : input.type === 'COLT' && input.doors > 0
        ? String(input.blindPanelWidthMm ?? cc.blindPanelDefaultWidthMm)
        : '',
    falsDreaptaMm: input.falseFronts?.dreaptaMm != null ? String(input.falseFronts.dreaptaMm) : '',
```

(legacy COLȚ: valoarea veche — sau defaultul — apare în câmp și se salvează ca `falseFronts` la primul submit).

- [ ] **Step 4: `CabinetEditorForm.tsx`**

1. Șterge blocul `{isColt && (<NumField label="Panou orb (mm)" …/>)}` (liniile ~554-556).
2. În `fieldMap` (linia ~478): șterge `blindPanelWidthMm: 'dimensiuni',` și adaugă `falsStangaMm: 'fronturi', falsDreaptaMm: 'fronturi',`.
3. În secțiunea de fronturi, lângă `NumField label="Uși"` (linia ~645), adaugă:

```tsx
<NumField label="Fals stânga (mm)" value={values.falsStangaMm} onChange={(v) => set('falsStangaMm', v)} error={showError('falsStangaMm')} />
<NumField label="Fals dreapta (mm)" value={values.falsDreaptaMm} onChange={(v) => set('falsDreaptaMm', v)} error={showError('falsDreaptaMm')} />
```

4. Prefill la COLȚ nou: în handler-ul selectului de tip corp (unde se schimbă `type`), adaugă la patch:

```ts
...(v === 'COLT' && prev.frontType === 'USI' && !prev.falsStangaMm
  ? { falsStangaMm: String(cc.blindPanelDefaultWidthMm) } : {}),
```

5. Caută alte referințe rămase la `blindPanelWidthMm` în fișier (`grep -n blindPanel components/CabinetEditorForm.tsx`) și elimină-le.

- [ ] **Step 5: Eticheta din setări**

`app/setari/page.tsx:26`: `'Lățime implicită panou orb (mm)'` → `'Front fals implicit la colț (mm)'`.

- [ ] **Step 6: Actualizează testul din `cabinet-form.test.ts`**

Testul `blindPanelWidthMm se păstrează doar la COLT` devine:

```ts
  it('falseFronts se emit doar la fronturi cu uși', () => {
    const usi = toCabinetInput(cabinetFormSchema.parse({ ...base, falsStangaMm: '120' }));
    expect(usi.falseFronts).toEqual({ stangaMm: 120, dreaptaMm: undefined });
    const sertare = toCabinetInput(cabinetFormSchema.parse({
      ...base, frontType: 'SERTARE', drawersCount: '2', falsStangaMm: '120',
    }));
    expect(sertare.falseFronts).toBeUndefined();
  });
```

(adaptează `base` la fixture-ul existent din fișier — vezi cum e construit `base` acolo; dacă `base` nu are `frontType: 'USI'` + `doors`, adaugă-le în primul parse).

- [ ] **Step 7: Verifică**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(ui): fronturi false în formularul de corp — înlocuiesc câmpul de panou orb"
```

---

### Task 5: Verificare finală + actualizare TODOs

**Files:**
- Modify: `../TODOs.MD` (statusuri)

**Interfaces:**
- Consumes: tot ce e mai sus.
- Produces: branch verde, gata de review.

- [ ] **Step 1: Gate complet**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: toate PASS/build OK.

- [ ] **Step 2: Smoke manual în app**

Pornește `npm run dev` și verifică în browser:
1. Corp BAZĂ 900×720, 2 uși, fals stânga 100 → în configuratorul 3D: piesa „Front fals stânga" 99mm la ras pe stânga, uși de 398, bonul de calcul vizibil la click pe ușă (termeni: 900, −100, −1, −1, −2, −398).
2. Corp COLȚ existent (sau nou) → falsul apare precompletat 100, izometria arată hașura pe fals.
3. Corp cu 3 sertare → fronturi de (720−2−4)/3 = 238 cu bon de calcul.
4. Export CSV debitare → apare „Front fals" cu cant.

- [ ] **Step 3: Actualizează `../TODOs.MD`**

Marchează cu ✅ itemele: „Fronturi false setabile în mm…", „La 2 uși nu apare calculul (1-2-1)…". La „Uși: scăzut din laterale 18mm − 2mm luft" notează că partea de 1-2-1 e făcută (rămâne de clarificat regula de 18mm — e deja în discuție separată).

- [ ] **Step 4: Commit final**

```bash
git add -A && git commit -m "docs: actualizez TODOs după fronturi false + 1-2-1"
```

---

## Self-review (făcut la scriere)

- **Acoperire spec:** model de date (T2/T4), formulă 1-2-1 (T1), piese fals + fără feronerie (T2), `calc` (T3), placement/izometrie (T2), formular + prefill COLȚ + setări (T4), legacy `blindPanelWidthMm` (T2 engine + T3 form-load), efect teste (T1/T2/T4), gate fără teste noi (T5). Nicio secțiune fără task.
- **Tipuri consistente:** `falseFronts.stangaMm/dreaptaMm`, `resolveFalseFronts`, `fals:stanga`/`fals:dreapta`, `'FALS'` în izometrie — aceleași nume în toate task-urile.
- **Fără placeholder-e:** fiecare pas de cod are codul; pașii de actualizare-teste dau formulele de recalcul.

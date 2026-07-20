# Bucătărie: înălțime corpuri bază + corpuri „sub blat" — design

Data: 2026-07-20
Stadiu: design validat cu Andrew (brainstorming), gata de plan/implementare.

## Problema

Două puncte ❌ din `TODOs.MD`, secțiunea Ansambluri:

1. **Ansamblul are nevoie de dimensiuni de bucătărie** (înălțime corpuri bază, opțional
   înălțime corpuri suspendate) ca să nu retastezi aceleași dimensiuni la fiecare corp.
2. **Blatul setat de la început la bucătării**, ca să derivăm automat corpurile de jos
   (adâncime + înălțime) în loc să le calculezi manual de fiecare dată.

Constrângere de UX ridicată de Andrew: **doar bucătăriile** au împărțire bază / parte
superioară — dressing, living etc. nu. Deci trebuie o modalitate de a *alege* când
apar câmpurile astea, iar corpul nu trebuie să „moștenească" pe ascuns valori (fragil,
neintuitiv). Derivarea se face **explicit**, printr-un checkbox pe corp, cu rezultat
vizibil și editabil.

## Decizii cheie (din brainstorming)

- **Fără live inheritance ascuns.** Corpul nu trage tăcut dimensiuni din ansamblu.
  Derivarea e declanșată de un checkbox explicit („Sub blat"), valoarea derivată apare
  în câmp și rămâne **editabilă** (override manual câștigă, cu buton „↺ auto").
- **Tip ansamblu = dropdown explicit** (`kind`), NU dedus din numele liber (text fragil).
  Blatul NU e specific bucătăriei (comodă cu blat în living, mobilier de baie etc.), deci
  un checkbox „Bucătărie" ar fi prea îngust. Există **două capabilități distincte**:
  (1) blat + corpuri sub blat (bucătărie, baie, comodă living), (2) corpuri suspendate /
  parte superioară (practic doar bucătăria). Dropdown-ul le prinde pe amândouă:
  - `FARA_BLAT` (default) — dressing, dulap, rafturi → nicio derivare, ca azi.
  - `CU_BLAT` — comodă/baie/living → blat + corpuri sub blat, FĂRĂ suspendate.
  - `BUCATARIE` — blat + corpuri sub blat + corpuri suspendate.
- **Înălțime corpuri bază** (≈900, de la podea până la fața blatului), NU „înălțime blat"
  (redenumit la cererea lui Andrew — „înălțime blat" e ambiguu față de grosimea fizică).
- **Formula `blat − 25 − 20 − 5` e pentru ADÂNCIME**, nu înălțime (corectură Andrew):
  adâncime corp = `adâncime blat − 25 (luft sub blat) − 20 (ușă) − 5 (pfl)`
  (ex. `600 − 50 = 550`, adâncimea standard de corp de bază).
- **Înălțimea derivă separat**: `înălțime corpuri bază − înălțime picioare − grosime blat`
  (ex. `900 − 100 − 30 = 770`).
- **Grosimea blatului vine din materialul de blat ales** (`Material.thicknessMm`,
  `category = 'BLAT'`), NU constantă (decizie Andrew).
- **La L/U cu 2-3 blaturi: înălțimea corpurilor de jos e ACEEAȘI** (confirmat Andrew) —
  deci un singur set de parametri de blat per ansamblu ajunge; blaturile fizice rămân
  elemente BLAT separate pentru materiale/deviz.
- **Ambele derivă** (înălțime + adâncime) la „sub blat", ambele cu override manual.

## Model de date

### `Assembly` (câmpuri noi, toate opționale)

```prisma
kind           String   @default("FARA_BLAT") // FARA_BLAT | CU_BLAT | BUCATARIE
baseHeightMm   Float?                    // „Înălțime corpuri bază" (≈900)
blatMaterialId String?                   // material de blat → dă thicknessMm
blatDepthMm    Float?                    // adâncimea blatului (≈600)
upperHeightMm  Float?                    // doar BUCATARIE: prefill înălțime la SUSPENDAT
```

`kind`:
- `FARA_BLAT` (default) → ansamblul e ca azi, câmpurile de blat ascunse.
- `CU_BLAT` → arată material blat + adâncime blat + înălțime corpuri bază; corp BAZA capătă
  „Sub blat"; FĂRĂ înălțime corpuri suspendate.
- `BUCATARIE` → ca `CU_BLAT` + câmpul „Înălțime corpuri suspendate" (prefill la SUSPENDAT).

`legHeightMm` există deja pe `Assembly`. `blatMaterialId` referențiază un `Material` cu
`category = 'BLAT'`; grosimea derivării vine din `Material.thicknessMm`.

Materialul + adâncimea de aici **pot pre-completa** elementele BLAT când le adaugi
(2-3 la L/U) — nice-to-have, nu blocant; blaturile rămân elemente separate.

### `CabinetInput` (motor)

```ts
subBlat?: boolean;   // relevant doar la type === 'BAZA'
```

Persistat în `inputJson` ca restul inputului. Când e `true` și corpul nu are override
manual pe înălțime/adâncime, dimensiunile se derivă din parametrii de blat ai ansamblului.

## Formule + constante

- **Adâncime corp sub blat** = `blatDepthMm − subBlatFrontClearanceMm − subBlatDoorMm − subBlatPflMm`
  - default: 25 / 20 / 5 → configurabile în `AppSettings` (+ snapshot pe proiect), cu
    default-uri în `DEFAULT_CONSTRUCTION` pentru snapshot-uri vechi.
- **Înălțime carcasă corp sub blat** = `baseHeightMm − legHeightMm − blatThicknessMm`
  - `blatThicknessMm` = `Material.thicknessMm` al `blatMaterialId`.
- Override manual pe corp: dacă utilizatorul a atins câmpul (înălțime sau adâncime),
  valoarea lui câștigă; „↺ auto" revine la derivare.

## UI

### Ansamblu (formularul „Ansamblu nou" + editarea din `AssemblyCard`)

- `Select` **Tip ansamblu** → `kind` (FARA_BLAT / CU_BLAT / BUCATARIE), default FARA_BLAT.
- La `CU_BLAT` și `BUCATARIE` apar:
  - `NumberInput` **Înălțime corpuri bază (mm)** — default 900.
  - `Select` **Material blat** — materiale cu `category = 'BLAT'`.
  - `NumberInput` **Adâncime blat (mm)** — default 600.
- Doar la `BUCATARIE`, în plus:
  - `NumberInput` **Înălțime corpuri suspendate (mm)** — opțional.
- La `FARA_BLAT`, ansamblul arată exact ca azi (zero zgomot pentru dressing/living).
- Regula existentă preset-vs-liber (nume, picioare) rămâne neatinsă.

### Corp BAZA

- Checkbox **„Sub blat"** — vizibil DOAR la `type === 'BAZA'` ȘI doar dacă ansamblul are
  blat (`kind` ∈ {CU_BLAT, BUCATARIE}) cu parametri setați (altfel ascuns / dezactivat cu hint).
- Bifat → câmpurile Înălțime și Adâncime se completează cu valorile derivate, rămân
  editabile; badge/hint „calculat din blat" + buton „↺ auto" per câmp la override.
- La SUSPENDAT (`kind === BUCATARIE` cu `upperHeightMm`): înălțimea se **pre-completează**
  o dată (prefill simplu, editabil), fără checkbox, fără legătură live.

## Motor / data flow (partea sensibilă)

Motorul lucrează per-corp și nu cunoaște ansamblul. Ca la `withResolvedHandle`, adaug un
pas pur **`withResolvedSubBlat(input, assemblyBlat)`** care, când `subBlat === true` și
nu există override manual, injectează `depthMm` / `heightMm` derivate **înainte** de
`expandCabinet`. `assemblyBlat` = `{ baseHeightMm, legHeightMm, blatThicknessMm, blatDepthMm }`.

**Trebuie apelat pe TOATE drumurile spre expand** (identic cu bug-ul de mâner prins de 2
ori la review):
- `computeQuote` (`lib/quote/compute.ts`)
- estimarea live din editor (`lib/quote/estimate.ts`)
- preview-ul live client-side din pagina corpului
- pagina corpului / orice `expandCabinet`

Dacă un drum e uitat → preț/dimensiuni greșite silențios.

## Migrare

Toate câmpurile noi sunt nullable / au default:
- ansamblurile existente rămân `kind = 'FARA_BLAT'` → comportament identic;
- niciun repricing silențios pe snapshot-uri înghețate.

Migrare Prisma nouă, **după** migrarea WIP a lui Andrew (vezi mai jos). Fără script de
date necesar (default-urile acoperă).

## ⚠️ Concurență (risc real)

Andrew are **WIP necomis pe `Assembly`** pe `feat/configurator-piese` (roomWidth/Depth/
HeightMm, fixedElementsJson, roomWallsJson pentru „Așezare 3D") + migrări Prisma noi.

- **Reread `prisma/schema.prisma` + `app/proiecte/[id]/page.tsx` chiar înainte de edit** —
  nu suprascrie hunk-urile lui.
- Migrarea nouă intră **după** migrarea lui de „Așezare 3D".
- `roomHeightMm` există deja (de la el) — NU-l refolosi pentru înălțimea corpurilor bază;
  sunt concepte diferite (înălțime cameră vs. înălțime plan de lucru).

## Verificare (gate)

Conform directivei [[no-tests-until-flows-final]]: fără teste noi de UI. **Logica pură
primește test** — `withResolvedSubBlat` + formulele de adâncime/înălțime sunt pure, deci
merită test unit (motorul, nu UI-ul). Gate final = `tsc` + build (`rm -rf .next` întâi) +
smoke prin argent/CDP pe dev.

Smoke de acoperit:
1. Ansamblu `BUCATARIE` cu blat 600 / bază 900 / material blat 30mm.
2. Corp BAZA „sub blat" → adâncime 550, înălțime 770, ambele afișate.
3. Override manual pe înălțime → valoarea mea câștigă; „↺ auto" revine.
4. Schimbă tipul la `FARA_BLAT` → câmpurile dispar, corpurile rămân valide.
5. `CU_BLAT` (comodă/baie) → blat + sub blat, dar FĂRĂ înălțime corpuri suspendate.
6. L/U: 2-3 elemente BLAT + mai multe corpuri „sub blat" la aceeași înălțime.

## Non-goals / backlog

- Blaturi la înălțimi diferite în același ansamblu (bar mai înalt) — Andrew a confirmat că
  la L/U înălțimea corpurilor de jos e aceeași; se rezolvă prin override manual pe corpul
  excepție. Selector „sub care blat" = backlog dacă apare cazul real.
- Grosime blat per-piesă diferită între cele 2-3 blaturi — se presupune aceeași.
- Lungime totală ansamblu + înălțime camera → rămân la „Așezare 3D", nu se dublează aici.
- Pre-completarea elementelor BLAT din materialul/adâncimea ansamblului — nice-to-have.

## Taskuri (schiță SDD)

1. Schema + migrare `Assembly` (kind, baseHeightMm, blatMaterialId, blatDepthMm,
   upperHeightMm) — după WIP-ul lui Andrew; `CabinetInput.subBlat`.
2. Constante configurabile (`subBlatFrontClearanceMm/DoorMm/PflMm`) în `AppSettings` +
   `DEFAULT_CONSTRUCTION` + convert + snapshot.
3. `withResolvedSubBlat` pur + test unit (adâncime + înălțime + override).
4. Cablare pe toate drumurile spre `expandCabinet` (compute, estimate, preview, pagina corp).
5. UI ansamblu: dropdown „Tip ansamblu" (kind) + câmpuri condiționate + `createAssembly`/`updateAssembly`.
6. UI corp BAZA: checkbox „Sub blat" + câmpuri derivate editabile + „↺ auto" + prefill
   SUSPENDAT.
7. Smoke complet + verificare gate.

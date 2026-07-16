# Blat ca tip de corp (BLAT) — design

**Data:** 2026-07-16
**Status:** design validat (fără implementare)

## Context

Azi blatul se introduce manual ca **linie liberă** (`freeLinesJson`, „Linii libere (blat, transport…)") — o sumă fixă tastată de ofertant. Catalogul de materiale are deja `Material.category = PLACA | BLAT`, deci materialele de blat există (plăci de blat cu `sheetLengthMm × sheetWidthMm` și preț `PER_SHEET`/`PER_SQM`).

Vrem ca blatul să devină un **element configurabil**: alegi dimensiunile și materialul de blat, iar aplicația calculează câte plăci intră și costul (plăci + debitare), fără să mai tastezi manual suma.

## Decizii (validate cu utilizatorul)

1. **Blatul e un tip nou de corp** — `type: 'BLAT'` pe `Cabinet`. Trăiește într-un ansamblu, apare în tabelul de corpuri, se duplică/șterge la fel. NU e o entitate separată.
2. **Nu îmbinăm niciodată pe adâncime.** Plăcile de blat vin în lățimi fixe (600, 900). Dacă adâncimea configurată depășește lățimea plăcii → **warning + număr de plăci introdus manual**.
3. **Calcul bucăți = 1D pe lungime**: `pieces = ceil(lungime / lungimea_plăcii)`, dacă adâncimea încape pe lățimea plăcii.
4. **Cost plăci** respectă `pricingMode`: `PER_SHEET` → `pieces × pricePerSheet`; `PER_SQM` → `(lungime × adâncime) × pricePerSqm`.
5. **Cost debitare blat** = `pieces × blatCutPricePerPiece`. Valoare orientativă **35 lei/placă** (ref. MAM Bricolaj 34,99 lei/blat indiferent de tăieturi), stocată ca **setare globală editabilă** în `AppSettings`.
6. **Fără cant/manoperă specială** pe blat (out of scope). Costul intră în baza pe care se aplică `laborPct`, ca orice material.
7. **Editor minimal dedicat** — blatul NU trece prin `CabinetEditorForm` (carcasă/fronturi/feronerie) și NU prin `expandCabinet`. Ramură separată în UI și în motor.

## Model de date

**`CabinetType`** (în `lib/engine/types.ts`) primește `'BLAT'`:
```ts
export type CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT' | 'BLAT';
```

**`CabinetInput`** primește un bloc opțional dedicat (câmpurile de carcasă/front rămân „goale" pentru un blat):
```ts
blat?: { materialId: string; manualPieces?: number };
```
Maparea dimensiunilor pentru un blat:
- `widthMm` = **lungimea** (rularea pe perete)
- `depthMm` = **adâncimea** (față–spate)
- `heightMm` = grosimea (informativ; preluată din material la salvare)

`blat.manualPieces` se folosește **doar** când `depthMm > material.sheetWidthMm`.

**`AppSettings`** primește `blatCutPricePerPiece Float @default(35)` (lângă `golaPricePerMl`, `cutKerfMm`), editabilă în ecranul de setări catalog.

## Calcul (motor)

Funcție nouă `computeBlat(input, material, blatCutPricePerPiece)` în `lib/engine/blat.ts`:
```
fitsOnDepth = depthMm <= material.sheetWidthMm
pieces = fitsOnDepth
           ? ceil(widthMm / material.sheetLengthMm)   // ex. 5000/4100 → 2
           : (manualPieces ?? 0)

costPlaci = material.pricing.mode === 'PER_SHEET'
              ? pieces * pricePerSheet
              : (widthMm/1000 * depthMm/1000) * pricePerSqm
costDebitare = pieces * blatCutPricePerPiece

warning (dacă !fitsOnDepth): „adâncimea depășește lățimea plăcii — introdu manual numărul de plăci"
```

## Integrare în ofertă (`computeQuote` / `computeCosts`)

- În `computeQuote`, corpurile `type === 'BLAT'` se separă **înainte** de `expandCabinet` (nu trec prin motorul de carcasă).
- **Cost plăci** → categoria `boards` din breakdown (materialul blat *e* placă) → apare în „Plăci".
- **Cost debitare** → categoria `cuttingService` → apare în „Debitare".
- **Necesar** → un `BoardNeed` (m² total + nr. plăci) în lista „Necesar de materiale", refolosind afișajul existent.
- **Warning** → intră în `cabinetIssues` al blatului → badge de problemă pe rând + în lista „corpuri necesită atenție".
- **Manoperă**: costul blatului intră în baza pentru `laborPct`.
- **lei/ml**: blaturile **NU** contează la `leiPerMl` (rezervat corpurilor de bază) — excluse din acel calcul.
- **Completitudine** (`isCabinetInputComplete`): un BLAT e complet când `widthMm > 0`, `depthMm > 0`, `blat.materialId` ales și — dacă e peste lățimea plăcii — `manualPieces >= 1`. Nu cere carcasă/cant.

## UI

**Creare.** Al doilea buton „Adaugă blat" lângă „Adaugă corp" în fiecare ansamblu. `addCabinet` primește un parametru `type` (`'BAZA'` implicit vs `'BLAT'`).

**Editor (ramură nouă).** În pagina corpului, `if (input.type === 'BLAT')` → `<BlatEditorForm>` în locul lui `CabinetEditorForm`. Conține:
- Etichetă
- Lungime (mm), Adâncime (mm)
- Material blat (doar `category === 'BLAT'`)
- Card „Rezultat" live: nr. plăci, cost plăci + cost debitare, grosime din material
- Când adâncimea > lățimea plăcii: alertă chihlimbar + câmp „Număr plăci (manual)"

**Afișare pe rând** (tabelul de corpuri): `TYPE_LABELS.BLAT = 'Blat'`; coloana dimensiuni arată `lungime × adâncime`; „Stare" arată problema când adâncimea depășește placa fără nr. manual.

**Ofertă / plan debitare.** Blatul apare în „Necesar de materiale" (ca placă) și în „Debitare". În CSV-ul de debitare intră ca o piesă `lungime × adâncime × nr. plăci` pe materialul blatului — refolosind pipeline-ul de `Part`.

## Referințe preț debitare

- MAM Bricolaj — debitare blat bucătărie: 34,99 lei/blat, indiferent de nr. tăieturi.
- Brico Depôt — primele 2 tăieturi gratuite, apoi 3 lei/tăietură.
- Concluzie: tarif per bucată/placă → valoare orientativă 35 lei/placă, editabilă.

## Out of scope (azi)

- Cant/banduire pe muchiile blatului.
- Îmbinare pe adâncime (insule > lățimea plăcii) — se rezolvă prin nr. manual de plăci.
- Croire optimizată a resturilor de blat între mai multe blaturi.

# Fronturi (uși/sertare), previzualizare izometrică, manoperă procentuală

**Data:** 2026-07-14
**Context:** Sertarele sunt azi un tip de corp separat („Corp cu sertare"), nu o configurare a fronturilor — deci la un corp bază nu poți alege uși vs. sertare, iar înălțimile sertarelor se scriu într-un câmp text cu virgulă. Polițele nu au o bifă explicită (corpul de chiuvetă nu are polițe). Manopera e tarifată per tip de corp, dar atelierul lucrează în realitate cu „manoperă = 100–120% din materiale". În plus, utilizatorul vrea să vadă corpul desenat sub lista de piese.

## Decizii ale utilizatorului

- **Uși XOR sertare** — un corp are fie uși, fie sertare, fie niciun front (strict ori/ori; corpul mixt rămâne pentru mai târziu).
- **Tipul de corp SERTARE dispare** — rămân bază, suspendat, înalt, colț; orice corp poate primi sertare.
- **Per sertar se configurează doar înălțimea frontului** (default: împărțire egală); sistemul și fundul rămân pe corp.
- **Polițe cu bifă** — „Cu polițe" (implicit bifată, 1 poliță) + număr; debifat = 0 (corp chiuvetă).
- **Previzualizare: vedere izometrică SVG** statică, fără dependențe noi (nu Three.js).
- **Manoperă = procent din tot materialul, inclusiv feronerie**; adaosul (markup) dispare — procentul de manoperă include profitul.

## Secțiunea 1: Fronturi în editor și motor

### Motor (`lib/engine`)

- `CabinetType` devine `'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT'`.
- `CabinetInput` neschimbat structural: `doors`, `shelves`, `drawers?` există deja. Validarea din `templates.ts` devine: **uși XOR sertare** — eroare dacă `doors > 0` și `drawers.count > 0` simultan; sertarele sunt permise la orice tip; `drawers` prezent implică `shelves = 0`.
- `fronts.ts`: ramura de sertare nu mai testează `type === 'SERTARE'`, ci `input.drawers` cu `count > 0`.
- `hardware.ts`: `LEGGED_TYPES` devine `BAZA | INALT | COLT` (SERTARE dispare din enum; corpurile migrate devin BAZA și păstrează picioarele).
- `costing.ts`: `BASE_RUN_TYPES` devine `BAZA | COLT` (`leiPerMl` neschimbat în rest).

### UI (`CabinetEditorForm`)

- Radio „Tip corp" pierde opțiunea „Corp cu sertare".
- Cardul „Uși și polițe" devine **„Fronturi"**, vizibil la orice tip, cu radio: **Uși** (default) / **Sertare** / **Fără front**.
  - **Uși:** număr de uși, precompletat după convenția atelierului (lățime ≤ 600mm → 1, peste → 2; editabil, se recalculează doar când utilizatorul nu l-a modificat manual). Sub el, bifa „Cu polițe" (implicit bifată, 1) + numărul de polițe când e bifată.
  - **Sertare:** numărul de sertare + câte un rând per sertar („Sertar 1 (sus)", „Sertar 2"…) cu înălțimea frontului în mm. La schimbarea numărului, rândurile se regenerează cu împărțire egală; modificarea unei înălțimi nu le rescrie pe celelalte. Avertizare vizibilă când suma înălțimilor + rosturile nu se încadrează în înălțimea corpului. Sistemul (Blum/cutie PAL) și fundul sertarului rămân câmpuri unice pe corp. Fără polițe.
  - **Fără front:** `frontMaterialId` devine irelevant pentru piese; polițele rămân disponibile (etajeră).
- Câmpul text „Înălțimi fronturi sertar (mm, cu virgulă)" dispare, înlocuit de rândurile per sertar.

### Migrare date

Script peste `Cabinet.inputJson` (SQLite, tabelul `Cabinet`): corpurile cu `type: 'SERTARE'` devin `type: 'BAZA'` cu `drawers` păstrat neschimbat. Snapshot-urile proiectelor (`snapshotJson`) nu se rescriu — istoricul de preț rămâne cum a fost emis.

## Secțiunea 2: Previzualizare izometrică (`CabinetIsoSvg`)

Component nou client-side, SVG pur (același stil ca `CuttingLayoutSvg`), într-un card „Previzualizare" imediat sub „Piese generate". Se regenerează live din `CabinetInput` + constantele de construcție (aceleași date ca lista de piese).

- Proiecție izometrică fixă (fără rotire), corpul asamblat.
- Carcasa: laterale, blat/fund, spate; polițele desenate la poziții egal distribuite, vizibile prin fronturi semitransparente.
- Ușile: fronturi cu rostul real (`frontGapMm`) între ele și un punct de mâner.
- Sertarele: fronturi suprapuse la înălțimile configurate, cu rosturile reale.
- Panoul orb: hașurat, la corpul de colț.
- Cote discrete L×H×A pe margini.
- Fiind SVG static, intră și în print-ul ofertei (pagina de ofertă îl poate afișa per corp — inclus în scope doar dacă nu complică print-ul; minim: apare în editor).

Geometria (funcția care transformă `CabinetInput` în primitive desenabile) se scrie ca funcție pură, testabilă separat de React.

## Secțiunea 3: Manoperă procentuală

### Model nou de preț

```
bazaMateriale = plăci + canturi + serviciu debitare + feronerie
prețVânzare   = bazaMateriale × (1 + manoperă% / 100) + liniiLibere
```

- Liniile libere (transport, montaj…) se adună la final, **fără** procent pe ele.
- `manoperă%` e câmp pe proiect (înlocuiește `markupPct`), default 120, precompletat dintr-un default global în Setări.
- `leiPerMl` se calculează din noul preț de vânzare, logică neschimbată.

### Ce dispare

- Catalogul „Manoperă" (`LaborRate`, pagina `cataloage/manopera`, `laborPerType` din `CostCatalogs`).
- Adaosul: `markupPct` de pe proiect și din Setări (înlocuit de manoperă%).
- `breakdown.labor` ca sumă fixă — breakdown-ul afișează în schimb manopera calculată procentual.

### Migrare

- `Project.markupPct` → valoarea inițială a noii coloane `laborPct` (punct de plecare; utilizatorul ajustează).
- `AppSettings.markupPct` → default global `laborPct`.
- Snapshot-urile existente nu se recalculează.
- Estimarea live per corp (`estimateCabinetCost`) folosește aceeași formulă.

## Secțiunea 4: Testare

Fără teste UI (directiva existentă). Logica pură se testează în `lib/engine/__tests__/`:

- validarea uși XOR sertare (eroare la ambele; sertare permise pe orice tip);
- înălțimi per sertar: egale by default, custom validate (sumă + rosturi vs. înălțime corp → avertizare);
- costing: formulă nouă (bază × (1+%) + linii libere), fără `laborPerType`;
- geometria izometrică: funcția pură corp → primitive (număr fronturi, poziții polițe, panou orb);
- migrare: SERTARE → BAZA + drawers păstrat (test pe funcția de transformare).

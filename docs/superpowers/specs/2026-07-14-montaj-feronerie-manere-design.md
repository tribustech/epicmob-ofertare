# Montaj blat/fund, feronerie pe fronturi, mânere

**Data:** 2026-07-14
**Context:** Trei cerințe noi după livrarea fronturilor v2: (1) montajul blatului/fundului corpului (aplicat vs încadrat) schimbă dimensiunile pieselor — azi motorul face totul încadrat, fără opțiune; (2) feroneria trebuie aleasă pe tip de front direct în editor — balamale la uși, glisiere la sertare — iar sertarele metalice Tandembox sunt sertare complete preasamblate (alt preț, nimic la debitare), spre deosebire de glisierele Tandem cu cutie din PAL (care se debitează); (3) tipurile de mânere de pe epicmob.ro (aplicat, profil J, GOLA, buton, îngropat, push) plus „fără mâner" cu front prelungit, fiecare cu model de cost diferit.

## Decizii ale utilizatorului

- **Montaj separat sus și jos** — „Blat corp" și „Fund corp", fiecare aplicat sau încadrat; default: **încadrat + încadrat** (comportamentul actual; migrarea nu schimbă prețuri).
- **Tandem vs Tandembox:** Tandem = glisiere ascunse pentru sertar din PAL (cutia se debitează, ca acum); Tandembox = sertar metalic complet preasamblat — **zero piese la debitare**, doar prețul setului.
- **Selecție feronerie pe corp, cu default global** — select-uri în cardul Fronturi; override-ul manual de feronerie rămâne pentru cazuri speciale.
- **Set Tandembox:** adâncimea nominală se alege automat din adâncimea corpului; înălțimea lateralei (M/K/C/D) o alege utilizatorul, dar select-ul arată doar variantele care încap în fronturile configurate + avertizare când nimic nu încape.
- **Mâner pe proiect, cu excepții pe corp**; include și „fără mâner" (front prelungit, mai ales la suspendate).
- **Profil J per front, GOLA per ml**; GOLA **scurtează fronturile** cu o valoare din Setări (debitarea iese fidelă).
- **Front prelungit: câmp per corp**, default din Setări.
- **Regulă UX:** oriunde o selecție folosește valori din Setări, cardul afișează o notă cu valoarea aplicată.
- Directiva „fără teste noi" rămâne în vigoare: gate = tsc + build + smoke/verificare manuală.

## Secțiunea A: Montaj blat/fund

### Model

`CabinetInput` primește:

```ts
mount: { top: 'INCADRAT' | 'APLICAT'; bottom: 'INCADRAT' | 'APLICAT' }
```

Corpurile existente (fără câmp în JSON) se citesc ca încadrat + încadrat — funcția de migrare/normalizare completează default-ul la load, fără script de DB (nicio schimbare de dimensiuni sau preț).

### Motor (`lib/engine/carcass.ts`)

Cu `t` = grosimea materialului de carcasă:

- **Laterală:** înălțime = `H − (top aplicat ? t : 0) − (bottom aplicat ? t : 0)`; restul neschimbat.
- **Blat corp:** lățime piesă = `W` dacă aplicat, `W − 2t` dacă încadrat.
- **Fund corp:** la fel, după `mount.bottom`.
- Când blatul și fundul au montaj diferit, linia combinată „Blat corp / Fund corp" se desparte în două piese („Blat corp", „Fund corp") cu dimensiunile lor; când au același montaj rămâne o singură linie cu qty 2.
- Polițele, spatele (falț/aplicat) și avertizările rămân neschimbate.

### UI

Două select-uri „Blat corp" / „Fund corp" (Aplicat / Încadrat) în cardul „Identificare și dimensiuni", sub dimensiuni. Previzualizarea izometrică nu se schimbă (gabaritul exterior e identic).

## Secțiunea B: Feronerie pe fronturi

### Model

- `DrawerSystem` devine `'PAL_BOX' | 'TANDEMBOX'` (METAL_BOX dispare; datele existente se migrează METAL_BOX → TANDEMBOX).
- `CabinetInput` primește selecțiile explicite (toate opționale — lipsă = default global din Setări):

```ts
hardwareSel?: {
  hingeId?: string;        // uși: model balama (categoria BALAMA)
  slideId?: string;        // PAL_BOX: model glisiere Tandem (categoria SERTAR fără boxHeightMm)
  tandemboxHeightMm?: number; // TANDEMBOX: înălțimea lateralei alese (M/K/C/D)
}
```

- `HardwareItem` primește câmp opțional `boxHeightMm?: number` — prezent = set Tandembox (laterala M≈83 / K≈115 / C≈192 / D≈224), absent = glisieră simplă/Tandem. Coloană nouă nullable în Prisma + câmp în formularul de catalog feronerie.

### Motor

- **`expandDrawerBoxes`:** ramura TANDEMBOX **nu mai emite nicio piesă** (dispar „Fund sertar" + „Spate sertar" actuale); ramura PAL_BOX neschimbată. Corpurile migrate de la METAL_BOX își corectează prețul în consecință (asumat, e modelarea corectă).
- **`suggestHardware`:**
  - Uși: folosește `hardwareSel.hingeId` dacă există, altfel default-ul global; numărul de balamale rămâne calculat (înălțime/greutate, `hinges.ts`).
  - PAL_BOX: set glisiere per sertar pe adâncimea nominală (ca acum), modelul din `hardwareSel.slideId` sau cel mai ieftin la nominală (ca acum).
  - TANDEMBOX: per sertar, un set din catalog cu `boxHeightMm = tandemboxHeightMm` și nominală ≤ adâncimea utilă (cea mai mare care încape, ca la glisiere). Fără selecție sau fără produs potrivit → sugestie nerezolvată (mecanismul existent `unresolved`).
- **Validare/avertizare Tandembox:** laterala aleasă trebuie să încapă în fiecare front de sertar: `boxHeightMm ≤ înălțimea frontului − rezervă` (`tandemboxFrontClearanceMm` în constante de construcție, default 30mm). Nu încape → warning per corp (nu eroare).

### UI (cardul „Fronturi")

- **Uși:** select „Model balamale" (produse BALAMA active) cu opțiunea „Default global (nume produs)" ca primă intrare.
- **Sertare:** select „Sistem" cu etichete noi: „Cutie PAL + glisiere Tandem" / „Tandembox (sertar metalic complet)".
  - PAL_BOX → select „Model glisiere" (SERTAR fără `boxHeightMm`), cu „Default (cel mai ieftin la nominală)" ca primă intrare.
  - TANDEMBOX → select „Înălțime laterală" cu doar variantele care încap în toate fronturile de sertar configurate (ex. M/K la fronturi de 150mm); dacă unele nu încap, apar dezactivate cu motivul; dacă niciuna nu încape → avertizare. Fundul sertarului nu se mai cere la TANDEMBOX (câmpul „Fund sertare" apare doar la PAL_BOX).
- Nota UX din Setări: sub select-uri apare valoarea efectivă („Balamale: Blum ClipTop — default global", „Adâncime nominală aleasă: 500mm").

## Secțiunea C: Mânere

### Model

Tipuri: `'APLICAT' | 'BUTON' | 'INGROPAT' | 'PROFIL_J' | 'GOLA' | 'PUSH' | 'FARA'`.

- `Project.handleType` (coloană nouă, default `'APLICAT'`) + `Project.handleItemId` opțional (produsul MANER/ACCESORIU default pe proiect).
- `CabinetInput.handle?: { type?: HandleType; itemId?: string; frontExtensionMm?: number }` — excepție per corp; toate opționale, lipsă = moștenire din proiect.
- Setări noi (`AppSettings` / constante de construcție):
  - `profilJPerFront` (lei/front frezat)
  - `golaPricePerMl` (lei/ml profil)
  - `golaFrontDeductMm` (scurtarea fronturilor, ex. 35)
  - `frontExtensionDefaultMm` (prelungirea la „fără mâner", ex. 30)

### Cost și piese

| Tip | Cost | Efect pe piese |
|---|---|---|
| APLICAT / BUTON / INGROPAT | produs feronerie per front (itemId ales sau default proiect) | — |
| PROFIL_J | `profilJPerFront × nr. fronturi` — intră în breakdown la feronerie (linie „Prelucrare profil J") | — |
| GOLA | `golaPricePerMl × Σ lățimi corpuri cu GOLA / 1000` — linie la nivel de proiect | fronturile corpului se scurtează cu `golaFrontDeductMm` |
| PUSH | mecanism TIP-ON per front (produs ACCESORIU ales/default); la TANDEMBOX se aleg direct seturi TIP-ON din catalog (sunt alte produse SERTAR) | — |
| FARA | zero | front prelungit cu `handle.frontExtensionMm` (default din Setări) — se adaugă la înălțimea frontului (în jos la suspendate) |

Sugestia actuală „Mâner × nr. fronturi" se înlocuiește cu logica pe tip; hota/corpurile fără fronturi nu primesc nimic (ca acum).

### UI

- **Pagina proiect:** select „Tip mâner" + select produs (când tipul cere produs), cu nota UX.
- **Editor corp:** în cardul „Fronturi", secțiune „Mâner": „Ca proiectul (tip)" ca default + posibilitatea de excepție (tip + produs + prelungire front la FARA). Nota UX arată valorile din Setări folosite (GOLA −35mm, prelungire +30mm etc.).
- **Previzualizare izometrică:** punctul de mâner dispare la PROFIL_J/GOLA/PUSH/FARA; frontul prelungit/scurtat se vede în desen.

## Migrare date

O funcție de normalizare la load (`normalizeCabinetInput`) completează câmpurile lipsă: `mount` → încadrat+încadrat, `system: 'METAL_BOX'` → `'TANDEMBOX'`, `handle` lipsă → moștenire proiect. Scriptul `db:migrate-sertare` existent se extinde într-un `db:migrate-inputs` care rescrie JSON-urile o singură dată (idempotent). `Project.handleType` default `'APLICAT'` prin migrare Prisma.

## Ce NU intră în v1

- Variante de profil GOLA (C/L/colț) — un singur preț per ml.
- TIP-ON mecanic la balamale (uși push) ca produs separat calculat automat — se alege manual produsul ACCESORIU.
- Reguli automate de înălțime Tandembox (utilizatorul alege, softul constrânge).

## Testare

Directiva „fără teste noi" e în vigoare — gate: `npx tsc --noEmit`, `npm run build`, `npm test` (suita existentă rămâne verde; testele existente care ating `expandCarcass`/`expandDrawerBoxes` se actualizează la noile semnături/comportamente), smoke `scripts/smoke-quote.ts` și verificare manuală în browser (montaj aplicat schimbă dimensiunile în „Piese generate"; TANDEMBOX scoate piesele de sertar; GOLA scurtează fronturile; nota UX apare).

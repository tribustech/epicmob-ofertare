# EpicMob Ofertare — Design

**Data:** 2026-07-11
**Status:** aprobat verbal pe secțiuni, în review scris

## Problema

EpicMob (epicmob.ro) execută mobilă la comandă din PAL melaminat și MDF (melaminat, înfoliat, vopsit), cu feronerie Blum. Fluxul actual: măsurători la client → schiță → ofertare manuală corp cu corp (câte foi de PAL, câte piese de MDF vopsit, cant, feronerie, manoperă). Ofertarea manuală e lentă și predispusă la erori.

Aplicația **epic-mob-ofertare** automatizează pasul schiță → ofertă: introduci fiecare corp prin dimensiuni și opțiuni, aplicația derivă piesele, materialele, feroneria și prețul.

## Utilizatori și principii

- **Doar intern** (2–3 utilizatori EpicMob), aplicație web folosită la birou pe desktop.
- **Aplicația sugerează, utilizatorul decide** — orice valoare generată automat (piese, canturi, feronerie) e editabilă; validările sunt avertismente, nu blocaje.
- Prețul final = **cost total × adaos**, cu ambele cifre mereu vizibile.

## Arhitectură

- **Next.js (App Router, TypeScript) + SQLite (Prisma)** — aplicație locală, rulează pe calculatorul utilizatorului cu `npm run dev`; datele stau într-un fișier SQLite în proiect. *(Decizie 2026-07-11: inițial era planificat PostgreSQL + Vercel; utilizatorul a ales varianta locală. Dacă aplicația se mută online, se migrează la Postgres și se adaugă autentificare atunci.)*
- **Fără autentificare** — aplicația e locală, mono-utilizator.
- **Motorul de calcul e TypeScript pur, fără dependență de DB sau framework** (`lib/engine/`): primește corpuri + cataloage, întoarce piese, necesar de materiale și linii de cost. Testabil izolat; refolosibil ulterior pentru un calculator public pe epicmob.ro (explicit în afara v1).

Trei zone funcționale:

1. **Cataloage** — zonă de administrare separată de proiecte, unde se actualizează ușor toate prețurile (materiale, canturi, feronerie, servicii, manoperă) și setările; modificările afectează doar proiectele viitoare, nu ofertele deja calculate (vezi snapshot-ul de prețuri).
2. **Proiecte** — munca zilnică de ofertare.
3. **Exporturi** — documentele finale.

## Model de date

### Cataloage

- **Material placă**: nume, tip (`PAL` / `MDF_VOPSIT` / `MDF_MELAMINAT` / `MDF_INFOLIAT` / `PFL`), grosime (mm), format foaie (ex. 2800×2070; PFL 2850×2070), mod de preț: **per foaie** sau **per m²**. MDF vopsit se prețuiește per m² de piesă (vopsire inclusă), nu per foaie.
- **Cant ABS**: tip/grosime (0.4 / 1 / 2 mm), preț per ml (aplicare inclusă în tariful furnizorului).
- **Feronerie**: categorie (balama, sistem sertar, mâner, picior, șină suspendare, accesoriu), denumire (ex. „Blum ClipTop Blumotion 110°"), preț/buc; sistemele de sertare au atribute lungime nominală + clasă greutate.
- **Servicii furnizor**: debitare per foaie pe grosimi (grila furnizorului, ex. Darel), alte operații.
- **Manoperă per tip corp**: tarif fix per șablon (corp bază, suspendat, înalt, cu sertare, colț) — configurabil.
- **Setări globale**: adaos implicit (%), factor de utilizare foaie (implicit 80%), constante de construcție (vezi motorul parametric).

### Proiect

- Client (nume, contact), stare (`ciornă` / `trimisă` / `acceptată`), adaos % (moștenit din setări, ajustabil), listă de corpuri, linii libere de cost (blat, transport etc.).
- **Snapshot de prețuri**: la calcul, prețurile din cataloage se copiază în proiect, ca ofertele existente să nu se schimbe când actualizezi cataloagele. Recalcularea cu prețuri curente e o acțiune explicită.
- Duplicare proiect și duplicare corp — operații de un click.

### Corp

- Tip șablon, L×H×A (mm), opțiuni: nr. polițe, nr. uși, nr. sertare + înălțimi fronturi sertar, material carcasă, material fronturi, cu/fără spate + tip montaj spate, sistem sertar (cutie din PAL vs. Blum cu laterale metalice), etichetă (ex. „B1 — corp chiuvetă").
- **Piese generate**: denumire, L×l, material, cant pe fiecare din cele 4 laturi (tip cant sau nimic), cantitate. *(v1 implementat: piesele se regenerează din opțiunile corpului și din constantele de construcție — nu se editează individual; pentru situații atipice se adaugă **piese manuale suplimentare** per corp. Editarea per-piesă rămâne o extensie posibilă.)*
- **Feronerie sugerată** (editabilă): linii precompletate din regulile de mai jos; utilizatorul confirmă, modifică, șterge sau adaugă.

## Motorul parametric

Fiecare șablon e o funcție pură: `(dimensiuni, opțiuni, constante) → piese + canturi + feronerie sugerată`.

### Constante de construcție (globale, editabile)

Grosime carcasă implicită (18mm), rost între fronturi (3mm), retragere poliță (30mm), falț spate (4mm pe latură), retragere fund sertar etc. Nimic hardcodat — dacă atelierul lucrează altfel, se schimbă o singură dată.

### Exemplu: corp bază L×H×A, carcasă PAL 18

| Piesă | Formulă | Cant implicit |
|---|---|---|
| 2 × Laterală | A × H | muchia frontală ABS 0.4 |
| Blat + fund corp | (L − 36) × A | muchia frontală ABS 0.4 |
| Polițe (n) | (L − 36) × (A − 30) | muchia frontală ABS 0.4 |
| Spate | PFL 3mm, (L − 4) × (H − 4) în falț, sau pe toată fața — per șablon | fără |
| Fronturi | împărțire pe lățime cu rost 3mm; material fronturi | 4 laturi ABS 1mm (PAL/MDF melaminat) / fără (MDF vopsit și MDF înfoliat — fața e finisată pe toate laturile) |
| Sertar (cutie PAL) | front + 2 laterale cutie + spate cutie + fund | după caz |
| Sertar (Blum metalic) | doar front + fund + spate cutie mic | după caz |

Celelalte șabloane v1: **corp suspendat** (fără picioare, cu șină suspendare), **corp înalt** (coloană), **corp cu sertare**, **corp colț simplu**.

### Reguli feronerie sugerată

- **Balamale** per ușă: înălțime ≤900mm → 2; ≤1500mm → 3; ≤2100mm → 4; peste → 5. Verificare greutate: arie ușă × ~12,5 kg/m² (PAL 18) sau densitatea materialului; dacă greutatea depășește banda Blum pentru numărul dedus, se sugerează +1. Avertizare la uși mai late de 650mm.
- **Sertare**: lungime nominală glisieră după adâncimea corpului (270–650mm), clasă de greutate implicită 30/40kg, tier selectabil (Tandembox / Legrabox / economic).
- **Mânere**: 1 per front (opțiune profil Gola / push-to-open la nivel de proiect).
- **Picioare**: 4 per corp bază/înalt (6 peste o lățime prag).
- **Șină suspendare**: 1 set per corp suspendat.

Toate apar ca linii precompletate pe corp; nimic nu e impus.

## Calculul de cost

Șase categorii, agregate per proiect:

1. **Plăci** — piesele grupate pe material; pentru materiale per-foaie: `foi = ceil(Σ arie piese / (arie foaie × factor utilizare))` (factor implicit 0.8, editabil per proiect); pentru MDF vopsit: `Σ arie piese × preț/m²`.
2. **Cant ABS** — ml însumați pe tip × preț/ml.
3. **Servicii furnizor** — debitare per foaie după grilă (per grosime).
4. **Feronerie** — Σ buc × preț.
5. **Manoperă** — Σ tarif per corp după tip.
6. **Linii libere** — blat, transport, electrocasnice etc.

`Cost total = Σ(1..6)` → `Preț vânzare = cost × (1 + adaos%)`. Ambele afișate permanent, plus **indicator lei/ml** (preț vânzare ÷ lungime totală corpuri de bază) ca verificare rapidă față de piața românească (~1.500–2.800+ lei/ml segment economic/mediu).

## Fluxul de lucru

Proiect nou → date client → adaugă corp (șablon + dimensiuni + opțiuni → vezi instant piesele și feroneria → confirmi/editezi) → repetă pentru toată schița → ecran rezumat (6 categorii cost, adaos, preț, lei/ml) → exporturi.

## Exporturi (v1)

1. **Ofertă PDF client** — logo EpicMob, listă corpuri cu dimensiuni și materiale, preț total (defalcare pe corpuri opțională), valabilitate, termeni. Fără costuri interne.
2. **Necesar materiale** — foi per decor PAL, m² MDF vopsit, ml cant pe tip, foi PFL.
3. **Listă debitare** — CSV/Excel per material: etichetă corp, denumire piesă, L×l, buc, cant pe fiecare latură (formatul acceptat de furnizori tip Darel/PalHause).
4. **Listă feronerie** — agregată pe produs cu cantități totale.

## Validări și erori

- Avertismente (nu blocaje): ușă >650mm lățime pe balamale standard, poliță >900mm fără sprijin, greutate ușă vs. număr balamale, dimensiuni în afara limitelor uzuale.
- Material șters/redenumit din catalog dar folosit într-un proiect → avertizare la deschiderea proiectului; snapshot-ul de preț păstrează oferta validă.
- Motorul de calcul întoarce erori structurate (ex. dimensiune negativă) pe care UI-ul le arată la câmp.

## Testare

- **Teste unitare pe motor**: fiecare șablon cu dimensiuni cunoscute → exact piesele așteptate (dimensiuni, materiale, canturi); regulile de balamale/sertare pe cazuri limită (899/900/901mm).
- **Teste pe calculul de cost**: proiect de referință cu totaluri verificate manual, fixat ca regresie.
- **Criteriu de acceptanță**: o bucătărie reală, deja ofertată manual de EpicMob, introdusă în aplicație → necesarul de materiale și costul se potrivesc cu realitatea (diferențe explicabile).

## În afara v1 (explicit)

- Desen 3D / randări / planificare cameră.
- Nesting exact al debitării (se folosește factorul de utilizare; integrare API optiCutter posibilă ulterior).
- Calculator public de preț pe epicmob.ro (motorul e pregătit pentru asta).
- Gestiune stocuri, facturare, mai mulți furnizori de debitare simultan.

## Addendum v1.1 (2026-07-11, feedback utilizator după v1)

1. **Ansambluri** — nivel nou: Proiect → Ansamblu → Corpuri. Ansamblul are nume din preselecții (Bucătărie, Dressing, Corp baie, Living, Hol) sau text liber și **înălțimea picioarelor** (100/150mm implicit, editabil). Toate corpurile de bază din ansamblu primesc automat piciorul din catalog cu lungimea nominală egală cu înălțimea ansamblului (cel mai ieftin la egalitate; fallback piciorul implicit din Setări). Corpurile existente migrează într-un ansamblu implicit. Masca de soclu NU se generează automat în v1.1 (piesă suplimentară manuală).
2. **Editor de corp condiționat** — tipul corpului e radio/segmented; câmpurile afișate depind de tip: tipuri cu uși → uși + polițe (fără câmpuri de sertare); SERTARE → sertare (fără polițe/uși). Layout pe orizontală: formular stânga, piese + preț live dreapta.
3. **Prețuri live** — motorul rulează și în browser: editorul arată piesele și costul/prețul estimativ al corpului în timp ce tastezi (estimare: plăci pe arie fără rotunjire la foi, cant, feronerie, manoperă, debitare proporțională; etichetat „estimativ"). Pagina proiectului arată totalul live pentru proiectele în stare CIORNĂ (fără buton de calcul). **La trecerea în TRIMISĂ prețurile se îngheață automat** (snapshot); TRIMISĂ/ACCEPTATĂ folosesc snapshot-ul la rezumat/ofertă/exporturi, cu badge „Prețuri înghețate la {data}" și acțiune explicită de reîmprospătare; revenirea la CIORNĂ redevine live.
4. **Design system: shadcn/ui** peste Tailwind v4, aplicat pe toate paginile; container lat, grile orizontale, tabele pentru date; componentele proprii de formular devin wrappere peste primitive shadcn.
5. Corpurile cu uși nu mai expun deloc opțiuni de sertare (mutual exclusiv prin tip); mașina de spălat vase / frigiderul rămân de tratat separat (viitor).

## Referințe

- Schema de cost în 6 secțiuni: PolyBoard cost report — https://wooddesigner.org/help-centre/polyboard-cut-list-plans-cost-report/
- Reguli balamale: https://ea.blum.com/en/number-of-hinges/ , https://www.fabuwood.com/blog/number-of-hinges-per-cabinet-door/
- Sisteme sertare Blum: https://www.blum.com/eu/en/products/boxsystems/tandembox/tandembox-antaro/programme/
- Servicii debitare + cant (grile RO): https://www.darel.ro/servicii/servicii-debitare.html
- Piața RO lei/ml: https://www.daibau.ro/preturi/mobila_la_comanda
- Formate plăci RO: PAL 2800×2070×18 (Kronospan/Egger), PFL/HDF 2850×2070×3

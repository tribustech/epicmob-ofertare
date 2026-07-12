# Nesting debitare — număr real de plăci + plan vizual

**Data:** 2026-07-12
**Context:** Până acum numărul de plăci per material era o euristică (`ceil(arie_totală / (arie_placă × yieldFactor))` în `lib/engine/needs.ts`). Utilizatorul vrea logica unui optimizator de debitare (gen CutMaster 2D): câte plăci se consumă efectiv pe **tot proiectul**, ca să se optimizeze pierderile. Prețul per corp rămâne orientativ.

## Scop

1. Algoritm de nesting propriu, în motorul pur (`lib/engine/nesting.ts`), care așază piesele pe plăci și returnează numărul real de plăci + pierderea %.
2. Pagină vizuală „Plan debitare" per proiect, cu plăcile desenate (SVG), printabilă.

**Se aplică doar materialelor cu `pricing.mode = PER_SHEET`** (PAL, melaminat). Materialele `PER_SQM` (MDF vopsit, MDF înfoliat) rămân la mp, fără nesting.

## Decizii ale utilizatorului

- Nesting + desen vizual, doar pentru materialele la placă.
- **Fără rotație:** toate piesele se așază mereu cu lungimea piesei paralelă cu lungimea plăcii (fibra e pe lungime). Nu există flag „are fibră" — regula e globală.
- Algoritm propriu în TypeScript pur, în stilul motorului existent (determinist, testabil, rulează și în browser).

## Secțiunea 1: Algoritmul (`lib/engine/nesting.ts`)

**Intrare:**
- Piesele proiectului (toate corpurile agregate), grupate per material `PER_SHEET`.
- Dimensiunile plăcii din catalogul de materiale (`sheetLengthMm × sheetWidthMm`).
- Parametri noi în setările de debitare: **kerf** (grosimea pânzei, default 4 mm) și **margine de curățare** (trim, default 10 mm pe fiecare latură a plăcii). Ambele configurabile în zona de administrare existentă (setări debitare).

**Algoritm — guillotine pe rafturi (shelf First-Fit Decreasing):**
1. Aria utilă a plăcii = placa minus marginea de curățare pe toate laturile.
2. Piesele se sortează descrescător după lățime (dimensiunea perpendiculară pe lungimea plăcii).
3. Se așază pe „rafturi" orizontale, de la stânga la dreapta, cu kerf între oricare două piese vecine și între rafturi (First-Fit: piesa intră pe primul raft unde încape; altfel raft nou; altfel placă nouă).
4. Orientarea e fixă: lungimea piesei pe lungimea plăcii, fără rotație.
5. Toate tăieturile rezultate sunt drepte, cap-la-cap (compatibile cu panel saw-ul furnizorului).

**Ieșire (per material):**
- Lista plăcilor, fiecare cu piesele plasate: poziție (x, y), dimensiuni, eticheta (nume corp + nume piesă).
- Număr total de plăci și pierdere % (1 − arie piese / arie plăci folosite).
- **Eroare explicită** dacă o piesă nu încape pe placa goală (nume piesă + corp în mesaj) — nu se emite preț tăcut greșit.

Funcție pură, deterministă: același input → același output.

## Secțiunea 2: Integrare în motor și preț

- `needs.ts`: pentru `PER_SHEET`, `sheets` vine din nesting. **yieldFactor nu se mai folosește la materialele la placă** (rămâne doar câtă vreme există în semnături; nu mai influențează plăcile). `PER_SQM` neschimbat.
- `costing.ts`: logică neschimbată — plăci × preț/placă + serviciu debitare × plăci — dar pe cifra reală din nesting.
- Prețul live per corp din editor rămâne pe arie (orientativ). Cifra oficială e la nivel de proiect, unde nesting-ul rulează pe toate corpurile împreună. Motorul fiind TS pur, rezumatul proiectului poate rămâne live în browser.

## Secțiunea 3: Pagina „Plan debitare"

- Pagină nouă per proiect. Pentru fiecare material la placă: plăcile desenate ca SVG — conturul plăcii, piesele cu etichetă (corp + piesă + L×l), resturile hașurate. Sub fiecare material: total plăci + pierdere %.
- Printabilă (Cmd+P → PDF), același pattern ca oferta. Se trimite la furnizor alături de CSV-ul de debitare existent, care rămâne neschimbat.
- În rezumatul proiectului, secțiunea de plăci afișează: „PAL alb: 4 plăci (pierdere 12%)".

## Secțiunea 4: Testare

Conform directivei (2026-07-12): fără teste UI. Nesting-ul e logică pură → teste în `lib/engine/__tests__/nesting.test.ts`:
- piese care umplu exact o placă (cu kerf) → 1 placă;
- depășire cu o piesă → 2 plăci;
- piesă mai mare decât aria utilă → eroare cu numele piesei;
- kerf și trim respectate în poziții;
- pierderea % calculată corect;
- determinism (același input → același output).

Pagina de desen: build + smoke.

## În afara scopului (explicit)

- Resturi (offcuts) salvate între proiecte.
- Etichete de piese tipăribile individual, export DXF/XML.
- Rotația pieselor sau flag de fibră per material.
- Optimizare exactă (programare liniară) — euristica shelf e suficientă pentru ofertare.

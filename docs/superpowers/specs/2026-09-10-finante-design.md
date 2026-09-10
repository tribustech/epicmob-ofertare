# Finanțe — conturi, mișcări, documente, alocări, împrumuturi, recurente

**Data:** 2026-09-10
**Context:** sub-proiectul 4 din designul umbrelă CRM (`new features/2026-09-10-crm-design.md`, §2, §3.4, §4.3–4.6, §5, §6.6). Clienți/Proiecte/Oferte (C1–C4) sunt gata; Timeline + poze vine după. Utilizatorul a cerut banii înaintea timeline-ului.

**Principii preluate:** fiecare leu are urmă (solduri derivate din mișcări, corecția = ajustare cu motiv); cash ≠ profit; estimat lângă real; TVA configurabil (firma nu e plătitoare acum); salariile sunt cheltuială fixă lunară, nu se alocă pe proiecte (decizie 2026-09-10).

## Decizii (propuse; se confirmă la fiecare pas)

- **Sume `Decimal(12,2)`** pe toate modelele noi. Enum-urile sunt `String` + constante TS, ca în restul schemei.
- **Încasarea e o mișcare, nu neapărat un document**: `Movement IN` cu `projectId` + `incomeType` (AVANS | RATA | FINAL). Chitanța/factura emisă se poate atașa ca `Document INCOME` legat de mișcare, opțional. Simplifică introducerea și păstrează raportarea („încasat X din Y").
- **Bani personali (ex. „Card Andrew")**: cont de tip `CARD` marcat `personal: true`. Soldul negativ al unui cont personal apare la „Datorii" ca „de returnat lui X". Nu se creează împrumut la fiecare plată. Alternativa (împrumut automat) rămâne posibilă ulterior.
- **Recurentele se generează lazy**, nu cu cron: la deschiderea Dashboard-ului sau a paginii Finanțe se generează documentele „așteptate" lipsă pentru perioada curentă (idempotent pe `recurringId + periodKey`). Zero infrastructură pe Vercel.
- **Alocarea pe proiect e pe sumă**, fără cantități.
- **Poza bonului** = `Attachment` pe Cloudflare R2 (URL presemnat, compresie client-side ~1500px). Upload-ul intră la F3; fără credențiale R2 câmpul rămâne ascuns, restul formularului merge.
- **Categorii de cost** editabile din Setări, cu `quoteBucket` pentru Estimat vs Real (§5.2).
- **Dashboard**: „Datorii" (facturi neplătite + împrumuturi + conturi personale pe minus) înlocuiește cardul „Împrumuturi de returnat" (decizie 2026-09-10).

## Schema (F1)

```
Account          name, kind BANCA|CASH|CARD|ALTUL, personal: bool, currency 'RON', active, sortOrder
Movement         accountId, type IN|OUT|TRANSFER_IN|TRANSFER_OUT|ADJUSTMENT, amount, date, note?,
                 documentId?, loanId?, projectId? + incomeType? (încasare directă), transferPairId?, adjustmentReason?, createdById?
Loan             lenderName, principal, receivedAt, dueAt?, note?, createdById?     remaining = principal − Σ returnări
Document         direction EXPENSE|INCOME, kind FACTURA|PROFORMA|BON|CHITANTA|ALTUL, counterparty, counterpartyClientId?,
                 number?, issuedAt, dueAt?, amount, vatPct?, vatIncluded, categoryId?, replacesDocumentId?, recurringId?,
                 periodKey? ('2026-09'), expected: bool, note?, createdById?      paidAmount / paymentStatus derivate
DocumentAllocation documentId, projectId, amount, categoryId, note?         Σ ≤ document.amount; restul = indirect
CostCategory     name, scope DIRECT|INDIRECT, sortOrder, active, quoteBucket? boards|edging|cuttingService|hardware|freeLines
RecurringExpense name, counterparty?, amount, categoryId, frequency LUNAR|TRIMESTRIAL|ANUAL, dayOfMonth, active, startsAt, endsAt?
ContractChange   projectId, amount (±), description, date, createdById?
Attachment       key, url, mime, sizeBytes, width?, height?, documentId?  (noteId vine cu Timeline)
AppSettings      + vatPayer=false, vatDefaultPct=21, companyName?, companyCui?, companyAddress?, overEstimatePct=10
```

Seed (`npm run db:seed-finante`, idempotent): categoriile din §2 (directe: Plăci→boards, Cant→edging, Debitare→cuttingService, Feronerie→hardware, Fronturi furnizor, Blat, Transport→freeLines, Montaj extern→freeLines, Refaceri, Altele; indirecte: Chirie, Utilități, Contabilitate, Salarii, Taxe stat, Combustibil, Unelte/consumabile, Marketing, Abonamente, Altele) + un cont „Cont firmă" (BANCA) și „Cash atelier" (CASH) dacă nu există niciun cont.

## Pași atomici

- **F1. Schema + seed + Setări**: modelele de mai sus, migrare, seed, Setări → carduri „Firmă și TVA" și „Categorii de cost" (listă, adaugă, activ/inactiv, mapare la estimat).
- **F2. Conturi + mișcări**: `/finante` cu sub-nav Conturi · Cheltuieli · Recurente · Împrumuturi · Ajustări; carduri per cont cu sold și ultimele 5 mișcări; Cont nou, Transfer, Ajustare (sold numărat → diferență + motiv); registru per cont filtrabil pe lună; lista Ajustări.
- **F3. Cheltuieli**: formularul „Adaugă cheltuială" (document → alocări pe proiecte → plată), panou lateral pe desktop, `/finante/cheltuieli/noua` vertical pe mobil; lista documentelor EXPENSE cu filtre (lună, status, categorie, proiect, doar nealocate); panoul documentului (alocări editabile, plăți, „Înlocuiește proforma"); poza pe R2.
- **F4. Încasări + împrumuturi + bani pe proiect**: „Adaugă încasare" pe proiect, tab Bani (încasări, de încasat, facturi neplătite pe proiect), modificări de contract, Împrumut primit / Returnare, cardurile de bani pe Dashboard (Conturi, Disponibil real, De încasat, Datorii).
- **F5. Recurente + rapoarte**: șabloane + „Așteptate luna asta" + Confirmă plata (generare lazy), „De plătit în 14 zile" pe Dashboard, tab Costuri (Estimat vs Real cu prag), pagina Luna (§5.3), Indicatori (§5.4).

## Reguli de calcul (din spec, §5)

Sold cont = Σ IN + TRANSFER_IN + ADJUSTMENT(±) − OUT − TRANSFER_OUT. Preț contract = Σ oferte acceptate + Σ ContractChange. Încasat = Σ Movement IN cu projectId. Cheltuit = Σ alocări. Contribuție = contract − cheltuit. De plătit pe proiect = Σ (document.amount − paidAmount) × (alocare / document.amount). Disponibil real = solduri − facturi neplătite (inclusiv așteptate) − împrumuturi scadente în 30 z. Venit lunar recunoscut la `mountedAt`.

## Verificare (fiecare pas)

`npx tsc --noEmit`, `npm test`, `npm run build`, smoke în browser pe fluxurile pasului, teste unitare pe calculele pure (solduri, statusul plății, disponibil real, estimat vs real).

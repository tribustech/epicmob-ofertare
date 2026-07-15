# Redesign pagina /proiecte

**Data:** 2026-07-15
**Context:** după redesignul paginii corp + reskinul global (spec `2026-07-15-corp-page-redesign-design.md`), pagina /proiecte a rămas în stilul vechi: card „Proiect nou" mereu vizibil + carduri de proiect sărace (nume, badge, client, 2 butoane mari). Utilizatorul le vrea în limbajul vizual nou, cu status și **cost materiale vs preț ofertă** pe fiecare card.

**Abordare aleasă (A): restyle in place.** Pagina rămâne server component; se adaugă un singur client component nou pentru panoul de proiect nou. Zero schimbări la acțiunile server (`createProject`, `duplicateProject`, `deleteProject`), la calculul de preț și la rute.

## 1. Header + panou „Proiect nou"

- Rând titlu: `Proiecte` (text-2xl font-bold tracking-tight, ca pe pagina corp) + buton primary negru **„Proiect nou"** aliniat dreapta.
- Component nou `components/NewProjectPanel.tsx` (client): butonul comută vizibilitatea unui panou-card alb sub header. Panoul conține formularul existent — `ActionForm action={createProject}` cu `TextInput` Nume proiect / Client (opțional) / Contact (opțional) — plus butoanele „Creează" (submit, primary) și „Anulează" (închide panoul). Închis by default.
- Formularul (`ActionForm` + server action) e primit ca `children` de la pagina server — pattern-ul de compoziție folosit la sloturile din editorul de corp; `NewProjectPanel` deține doar starea deschis/închis și butonul.
- Micro-labels uppercase vin automat din `TextInput` (restilizat la reskin).

## 2. Cardurile de proiect

Grilă `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`. Card alb `rounded-xl bg-card ring-1 ring-border`, patru zone:

1. **Header**: numele proiectului (15px bold, `Link` spre `/proiecte/[id]`, hover underline) + **pill status** (11px semibold, rounded-full, px-2.5 py-0.5):
   - Ciornă → `bg-muted text-muted-foreground`
   - Trimisă → `bg-accent-blue text-accent-blue-foreground border border-accent-blue-border`
   - Acceptată → verde emerald cu clase literale (`bg-emerald-50 text-emerald-700 border border-emerald-200`) — precedentul alertelor amber.
2. **Meta** (12.5px, `text-muted-foreground`): `{client ?? 'Fără client'} · {N} corpuri · {updatedAt dd.MM.yyyy}` — numărul de corpuri în `font-mono`. Data formatată determinist (fără locale implicit de server vs client — e server component, e ok `Intl.DateTimeFormat('ro-RO')`).
3. **Prețuri**: pereche compactă pe două coloane:
   - „Cost materiale" — micro-label uppercase 10px + cifră `font-mono font-semibold` ~16px, culoare foreground.
   - „Preț ofertă" — la fel, cifra în `text-accent-blue-foreground`.
   - Valori: `quote.costs.totalCost` / `quote.costs.sellPrice` prin `fmtLei`. La eroare de calcul sau proiect fără corpuri calculabile → `—` pe ambele.
4. **Acțiuni**: hairline sus (`border-t`), rând discret: „Duplică" (`ActionForm` + buton ghost/text mic) și `DeleteButton` existent (confirm rămâne). Nu mai domină cardul.

### Calculul prețurilor pe listă

Per proiect, pe server: `getQuoteBasis(project)` (respectă snapshot-ul înghețat la Trimisă/Acceptată; la Ciornă folosește snapshotul live construit O SINGURĂ DATĂ cu `buildSnapshot()` și refolosit pentru toate ciornele) → încărcare corpuri+ansambluri → `toQuoteInput(project, cabinets, legHeightByCabinet(...))` → `tryComputeQuote(...)`. Totul în try/catch per proiect; orice eroare → prețuri `—`, cardul se afișează normal. Notă de performanță: motorul e pur și rapid, iar proiectele sunt puține (unealtă internă) — acceptat explicit de utilizator.

Încărcarea corpurilor: **se refolosește `loadProject(id)` per proiect** (interogare per proiect — N+1 asumat, N e mic la o unealtă internă; reuse-ul integral al `lib/quote/load.ts` bate micro-optimizarea unei interogări unice). Fără logică duplicată de calcul.

### Empty state

Fără proiecte → un singur card cu chenar punctat (`border-2 border-dashed`), centrat: „Niciun proiect încă" + sub-text „Creează primul proiect ca să începi oferta." (butonul de sus rămâne singura cale de creare).

## 3. Ce NU se schimbă

Acțiunile server, schema, motorul, `getQuoteBasis`/`tryComputeQuote`/`toQuoteInput` (doar se apelează), ruta `/proiecte`, comportamentul DeleteButton (confirm), restul paginilor.

## 4. Verificare (gate: tsc + build + smoke — fără teste noi, conform directivei 2026-07-14)

1. `npx tsc --noEmit`, 2. `npm run build`, 3. smoke browser: pagina listează proiectele cu status pill + prețuri corecte (comparate cu Rezumatul din pagina proiectului), panoul Proiect nou se deschide/închide, crearea unui proiect funcționează (apoi ștergerea lui de test), Duplică/Șterge funcționează, empty state (vizual, dacă e fezabil fără a goli DB-ul — altfel doar review de cod), spot-check pagina proiect + corp că nu s-a stricat nimic.

## Riscuri / decizii

- **Prețuri pe listă = calcul la fiecare încărcare** — acceptat (motor pur, puține proiecte). Dacă devine lent, se optimizează ulterior (cache/limit), nu acum (YAGNI).
- **Verde emerald cu clase literale**, nu token nou — un singur loc îl folosește; token doar dacă se repetă.
- **Panoul nou-proiect e singura cale de creare** — comportament identic cu azi (formularul exista o singură dată), doar ascuns by default.

# CRM C1 — schema + migrare (Project → Quote, Client, Project CRM, Event)

**Data:** 2026-09-10
**Context:** primul pas din sub-proiectul „Clienți + Proiecte + Oferte" al designului umbrelă CRM (`new features/2026-09-10-crm-design.md`, §3.2, §7). Strict intern: schema, redenumire în cod, script de migrare a datelor. Fără pagini noi; UI-ul existent rămâne identic ca rute și comportament.

## Decizii

- **Redenumire reală** în DB: tabelul `Project` → `Quote`, coloanele `Cabinet.projectId` / `Assembly.projectId` → `quoteId`. Migrarea SQL e scrisă de mână cu `RENAME` (nu drop + create), ca datele să rămână.
- **Redenumire completă în codul de ofertare**: `prisma.project` → `prisma.quote`, `projectId` → `quoteId`, `loadProject` → `loadQuote`, `createProject` → `createQuote` etc. După C1, „project" în cod înseamnă doar proiectul CRM.
- **Rutele nu se schimbă** (`/proiecte/[id]` rămâne editorul de ofertă până la C3/C5).
- **Enum-urile sunt `String`** cu valorile documentate în comentarii + constante TS, ca în restul schemei.
- **Sumele noi sunt `Decimal(12,2)`** (`acceptedPrice`, `budgetEstimate`). Restul schemei rămâne pe `Float`.
- **`Quote.projectId` e opțional** în această migrare (rândurile existente nu-l au); scriptul îl completează; devine obligatoriu într-o migrare ulterioară, după verificare. La fel `clientName`/`clientContact` rămân pe `Quote` până atunci.
- **`Project.clientId` e opțional**: ofertele existente „Fără client" devin proiecte fără client. Din UI, un proiect nou se creează mereu de pe un client.
- **`createdById` / `Event.userId` sunt opționale**: migrarea rulează fără utilizator logat.
- **Mai multe oferte ACCEPTATA per proiect** sunt permise (decizie 2026-09-10); nu există `acceptedQuoteId`. Preț contract = Σ `acceptedPrice` + modificări (vine în Bani).
- **`acceptedPrice` se îngheață** la acceptare. Pentru ofertele deja ACCEPTATA, scriptul îl calculează din snapshot-ul înghețat (motorul existent).

## Schema

```
Quote (fost Project) + projectId?: → Project, version: Int = 1, label?: String,
                       acceptedPrice?: Decimal(12,2), acceptedAt?: DateTime
                       status: CIORNA | TRIMISA | ACCEPTATA | RESPINSA
Client      name, kind PERSOANA|FIRMA, phone?, email?, address?, cui?, stage LEAD|CALIFICAT|CLIENT|PIERDUT,
            source?, wants?, budgetEstimate?, firstContactAt, nextActionAt?, nextActionNote?,
            lostReason?, lostNote?, remarketing, remarketingNote?, createdById?
Project     clientId? → Client, name, description?, status OFERTARE|ACCEPTAT|IN_PRODUCTIE|MONTAT|INCHIS|PIERDUT,
            deadlineAt?, acceptedAt?, mountedAt?, closedAt?, lostReason?, lostNote?, hoursWorked?, createdById?
Event       clientId?, projectId?, type, payloadJson, userId?, createdAt
LeadSource  name (unic), sortOrder, active
```

Indexuri: `Client(stage)`, `Client(phone)`, `Project(status, deadlineAt)`, `Project(clientId)`, `Quote(projectId)`, `Event(clientId, createdAt)`, `Event(projectId, createdAt)`.

## Script `npm run db:migrate-crm` (idempotent)

1. Seed `LeadSource`: Instagram, Facebook, Recomandare, Site, Telefon, Altul (upsert pe nume).
2. Clienți: `clientName` distinct (trim, case-insensitive) → `Client`; `clientContact` → `phone` dacă arată a număr, altfel `email`; stage CLIENT dacă are ofertă ACCEPTATA, altfel CALIFICAT; `source` = 'Altul'; `firstContactAt` = cel mai vechi `createdAt` al ofertelor. Nu creează dubluri: caută întâi după nume normalizat.
3. Proiecte: pentru fiecare `Quote` cu `projectId = null` → `Project` cu același nume, clientul găsit (sau null), status ACCEPTAT dacă oferta e ACCEPTATA (cu `acceptedAt = quote.updatedAt`), altfel OFERTARE; `quote.projectId` = noul id, `version = 1`.
4. Preț înghețat: pentru `Quote` ACCEPTATA cu `acceptedPrice = null` → calculează `sellPrice` din snapshot (ca pagina de listă) și îl salvează; dacă nu se poate calcula, lasă null și raportează.
5. Raport la final: clienți creați, proiecte create, prețuri înghețate, oferte fără preț.

## Verificare

1. `npx tsc --noEmit`, `npm test`, `npm run build`.
2. `npx prisma migrate dev` aplică migrarea fără pierdere de date: numărul de oferte/corpuri/ansambluri identic înainte și după.
3. `npm run db:migrate-crm` de două ori la rând: a doua rulare nu creează nimic.
4. Smoke browser: `/proiecte` listează aceleași oferte cu aceleași prețuri; deschiderea unei oferte, a unui corp și a planului de debitare funcționează; duplicarea unei oferte merge.

## Riscuri

- **Redenumirea `projectId` → `quoteId`** e mecanică (sed pe fișierele domeniului de ofertare) și e prinsă integral de `tsc`.
- **Migrarea pe producție** trebuie rulată în ordinea: `prisma migrate deploy` (automat la build pe Vercel) → `npm run db:migrate-crm` manual cu `DATABASE_URL` de producție.

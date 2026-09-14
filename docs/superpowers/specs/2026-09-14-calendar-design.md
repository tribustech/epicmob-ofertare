# Calendar — design

Data: 2026-09-14. Stare: aprobat în discuție, de implementat.

## Scop

Un tab nou „Calendar" în meniul principal (după „Luna") cu o grilă lunară în care apar, pe zile,
toate lucrurile cu termen din aplicație, plus evenimente scrise de mână (montaje, livrări, concedii).
Utilizatorul vede dintr-o privire ce are de făcut, ce e restant și cât de încărcat e atelierul.

## Ce intră în v1

Patru surse de evenimente, afișate uniform:

| Tip (`kind`) | Sursă | Condiție | Culoare | Click → |
|---|---|---|---|---|
| `DEADLINE` | `Project.deadlineAt` | proiect cu status în afară de `INCHIS` / `PIERDUT` | roșu | `/proiecte/[id]` |
| `ACTIUNE` | `Client.nextActionAt` + `nextActionNote` | client cu stage în afară de `PIERDUT` | albastru | `/clienti/[id]` |
| `BANI` | `Document.dueAt` (EXPENSE și INCOME, inclusiv `expected: true`) și `Loan.dueAt` | document cu `paymentStatus ≠ PLATIT` (via `paymentStatus(amount, paid)` din `lib/finance/documents.ts`); împrumut cu rest de returnat > 0 | verde | document: `/finante/cheltuieli?doc=[id]` (panoul lateral existent); împrumut: `/finante/imprumuturi` |
| `MANUAL` | model nou `CalendarEvent` | toate | mov | modal de editare |

Restanțele (data < azi, condiția încă adevărată) apar în ziua lor, cu pastila marcată (contur/„!").
Ele sunt vizibile doar când navighezi în luna respectivă; nu se „trag" în luna curentă.

Nu intră în v1: drag-and-drop, evenimente pe mai multe zile, vedere săptămânală/agendă, export iCal,
notificări, jaloane istorice (acceptat/montat), evenimente din timeline-ul CRM.

## Model de date

```prisma
// Eveniment scris de mână în Calendar (montaj, livrare, concediu). O singură zi, oră opțională.
model CalendarEvent {
  id          String   @id @default(cuid())
  title       String
  date        DateTime           // ziua (miezul nopții local), fără oră
  time        String?            // 'HH:MM' opțional
  note        String?
  projectId   String?
  project     Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  clientId    String?
  client      Client?  @relation(fields: [clientId], references: [id], onDelete: SetNull)
  createdById String?
  createdBy   User?    @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([date])
  @@index([projectId])
}
```

`clientId` se completează automat din proiect când se alege un proiect (nu e câmp în formular);
rămâne ca să apară evenimentul și în timeline-ul clientului. Migrare Prisma: `calendar_event`.
Relațiile inverse `calendarEvents CalendarEvent[]` se adaugă pe `Project`, `Client`, `User`.

Data se stochează ca zi locală (miezul nopții), exact ca `Project.deadlineAt` (`parseDateInput`).

## Agregator (`lib/calendar/`)

`types.ts`

```ts
export type CalendarKind = 'DEADLINE' | 'ACTIUNE' | 'BANI' | 'MANUAL';
export interface CalendarItem {
  id: string;            // `${kind}:${sourceId}` — unic în lună
  kind: CalendarKind;
  date: Date;            // zi locală
  time: string | null;   // 'HH:MM' doar la MANUAL
  title: string;         // ex. „Deadline · Dulap uși glisante 240×225", „Sună Popescu", „Factură Egger 4.200 lei"
  subtitle: string | null; // clientul / nota / restul de plată
  href: string | null;   // null la MANUAL (deschide modal)
  overdue: boolean;      // date < azi și încă activ
  manual?: { title: string; time: string | null; note: string | null; projectId: string | null }; // pentru editare
}
```

`events.ts` — `loadCalendarMonth(key: string, today = new Date()): Promise<CalendarItem[]>`.
Citește cele 4 surse pentru intervalul `[start, end)` din `parseMonthKey` (lunile vecine vizibile în
grilă se iau tot din același interval extins la primele/ultimele celule, adică `gridRange(key)`).
Documentele „plătit" se filtrează în memorie după `paymentStatus`, folosind suma mișcărilor
(`Movement.documentId`), la fel cum face pagina Finanțe. Fără logică de UI aici.

`grid.ts` — funcții pure, testate:

- `gridRange(key)` → `{ start, end }`: de la lunea săptămânii cu ziua 1 până la duminica ultimei
  săptămâni; întotdeauna 42 de zile (6 rânduri), ca grila să nu sară în înălțime.
- `buildGrid(key, items, today)` → 42 celule `{ date, inMonth, isToday, items }`, cu `items`
  sortate: cele cu oră întâi (după oră), apoi restul în ordinea DEADLINE, ACTIUNE, BANI, MANUAL,
  apoi alfabetic.
- `applyFilter(items, kinds)` — filtrele din URL.

Cheia de zi pentru grupare: `YYYY-MM-DD` în timp local (`toDateInput` din `lib/crm/dates.ts`).

## Pagina `/calendar`

`app/calendar/page.tsx`, server component, `dynamic = 'force-dynamic'`, ca „Luna".
Query: `?luna=YYYY-MM` (implicit luna curentă) și `?tip=deadline,actiune,bani,manual`
(implicit toate; lipsa parametrului = toate). `?zi=YYYY-MM-DD` deschide panoul zilei.

Antet (același stil ca „Luna"): `‹` `Septembrie 2026` `›`, buton „Azi", chips de filtru pe tip
(link-uri care schimbă `tip`), buton „Adaugă eveniment" (FormModal, data implicită = azi sau `zi`).

Grilă: 7 coloane Lu–Du, 6 rânduri, `rounded-xl bg-card ring-1 ring-border`. Celulă: numărul zilei
(click = modal „Eveniment nou" cu ziua precompletată; pe telefon punctele colorate sunt link către
panoul zilei), fundal ușor la „azi", text estompat pentru zilele din lunile vecine. Maxim 3 pastile, apoi „+N" (link către panoul zilei). Pastila: punct colorat + oră (dacă e) +
titlu trunchiat; restanță = contur roșu subțire + „!". Pastilele cu `href` sunt `Link`; cele MANUAL
deschid modalul de editare.

Panoul zilei (când e `zi` în URL): coloană sub grilă cu lista completă a zilei (aceleași pastile, cu
subtitlu), plus „Adaugă eveniment" precompletat cu ziua. Închidere = link fără `zi`.

Telefon (`< 640px`): celulele arată doar numărul și puncte colorate (fără text); panoul zilei preia
detaliile. Nu se introduce un layout separat.

Meniu: `{ href: '/calendar', label: 'Calendar' }` în `components/MainNav.tsx`, după „Luna".

## Evenimente manuale — acțiuni

`lib/calendar/actions.ts` (`'use server'`, `formAction` + `requireUser`, ca `project-actions.ts`):

- `createCalendarEvent(fd)` — câmpuri: `title` (obligatoriu), `date` (`YYYY-MM-DD`, obligatoriu),
  `time` (opțional, `HH:MM`), `projectId` (opțional, select cu proiectele active din
  `loadProjectOptions()`), `note`. `clientId` se ia din proiect. Eveniment de timeline
  `CALENDAR_EVENT` pe proiect/client (dacă există), payload `{ title, date, time }`.
- `updateCalendarEvent(id, fd)` — aceleași câmpuri; fără eveniment de timeline.
- `deleteCalendarEvent(id)` — ștergere directă (DeleteButton existent, cu confirmare).

Validare cu `zod`, aceleași preprocesări `optText` ca în CRM. `revalidatePath('/calendar')` +
paginile proiectului/clientului legate.

Timeline: `EVENT_LABELS.CALENDAR_EVENT = 'a programat un eveniment'`, `eventText` →
detail `„{title} · {dd.mm.yyyy}{ · HH:MM}"`.

Formular (`components/calendar/EventForm.tsx`, server-rendered în `FormModal`): TextInput titlu,
TextInput date (`type="date"`, mono), TextInput oră (`type="time"`; se adaugă `'time'` la
tipurile acceptate de `TextInput`), Select proiect (`allowEmpty`), TextArea notă,
SubmitButton; în editare și `DeleteButton`.

## Erori și cazuri limită

- `luna` invalidă → luna curentă. `zi` invalidă → ignorată.
- Proiect șters → evenimentul rămâne, fără legătură (`SetNull`).
- Document cu `dueAt` null nu apare. Împrumut fără `dueAt` nu apare.
- Două evenimente în aceeași zi cu aceeași oră: ordine alfabetică, stabilă.
- Fusul orar: toate comparațiile pe zile se fac pe date locale (`startOfToday`, `toDateInput`),
  consecvent cu restul CRM.

## Testare

Unitare (vitest, fără DB): `gridRange` (42 de celule, începe luni, cazuri: lună care începe luni,
lună care începe duminică, februarie), `buildGrid` (grupare pe zi, `isToday`, `inMonth`, sortare
oră → tip → titlu), `applyFilter`, `eventText('CALENDAR_EVENT')`, validarea `HH:MM`.

Integrare manuală: pagina cu sesiune semnată + `curl` (grila are 42 de celule, apar deadline-ul
proiectului „Dulap uși glisante 240×225" și scadențele din Finanțe), apoi verificare în browser de
către utilizator (adăugare/editare/ștergere eveniment, filtre, navigare lună, telefon).

## Fișiere atinse

- `prisma/schema.prisma` + migrare
- `lib/calendar/{types,grid,events,actions}.ts`, `lib/calendar/__tests__/grid.test.ts`
- `app/calendar/page.tsx`, `components/calendar/{EventForm,MonthGrid,DayPanel}.tsx`
- `components/MainNav.tsx`, `components/forms.tsx` (tip `time` la TextInput)
- `lib/crm/constants.ts`, `lib/crm/event-text.ts` (+ test)

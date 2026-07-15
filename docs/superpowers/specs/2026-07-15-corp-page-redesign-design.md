# Redesign pagina Corp + reskin global

**Data:** 2026-07-15
**Sursă design:** `~/Downloads/Configurator Corp Page Content (1).html` (mockup bundled — extras: layout accordion + sumar sticky + limbaj vizual nou)
**Scop aprobat:** reskin global (fonturi, tokens, nav) + redesign complet al paginii corp. Accordion cu secțiuni care se deschid independent (mai multe pot fi deschise simultan — deviere acceptată de la mockup, care avea una singură).

## Context

Pagina corp (`app/proiecte/[id]/corp/[cabinetId]/page.tsx`) este editorul unui corp — atât după „Adaugă corp" cât și la editare. Azi: grilă 2 coloane de carduri shadcn mereu deschise, font Geist, fundal gri neutru; Feronerie și Piese suplimentare sunt carduri server-rendered separate sub formularul client.

Mockup-ul cere: coloană stânga cu 6 secțiuni accordion (header cu sumar live + chevron), coloană dreapta 380px sticky cu Preț estimativ / Piese generate / Previzualizare, controale segmented pill, fonturi Instrument Sans + IBM Plex Mono, fundal cald `#eceae4`.

**Abordare aleasă (A): restyle in place.** Arhitectura existentă (pagină server + `CabinetEditorForm` client + formulare server-action) rămâne; se schimbă doar prezentarea.

## 1. Shell global

### `app/layout.tsx`
- Fonturi `next/font/google`: `Instrument_Sans` (400–700) → `--font-sans`, `IBM_Plex_Mono` (400–600) → `--font-mono`. Subsets: `latin`, `latin-ext` (diacritice românești).
- Nav: bară albă, border jos `#e6e6e2`, brand „EpicMob **Ofertare**" (Ofertare gri, weight 500), linkuri text simplu 13px/500 gri (`#71717a`) cu hover închis — înlocuiesc butoanele ghost.
- Lățime conținut: `max-w-[1340px]` (era `max-w-screen-2xl`).

### `app/globals.css` (doar tema light — nu există toggle dark)
- `--background: #eceae4` · `--card: #fff` · `--border: #e6e6e2` · `--input: #e4e4e1`
- `--primary: #18181b` · `--muted-foreground: #71717a`
- `--radius: 0.8125rem` (13px carduri; inputuri ~9px via radius-md)
- Nou: `--accent-blue-fg: oklch(0.5 0.1 245)` / `--accent-blue-bg: oklch(0.97 0.02 245)` — cardul „Preț vânzare" și linkuri.
- `--font-mono` expus în `@theme inline`.
- Paginile de print nu sunt afectate (au `bg-white` local).

## 2. Primitive noi (`components/ui/`)

### `SectionAccordion` (client)
Card alb cu header clickabil: `title` (700 15px), `summary` (12.5px gri, live, actualizat din exterior), chevron `›` rotit 90° când e deschis (tranziție CSS). Conținut cu hairline sus (`border-t #f2f2ef`), padding `4px 20px 22px`. API controlat: `open: boolean`, `onToggle: () => void`, `title`, `summary`, `children`. Fără bibliotecă de animație.

### `SegmentedControl` (client)
Grup de pill-uri pe track `#f0f0ec` (radius 12px, padding 5px); elementul activ: fundal alb, shadow subtil, text 600; inactive: 500 gri. API: `value`, `onChange`, `options: FieldOption[]` — identic cu `SelectField`. Înlocuiește `RadioGroup` pentru Tip corp și Tip front.

### Restilizări prin tokens
Inputuri/selecturi preiau noile tokens; inputurile numerice primesc `font-mono`. Etichetele câmpurilor devin micro-labels uppercase (600 11px, letter-spacing .04em, `#71717a`).

## 3. Pagina corp

### Layout
Grilă `1fr / 380px` (`lg:grid-cols-[1fr_380px]`), stack pe mobil. Titlu: „Corp: **C7**" — eticheta în `font-mono` 20px. Link „← Înapoi la proiect" în accent albastru.

### Stânga — 6 secțiuni accordion (default deschisă: doar `dimensiuni`)

| Secțiune | Conținut (logică neschimbată) | Sumar live (exemplu) |
|---|---|---|
| Identificare și dimensiuni | etichetă, tip corp (segmented), L/H/A + panou orb (colț), blat/fund | `C7 · Corp bază · 600 × 720 × 560` |
| Materiale și canturi | MaterialPickers + selecturi cant, avertisment materiale fără preț | `PAL alb W980 18mm · ABS 0.4mm` |
| Fronturi | tip front (segmented) + toate câmpurile condiționale (uși/polițe, sertare + înălțimi + tandembox, mâner, hint GOLA…) | `Uși · 1 ușă · 1 poliță · mâner ca proiectul` |
| Spate | checkbox cu spate, material + montaj | `Cu spate · PFL alb 3mm · în falț` / `Fără spate` |
| Feronerie | slot server-rendered (sugestii/overrides + acțiuni, ca azi) | `3 sugestii automate` / `Editată manual` |
| Piese suplimentare | slot server-rendered (listă + formular adăugare) | `Nicio piesă suplimentară` / `2 piese` |

Sumarele pentru primele 4 secțiuni se calculează în `CabinetEditorForm` din `values` (numele materialelor din snapshot). Sumarele Feronerie/Piese suplimentare vin ca props string de la pagina server.

Sub accordion: buton „Salvează corpul" (primary negru, ca azi funcțional); erorile de validare/salvare sub el. Alerta amber pentru referințe dezactivate rămâne deasupra întregii pagini.

### Sloturi server → client
`page.tsx` trimite în `CabinetEditorForm`:
- `feronerieSlot: ReactNode` + `feronerieSummary: string`
- `extraPartsSlot: ReactNode` + `extraPartsSummary: string`

JSX-ul server-rendered (cu `ActionForm`-urile existente) se randează în interiorul secțiunilor accordion — pattern standard de compoziție server/client. Acțiunile server nu se ating.

### Dreapta — sumar sticky (`sticky top-24`, doar pe lg+)
1. **Preț estimativ** — două carduri: Cost (fundal `#fafaf8`, border `#ececea`) și Preț vânzare (accent albastru). Cifre `font-mono` 600 22px, „lei" mic gri. Micro-label uppercase. Notă: „Estimativ — prețul final rotunjește foile pe proiect." Badge „valori invalide" păstrat.
2. **Avertismente** (expand warnings + erori estimare) — ca azi, stil amber.
3. **Piese generate** — tabel compact: header micro-labels uppercase, dimensiuni `font-mono` format `720×560`, coloane Piesă / Dim. (mm) / Buc / Material / Canturi, hairlines `#f4f4f2`.
4. **Previzualizare** — `CabinetIsoSvg` existent, card alb.

## 4. Ce NU se schimbă

Engine (`expandCabinet`), estimare, schema zod `cabinetFormSchema`, acțiunile server (`updateCabinetData`, `saveCabinetHardware`, `resetCabinetHardware`, `addExtraPart`, `removeExtraPart`), wiring-ul câmpurilor și starea formularului, comportamentul `MaterialPicker`, logica câmpurilor condiționale, structura celorlalte pagini (moștenesc doar fonturi/tokens).

## 5. Verificare (gate: tsc + build + smoke — fără teste noi, conform directivei 2026-07-14)

1. `npx tsc --noEmit`
2. `npm run build`
3. Smoke în browser: deschide un corp → toggle fiecare secțiune → schimbă tip front (Uși/Sertare/Fără) și verifică câmpurile condiționale → verifică actualizarea live a prețului, pieselor și sumarelor din headere → salvează → verifică Feronerie („Preia în editor") și Piese suplimentare (adaugă/șterge) → spot-check Proiecte, Setări, Cataloage și paginile de print pentru efecte ale tokens.

## Riscuri / decizii

- **Fundal cald global**: paginile care presupuneau gri neutru pot arăta diferit — acceptat, face parte din reskin; print-urile au `bg-white` local.
- **Micro-labels uppercase global vs. local**: se aplică prin restilizarea `Label`/`forms.tsx` folosită de toate paginile — acceptat, uniformizează aspectul.
- **Sticky pe mobil**: coloana sumar se stivuiește sub formular (fără sticky) sub `lg`.

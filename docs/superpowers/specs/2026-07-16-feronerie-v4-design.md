# Feronerie v4 — tabel unic cu override per rând

Data: 2026-07-16 · Decizii Andrew: toate produsele la Feronerie; override per
rând (restul rămâne viu); categorii noi: suporți poliță, cleme soclu, Aventos
(ușile suspendatelor rămân pe balamale implicit — ridicabile doar ca opțiune).

## Principiu

- **Fronturi = geometrie și configurație**: nr. uși/sertare + înălțimi, tipul
  de mâner (GOLA/J/FARA schimbă piesele), sistemul de sertare (Tandembox vs
  cutie PAL), înălțimea lateralei Tandembox, opțiunea nouă „deschidere
  verticală (Aventos)" la uși pe corp suspendat.
- **Feronerie = lista completă de produse a corpului**, un tabel unic, live în
  editor (client-side): rânduri generate automat din configurație, fiecare
  editabil pe loc (produs din select filtrat pe categorie + cantitate), cu
  indicator auto/manual și „revino la auto" per rând; plus rânduri adăugate
  manual (chips-urile existente).

## Sloturi (rânduri auto)

| slot | categorie | cantitate automată |
|---|---|---|
| `balamale` | BALAMA | per ușă după înălțime/greutate (2/ușă uzual); 0 la ușă ridicabilă |
| `maner` | MANER / ACCESORIU (push) | 1 per front (uși sau sertare) |
| `sertare` | SERTAR | 1 set per sertar (Tandembox pe boxHeight / glisiere pe nominală) |
| `picioare` | PICIOR | `legsPerCabinet` la BAZA/INALT/COLT |
| `suspendare` | SINA_SUSPENDARE | 1 set la SUSPENDAT |
| `suporti-polita` | SUPORT_POLITA (nou) | 4 × nr. polițe |
| `cleme-soclu` | CLEMA_SOCLU (nou) | 2 per corp la BAZA/INALT/COLT |
| `aventos` | PISTON_AVENTOS (nou) | 1 set per corp la ușă ridicabilă |

Ușă ridicabilă: `CabinetInput.doorOpening?: 'BALAMALE' | 'RIDICABILA'`
(checkbox la Fronturi, vizibil doar pe SUSPENDAT cu uși; implicit balamale).
La RIDICABILA: slotul balamale dispare, apare aventos.

## Model de date

`Cabinet.hardwareJson` — format nou:
```ts
interface HardwareAdjustments {
  slots?: Record<string, { itemId?: string; qty?: number }>; // doar abaterile
  extra?: HardwareLine[];                                    // adăugate manual
}
```
Rezolvarea (engine): `suggestHardware` emite sugestii cu `slot`;
`resolveSuggestions(suggestions, adjustments, defaults, items)` aplică per
slot: `itemId = adj?.itemId ?? preferred ?? default`, `qty = adj?.qty ??
auto`; `qty === 0` elimină rândul; extra se adaugă la final. Nerezolvat doar
când niciun itemId nu există.

Dispar: modul „Preia în editor" (override total), `overridesStale` +
`sameHardwareMultiset`, avertismentul de sugestii învechite. Se scot din
Fronturi: Model balamale, Nr. balamale, Produs mâner (custom), Nr. mecanisme,
Model glisiere → devin sloturile `balamale`/`maner`/`sertare`.
`hardwareSel.hingeId/hingeCount/handleCount` din inputJson dispar (migrate în
slots); rămân `tandemboxHeightMm` (config) și `handle.type` (+ itemId de
proiect ca fallback de produs pentru slotul maner).

Salvarea: tabelul face parte din CabinetEditorForm; adjustments se trimit la
„Salvează corpul" (updateCabinetData primește și hardwareJson). Chips-urile
scriu în `extra`.

## Catalog + Setări

- Categorii noi HardwareItem: `SUPORT_POLITA`, `CLEMA_SOCLU`, `PISTON_AVENTOS`
  (+ seed câte un produs de bază fiecare).
- AppSettings: `defaultShelfSupportId`, `defaultPlinthClipId`,
  `defaultAventosId` (+ selecturi în Setări, ca balamaua/piciorul).

## Migrare

`npm run db:migrate-hardware`: corpurile cu `hardwareJson` vechi (array
`HardwareLine[]` — 3 în DB azi) → per linie: dacă există slot auto cu aceeași
categorie → `slots[slot] = { itemId, qty }`; altfel → `extra`. Idempotent
(formatul nou se recunoaște după cheia `slots`/`extra`).
`hardwareSel.hingeCount/handleCount/hingeId` + `handle.itemId` de pe corpuri
(dacă există) se mută în `slots` la aceeași migrare.

## Ce nu se schimbă

- Piese suplimentare rămâne separat: piese DEBITATE extra, nu feronerie.
- Cardul „Feronerie necesară" din dreapta poate dispărea — tabelul din
  secțiunea Feronerie devine el însuși live (evităm dublarea).
- Snapshot-urile înghețate: computeQuote citește formatul nou; corpurile
  nemigrat rămân pe fallback legacy (arrayul vechi = extra integral) ca să nu
  crape ofertele vechi.

## Testare

Fără teste noi pe UI (directiva 2026-07-14); testele existente de engine se
adaptează la noul resolveSuggestions. Gate: tsc + build + smoke browser
(corp cu uși → editez balamale qty, schimb dimensiuni → restul rândurilor se
recalculează; suspendat cu ușă ridicabilă → aventos fără balamale; migrarea
celor 3 corpuri).

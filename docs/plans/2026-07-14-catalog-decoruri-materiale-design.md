# Catalog decoruri → Materiale (galerie + picker pe corp)

**Data:** 2026-07-14
**Status:** design validat

## Context

`data/decoruri-furnizori/catalog-decoruri.json` conține 640 decoruri (451 plăci + 189 blaturi)
pe 3 branduri (Egger, Kastamonu, AGT), cu imagine locală (`/decoruri/{brand}/*.jpg` în `public/`),
cod decor, denumire, structură și preț dealer. Azi e doar un dataset de referință + `galerie.html`;
nu e legat de aplicație.

Aplicația (Next 15 + Prisma/SQLite) are modelul `Material` (creat manual în `/cataloage/materiale`)
cu `name, kind, thicknessMm, sheet dims, pricingMode, price`. Corpurile referă materiale prin
`materialId` (carcasă/fronturi/spate/fund sertar). Engine-ul de costing citește materialele din
snapshot și le mapează prin `toBoardMaterial` (`lib/catalog/convert.ts`).

## Decizii (validate cu utilizatorul)

1. **Catalogul devine sursă directă de materiale** — seedăm decorurile în tabela `Material`
   (fără pas manual de import). Engine-ul rămâne neschimbat, doar are mai multe rânduri.
2. **Mapare kind:** Egger + Kastamonu → `PAL`; AGT → `MDF_MELAMINAT`; blaturile → `PAL` + `category=BLAT`.
3. **Blaturile** intră în galerie (filtru separat) dar **nu pot fi alese la corp** (fără slot de blat încă).
4. **Seedăm tot, inclusiv fără preț** — relaxăm validarea; materialele fără preț primesc badge „fără preț".
5. **Galeria** (`/cataloage/materiale`) devine shadcn cu poze + căutare + filtre, ca `galerie.html`.
6. **Selectoarele de material din corp** devin picker cu poză + căutare (combobox shadcn).

## 1. Model & seed

Extindem `prisma/schema.prisma` model `Material` cu coloane opționale (engine-ul le ignoră):

```
imageUrl   String?
decorCode  String?   // "U220 ST9"
brand      String?   // Egger | Kastamonu | AGT
structura  String?   // ST9, SM, ...
category   String  @default("PLACA")  // PLACA | BLAT
```

Migrare Prisma + `prisma generate`. `MaterialRow` (`lib/catalog/convert.ts`) rămâne compatibil —
câmpurile noi sunt pass-through, engine-ul nu le folosește.

Script `scripts/seed-decoruri.ts` (npm `db:seed-decoruri`), idempotent:
- citește `catalog-decoruri.json`
- id determinist `decor-{brand}-{cod_normalizat}` → **upsert** (re-rulabil fără dubluri)
- `kind`: Egger/Kastamonu → PAL, AGT → MDF_MELAMINAT, blat → PAL
- `category`: `tip==='placa'` → PLACA (grosime 18, foaie 2800×2070); `blat`/`panou_spate` → BLAT
  (grosime din `grosime_mm`, altfel 38)
- `name = "{cod_decor} · {denumire}"` (fallback `denumire`)
- `pricePerSheet = pret_ron` (poate fi null), `pricingMode = PER_SHEET`
- `imageUrl/decorCode/brand/structura` din catalog; `active=true`
- log: câte seedate / câte fără preț
- **nu atinge** materialele manuale existente (id-uri cuid, alt namespace)

## 2. Relaxare validare preț + warning

- `toBoardMaterial` (`lib/catalog/convert.ts`): preț null → `pricePerSheet/pricePerSqm = 0`
  (nu mai aruncă). Cost 0 determinist, oferta nu crapă.
- Helper `materialsWithoutPrice(input, snapshot)` → numele materialelor selectate fără preț.
- Badge/afișare „fără preț" (roșu) în:
  - cardul din galerie
  - picker-ul din editor corp (lângă materialul selectat)
  - linia de material din pagina Ofertă
- În editor corp și Ofertă: banner care listează materialele fără preț („apare cu 0 lei").

## 3. Galerie materiale (`/cataloage/materiale`)

- Server component încarcă materialele active → client `MaterialeGalerie`.
- Căutare (cod/denumire), filtre chips: brand, categorie (Plăci/Blaturi), kind. Contor rezultate.
- Grid carduri shadcn: thumbnail, cod, denumire, badge brand, preț sau „fără preț", kind/grosime.
- Editare (grosime/preț/dimensiuni) + „Adaugă manual" mutate în dialog per card / buton
  (păstrăm `updateMaterial`/`createMaterial`/`deactivateMaterial`).

## 4. Picker în editor corp (`CabinetEditorForm`)

- `MaterialPicker` = shadcn Popover + Command (combobox): thumbnail + cod + denumire, căutare, filtru brand.
- Înlocuiește `SelectField` doar la carcasă/fronturi/spate/fund sertar. Canturile rămân select simplu.
- Filtru `category !== 'BLAT'`. Citește din `snapshot.materials` (are toate câmpurile) +
  garantează prezența id-ului curent (fallback pentru materiale dezactivate, ca `optionsWithCurrent`).

## Riscuri / de urmărit

- **Preț 0 tăcut:** mitigat de badge + banner peste tot unde apare materialul.
- **Blaturi cu pricing per lungime:** seedate PER_SHEET dar excluse din corp → nu afectează costul.
  Feature-ul de blat pe corp e amânat (decizie ulterioară).
- **Volum DB:** ~451 plăci + 189 blaturi. Acceptabil pentru SQLite.
- **Re-seed vs. editări manuale:** upsert-ul suprascrie editările făcute pe rândurile seedate
  (grosime/preț). Documentat; re-seed doar la nevoie.

## Out of scope (iterare viitoare)

- Slot de blat pe corp + costing per lungime pentru blaturi.
- Gestionarea prețurilor lipsă (completare manuală în masă).
- Sincronizare automată catalog → DB la modificarea JSON-ului.

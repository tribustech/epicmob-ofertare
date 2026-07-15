# Fronturi MDF vopsit (și arhetipul „front finisat") — design

**Data:** 2026-07-15
**Status:** design validat (fără implementare)

## Context

Furnizorul **Paint Mob Design SRL** („Front Mob", paint-mob.ro, Bragadiru IF) oferă **fronturi MDF vopsite la comandă**. Materialele lui sunt în `MDF VOPSIT/`:
- `MDF Paint Offer.pdf` — lista de prețuri (per m²/ML/buc, EUR fără TVA).
- `Catalog Fronturi (1).pdf` — modele „Gama FRONT" (mostre fizice): R1–R7 (riflaje), F1–F24 (frezate clasice), M1–M3 (mâner integrat).
- `Catalog Paint Mob Dec 6 2023.pdf` — modele „Gama FAGG" (randări): Colecția Clasic (G10, M10, V90, V120 + variante -A/-R), Modern (KV5, KG63, KM44, KS8, KR28, KL5), Line (LV55, LM66), Uși Dressing (D1–D4), perforate F1–F3.

**Verificat (căutare web):** MDF vopsit e o industrie standard în RO (zeci de furnizori: ifront, front-vopsit, Transilvania Front, Global Design etc.), toți cu colecții Clasic/Modern și culori RAL/NCS, cotare per m². **Formele** (shaker/clasic, riflaj, arcuit, mâner-gola, perforat) sunt universale; **codurile** (F2, R1, G10, KV5…) și **prețurile** sunt **specifice Paint Mob** — nu se regăsesc la alți furnizori (ex. Global Design folosește coduri de tip `FMDF101P (Paris)`).

Nu există **paletar de culori** în folder — culorile sunt **RAL** (vezi `data/ral/`).

## Principiul de modelare

Separăm trei lucruri azi amestecate:
- **Forma** (universală): `PLAN · CLASIC · RIFLAJ · MANER · PERFORAT` — *ce* e frontul.
- **Finisajul de preț**: mat/lucios × nr. fețe × culoare RAL + suprataxe — *manopera de finisare*.
- **Furnizorul**: cine îl face, cu **codul lui** (F2, G10…) și **lista lui de prețuri**.

Același „clasic cu ramă" e o formă la orice furnizor; Paint Mob îi zice `F2`/`M10`. Codul = etichetă de identificare + cheie spre prețul acelui furnizor.

## Decizii (validate cu utilizatorul)

1. **Tipul frontului = `kind` explicit** (fiecare separat, nu lumped): `PAL · MDF_MELAMINAT · MDF_INFOLIAT · MDF_VOPSIT` (aliniat cu `Material.kind`). Carcasa: la fel, orice material-placă (rămâne mereu placă; carcasă vopsită = out of scope).
2. **Două arhetipuri de cotare:**
   - **PLACĂ** (per foaie, catalog decor + cant): PAL, MDF melaminat — **există azi** prin `Material` + `MaterialPicker`.
   - **FRONT FINISAT** (per m², furnizor + model-formă): MDF vopsit (**acum**), MDF infoliat (**mai târziu**, cu furnizorul lui).
3. **Vopsit și infoliat împart aceeași mașinărie** (`FrontSupplier`/`FrontModel`/`FrontPrice`), cu discriminator `productType: VOPSIT | INFOLIAT`. Diferă doar atributele de finisaj (vopsit: mat/lucios + RAL; infoliat: folie/decor). Implementăm **vopsit complet acum**; infoliat = date + un furnizor, fără schemă nouă.
4. **Granularitate preț: matrice completă** — `tier` (nivel frezare) × `finish` (mat/lucios) × `faces` (1/2). Fidel ofertei.
5. **Monedă:** prețuri stocate în **EUR**; conversie în RON la afișare/ofertă printr-un **curs `eurToRon`** din setări (actualizabil).
6. **Coloană preț: „cu MDF"** (la cheie — placă + vopsire). „fără MDF" — mai târziu, dacă e nevoie.
7. **Suprataxe modelate acum:** frezare mâner J/T (per buc) + culoare (vie +13€/mp, metalizat +36€/mp, negru lucios +6€/mp/față). Comenzi mici — mai târziu.
8. **Categoria de culoare = alegere manuală cu sugestie**, nu detecție automată (oferta dă doar exemple „și altele de acest gen"). Cele 17 coduri RAL vii din ofertă sunt marcate `vivid` în paletar → UI sugerează „vie", overridable.

## Model de date

### Tabele noi (catalog furnizor „front finisat")

**`FrontSupplier`** — `id, name, productType (VOPSIT|INFOLIAT), currency (EUR), active`
+ constante suprataxă: `handleMillingEur, vividSurchargeEur, metallicSurchargeEur, blackGlossEurPerFace`.

**`FrontModel`** — forma cu codul furnizorului:
`id, supplierId, code (F2/R1/G10…), name, shapeFamily (PLAN|CLASIC|RIFLAJ|MANER|PERFORAT), tier (PLAN|SIMPLU|MEDIU|COMPLEX|RIFLAJ|PERFORAT), collection (Clasic|Modern|Line), hasHandleMilling (bool), imageUrl, active`.
Maparea **cod → tier** vine din ofertă (ex. F2/F3/F7 = SIMPLU; G10/M10/V90/V120 = MEDIU; KV5/KS8/KL5 = COMPLEX; KM44/KR28/KG63 = COMPLEX; R1–R7 = RIFLAJ; F1/F2/F3 perforate = PERFORAT).

**`FrontPrice`** — matricea per furnizor:
`id, supplierId, tier, finish (MAT|LUCIOS), faces (1|2), pricePerSqmEur` (coloana „cu MDF"). Unic pe `(supplierId, tier, finish, faces)`.

### Setări
`AppSettings.eurToRon: Float` (curs BNR, actualizabil).

### Referință (deja construită)
- **Paletar RAL Classic**: `data/ral/ral-classic.json` (216 culori: code, hex, rgb, group, `vivid`, `black`) + `public/ral/galerie.html` (galerie căutabilă) + `data/ral/build_ral.py`.
- **Galerie forme** (poze modele din PDF-uri) — de extras în `public/` ca la decoruri (iterare de implementare).

### Pe corp (`Cabinet.inputJson`, nu schemă nouă)
Frontul capătă:
```
frontKind: 'PAL' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT' | 'MDF_VOPSIT'
// kind placă → frontMaterialId (ca azi) + edgeBands.frontPerimeterId
// MDF_VOPSIT → mdfFront + frontMaterialId=null + frontPerimeterId=null
mdfFront?: {
  supplierId, modelId,
  finish: 'MAT' | 'LUCIOS',
  faces: 1 | 2,
  ralCode: string,                       // ex. "RAL 7016"
  colorCategory: 'NORMALA' | 'VIE' | 'METALIZAT',
}
```

## Costing (front MDF vopsit)

Motorul calculează deja aria fronturilor `A` (m²) și numărul `N`.
```
pretMp     = FrontPrice(supplierId, model.tier, finish, faces).pricePerSqmEur
suplCuloare = colorCategory==='VIE' ? vividSurchargeEur
            : colorCategory==='METALIZAT' ? metallicSurchargeEur : 0
suplNegru   = (finish==='LUCIOS' && ralBlack(ralCode)) ? blackGlossEurPerFace * faces : 0
frezManer   = model.hasHandleMilling ? handleMillingEur * N : 0
costFront_EUR = A * (pretMp + suplCuloare + suplNegru) + frezManer
costFront_RON = costFront_EUR * settings.eurToRon
```
- Fronturile vopsit **nu** intră în costul de placă și **nu au cant** — înlocuiesc acele linii.
- `costFront_RON` e **cost de material** → intră în baza pe care se aplică `laborPct` (ca o placă). Restul corpului neschimbat.
- Engine: `computeCosts` rutează costul pieselor-front după `frontKind` (placă → material din catalog; vopsit → formula de mai sus). Aria frontului = suma ariilor pieselor-front.

## UI pe corp (`CabinetEditorForm`)

Când corpul are fronturi (USI/SERTARE/GOLA), apare **„Tip front"**: `PAL · MDF melaminat · MDF infoliat (curând) · MDF vopsit`.
- **kind placă** → `MaterialPicker` (filtrat pe kind) + canturi — ca azi.
- **MDF vopsit** → **Furnizor** · **Model/formă** (picker cu poză, grupat pe colecție) · **Finisaj** (mat/lucios) · **Nr. fețe** (1/2) · **Culoare RAL** (picker din paletar) · **Categorie culoare** (auto-sugerată din `vivid`, overridable). Cantul dispare. Preț live.

Carcasa: rămâne `MaterialPicker` (placă), neschimbată.

## Scop / out of scope

**Acum:** MDF vopsit, fronturi-panou per m² (matrice tier×finish×faces), frezare mâner, suprataxe culoare, paletar RAL, curs EUR→RON.

**Ulterior (fără reproiectare):**
- MDF infoliat (`productType=INFOLIAT`, furnizor + folie).
- Piese liniare per ML (cornișe, lezene, plinte <120mm) + „corpuri vopsite exterior".
- Coloana „fără MDF" (clientul dă placa).
- Comenzi mici (<3m²/culoare, <1m² total).
- Galeria de forme (poze modele) extrasă din PDF-uri.
- NCS pe lângă RAL.

## Riscuri

- **Preț per furnizor:** codurile/prețurile sunt SKU-uri Paint Mob — de tratat ca sursă de preț (ca Darel/Trady la decoruri), nu standard universal.
- **Categorie culoare** rămâne judecată umană (sugestia din `vivid` acoperă doar cele 17 din ofertă).
- **Curs valutar** afectează toate ofertele cu vopsit — un singur `eurToRon` global, de actualizat periodic.

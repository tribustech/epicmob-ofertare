# Catalog decoruri furnizori (PAL + MDF melaminat)

Date extrase din site-urile furnizorilor pentru a putea căuta decoruri și compara prețuri
în aplicație atunci când clientul cere o anumită culoare.

**Data extragerii:** 2026-07-11
**Total:** 586 decoruri (578 cu preț)

## Fișiere

- `catalog-decoruri.json` — **CATALOG VIZUAL** pe cele 3 branduri țintă (Egger, Kastamonu, AGT), cu imagine locală + preț dealer. Vezi mai jos.
- `../../public/decoruri/galerie.html` — **galerie vizuală** căutabilă (deschide direct în browser)
- `../../public/decoruri/{egger,kastamonu,agt}/*.jpg` — thumbnail-uri 300px per decor
- `decoruri.json` — datasetul brut de prețuri per furnizor (Darel + Trady, toate brandurile)
- `decoruri.csv` — același dataset pentru Excel / verificare manuală

## catalog-decoruri.json (Egger + Kastamonu + AGT, cu imagini)

**640 produse** pe cele 3 branduri cerute — **451 plăci** (PAL/MDF) + **189 blaturi** de bucătărie.
Fiecare rând: `brand, cod_decor, cod_normalizat, denumire, structura, image` (cale locală `/decoruri/...`
sau null), `image_source_url, pret_ron, pret_furnizor, tip`. Blaturile au în plus
`dimensiuni, grosime_mm, latime_mm, categorie`.

`tip`: `placa` (PAL/MDF panou) · `blat` (blat de bucătărie) · `panou_spate` (splashback Kastamonu).
Galeria are filtru Plăci/Blaturi. Blaturile sunt un produs separat (se ofertează per lungime,
lățimi 600/635/650/920mm, grosimi 12/20/28/38mm) — de tratat distinct de plăci în app.

**Blaturi:** Egger 100 (Darel: 600mm, 650mm, laminat compact) + Kastamonu 89 (Trady: blaturi +
panouri de spate). Toate cu imagine + preț.

Prețul e atașat pe `cod_normalizat` din datasetul de dealeri (Egger←Darel, Kastamonu←Trady).

Acoperire (extragere 2026-07-14):

| Brand | Decoruri | Cu imagine | Cu preț | Sursă imagini |
|---|---:|---:|---:|---|
| Egger | 156 | 151 | 149 | palhause.ro + darel.ro |
| Kastamonu | 160 | 149 | 147 | palhause.ro + trady.ro |
| AGT | 135 | 134 | 66 | woodcadesign.com + trady.ro |
| **Total** | **451** | **434** | **362** | |

Imaginile lipsă (palhause dă placeholder) au fost completate din paginile de produs ale dealerilor:
Egger din darel.ro (Magento, thumbnail 170px), Kastamonu + AGT din trady.ro
(Odoo: `https://trady.ro/web/image/product.template/{id}/image_1024`). Kastamonu extins de la 80 la 160
(acoperirea Trady). Prețurile AGT legate pe cod numeric de la Trady (`AGT-3094` → `3094`).

**Goluri rămase:** 17 fără imagine (Egger W980 ST2/SM nu există pe darel; câteva variante TM;
~11 Kastamonu). AGT are 66/135 cu preț — restul sunt decoruri din catalogul AGT (woodca) pe care
Trady nu le ține pe stoc, deci n-au preț la dealerii noștri.

Regenerare (scripturi în `scripts/`): `build_catalog.py` (download+resize+merge pe cod) →
`merge_agt_prices.py` → `fill_agt_images.py` / `fill_kasta.py` / `fill_egger.py` → `build_gallery.py`.
Datele brute per sursă sunt în `raw/`.

## Schema fiecărui rând

| câmp | descriere |
|---|---|
| `furnizor` | `Darel` sau `Trady` |
| `brand` | Egger / Kastamonu / AGT / Gizir / Yildiz / Evogloss / "MDF laminat (generic)" |
| `cod_decor` | codul de decor al producătorului (ex. `U222 ST9`, `A804PS17`); `null` unde nu e afișat |
| `cod_normalizat` | `cod_decor` fără spații/liniuțe, uppercase (ex. `U222ST9`) — **cheia de căutare și de comparație pe cod** |
| `denumire` | numele culorii/decorului |
| `structura` | finisaj (ST9, SM, mat, high gloss, supermat, PerfectSense...) |
| `grosime_mm` | grosime placă (mm) — adesea `null` la Darel (nu apare în listare) |
| `dimensiuni` | dimensiune placă — completă la Trady, `null` la majoritatea Darel |
| `pret_ron` | prețul afișat pe site (per foaie) |
| `pret_mp_ron` | preț/m² calculat, doar unde avem dimensiunile plăcii |
| `stoc` | text stoc dacă e afișat |
| `categorie` | subcategoria din site |
| `pricing_mode` | `PER_SHEET` (toate prețurile sunt per foaie) |

## Sumar pe furnizor / brand

- **Darel = 248** (Egger 192 + MDF laminat generic 56)
  - PAL culori uni 66, PAL decor lemn 82, PAL fantezie 13, PerfectSense Matt 10, Feelwood 5
  - MDF Egger PerfectSense 16, MDF laminat lucios/mat/supramat 72
- **Trady = 338** (Kastamonu 157, Gizir 70, AGT 60, Yildiz 29, Evogloss 22)

## ⚠️ Avertismente importante

1. **Comparația se face pe `cod_normalizat`, nu pe nume.** Verificat pe date:
   **0 coduri identice între Darel și Trady.** Motiv structural — Darel vinde **Egger**
   (coduri `U/H/W… ST…`), Trady vinde **Kastamonu / AGT / Gizir / Yildiz / Evogloss**
   (coduri `A/D/F…PS…`), sisteme disjuncte. Consecință: cu acești doi furnizori, fiecare este
   practic un catalog separat; comparația de preț pe cod produce potriviri doar când:
   (a) adaugi **alt magazin cu același brand** (alt dealer Egger lângă Darel, alt dealer
   Kastamonu lângă Trady), sau (b) variante de grosime/finisaj în cadrul aceluiași furnizor.
   → Pentru comparație reală de preț: **adaugă furnizori suplimentari per brand**, nu branduri noi.
2. **172 rânduri nu au `cod_decor`** (panourile Trady AGT/Gizir/Yildiz/Evogloss și MDF-ul Darel
   se listează doar cu nume de culoare). Pentru acestea, join-ul pe cod este imposibil în principiu.
2. **Swiss Krono** era gol pe trady.ro la data extragerii (categorie fără produse).
3. **Un decor Darel lipsă** — "PAL decor lemn" are un decor ST19 (~534 lei) ascuns de un bug de
   paginare al site-ului; 82 din 83 extrase.
4. **Dimensiuni/grosimi Darel** — nu apar în paginile de listare; ar necesita accesarea fiecărei
   pagini de produs individual. Standard uzual Egger PAL: 2800×2070, grosimi 10/16/18 mm.
5. **Prețuri** — cele afișate public pe site; nu e clar dacă includ TVA. De verificat înainte de
   folosire în oferte reale. Datele sunt un snapshot — necesită reîmprospătare periodică.

## Notă de integrare (vezi discuția din task)

Modelul `Material` din `prisma/schema.prisma` este operațional (folosit direct în ofertare,
1 preț/foaie) și NU are câmpuri de cod decor / brand / furnizor. Acest dataset este un
**catalog de referință** separat. Opțiuni discutate: (A) model Prisma nou `DecorPrice` pentru
căutare/comparație + buton "folosește în ofertă" care creează un `Material`; (B) fișier static
citit de un ecran de căutare. De ales împreună.

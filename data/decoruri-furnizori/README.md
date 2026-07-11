# Catalog decoruri furnizori (PAL + MDF melaminat)

Date extrase din site-urile furnizorilor pentru a putea căuta decoruri și compara prețuri
în aplicație atunci când clientul cere o anumită culoare.

**Data extragerii:** 2026-07-11
**Total:** 586 decoruri (578 cu preț)

## Fișiere

- `decoruri.json` — dataset complet, gata de import/seed
- `decoruri.csv` — același dataset pentru Excel / verificare manuală

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

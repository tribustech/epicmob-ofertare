# Fronturi false + formula 1-2-1

Data: 2026-07-19 · Validat cu Andrew în brainstorming.

## Ce construim

1. **Fronturi false verticale** setabile în mm pe orice corp cu uși: piese fixe de PAL
   (fără balamale/glisiere), pe stânga și/sau dreapta, folosite de ex. la colțuri unde
   sertarele corpului vecin au nevoie de loc să se deschidă. Ușile se calculează automat
   pe lățimea nominală rămasă.
2. **Formula de lufturi trece global la 1-2-1**: 1mm la marginile corpului, 2mm între
   fronturi (azi: 2mm exterior / 3mm între).
3. **Panoul orb de la COLȚ dispare** ca concept separat — devine un front fals
   precompletat.
4. **Bon de calcul (`calc`) pe fronturi** — ușile, fronturile de sertar și falsurile
   primesc derivarea cotei, vizibilă în configuratorul 3D (închide bug-ul „la 2 uși nu
   apare calculul").

Decizii luate: fals doar vertical (nu orizontal — cazul „chiuvetă" nu e folosit); fals
doar la corpuri cu uși, nu la sertare (cutia ar cere laterală falsă — mutat în
`toDiscuss.md`); falsul se montează la ras cu marginea corpului și pierde doar 1mm spre
frontul vecin (întrebarea de confirmare cu experții e în `toDiscuss.md`).

## Modelul de lufturi (felii nominale)

Fiecare front primește o „felie" nominală din lățimea corpului; la tăiere, un front care
se deschide pierde 1mm pe fiecare parte, iar un fals pierde 1mm doar spre vecin (la
marginea corpului stă la ras). Rezultă 1mm la margini și 1+1 = 2mm între fronturi.

Exemplu: corp 900, fals stânga 100, 2 uși:

```
fals = 100 − 1 = 99 (la ras cu marginea stângă)
zona uși nominal = 900 − 100 = 800 → felii de 400 → uși de 398 + 398
verificare: 99 + 2 + 398 + 2 + 398 + 1 = 900 ✓
```

General, pentru `doors` uși cu fals stânga `fS` și dreapta `fD` (0 = lipsă):

```
piesă fals = f − frontGapMm/2                       (pe fiecare parte cu fals)
luft stânga = fS > 0 ? frontGapMm/2 : outerGapMm     (idem dreapta)
lățime ușă = (W − fS − fD − luft stânga − luft dreapta − (doors−1)·frontGapMm) / doors
```

Cu constantele noi `outerGapMm = 1`, `frontGapMm = 2`. Pe verticală nu se schimbă nimic
structural — `2·outerGapMm` scade din înălțime ca și azi, doar valoarea e alta.

## Schimbări pe componente

### Motor (`lib/engine`)

- `constants.ts`: `outerGapMm: 2→1`, `frontGapMm: 3→2`; `blindPanelDefaultWidthMm`
  rămâne (folosit ca default de fals la COLȚ).
- `types.ts`: pe `CabinetInput` dispare `blindPanelWidthMm`, apare
  `falseFronts?: { stangaMm?: number; dreaptaMm?: number }`. Chei noi de piesă
  `fals:stanga` / `fals:dreapta` în loc de `panou-orb`.
- `fronts.ts`: implementarea formulei de mai sus; piesele de fals cu nume „Front fals",
  material de front, cant perimetral după aceleași reguli ca ușile (MDF vopsit/înfoliat
  = fără cant), înălțime egală cu ușile (inclusiv deducerile GOLA/extensie). Validare:
  fals < 0 sau falsuri + lufturi ≥ lățimea corpului → eroare. Ușile, fronturile de
  sertar și falsurile primesc `calc` (DimCalc pe lungime și lățime).
- Falsul NU intră în `fronts[]` (`FrontInfo`) → zero balamale/mânere/Aventos, ca panoul
  orb azi. Fallback legacy: la citirea unui `inputJson` vechi de COLȚ cu
  `blindPanelWidthMm`, valoarea se mapează pe `falseFronts.stangaMm` (în același loc cu
  celelalte fallback-uri legacy).
- `costing.ts`: în `FRONT_PART_NAMES`, „Panou orb" → „Front fals".
- `placement.ts`: `fals:stanga` la `x = 0`, `fals:dreapta` lipit de marginea dreaptă,
  ușile încep după piesa de fals + luft; cazul special `panou-orb` dispare.

### Izometrie (`lib/iso/geometry.ts`)

Cazul special de COLȚ cu `blindPanelWidthMm` se înlocuiește cu desenarea falsurilor pe
orice corp care le are.

### Formular corp (`lib/quote/cabinet-form.ts`, `components/CabinetEditorForm.tsx`, `app/proiecte/[id]/corp/[cabinetId]/page.tsx`)

- Câmpul „Panou orb (mm)" dispare. În secțiunea Fronturi, vizibile doar la
  `frontType === 'USI'`: „Fals stânga (mm)" și „Fals dreapta (mm)", goale = fără fals.
- Corp nou de COLȚ: falsul de stânga se precompletează cu
  `blindPanelDefaultWidthMm` din setări.
- La încărcarea unui corp vechi cu `blindPanelWidthMm`, formularul îl afișează ca fals
  stânga.

### Setări (`app/setari/page.tsx`)

Eticheta setării devine „Front fals implicit la colț (mm)".

### Configurator 3D (`components/configurator`)

Piesele de fals apar ca orice piesă de front (selectabile, override-uri, ochi); bonul
`calc` devine vizibil în `PiecePanel` pentru toate fronturile.

## Ce NU facem acum

- Fals la corpuri cu sertare (cutie îngustată + laterală falsă) — `toDiscuss.md`.
- Fals orizontal (tip corp de chiuvetă) — nefolosit în atelier.
- Feronerie/manoperă pentru fixarea falsului — depinde de răspunsul experților
  (`toDiscuss.md`).

## Efecte și verificare

- Toate cotele de fronturi existente se schimbă la recalculare (uși ~2mm mai late,
  fronturi de sertar ~2mm mai înalte) — asumat, e corecția dorită.
- Corpurile de COLȚ pierd luftul exterior de pe partea falsului (~2-3mm diferență) —
  comportamentul corectat.
- Testele existente care verifică cote 2-3-2 se actualizează la 1-2-1. Fără teste noi
  (directiva „fără teste până la final"); gate: `tsc` + build + smoke manual în app
  (corp cu 2 uși + fals, corp COLȚ vechi, corp cu sertare).

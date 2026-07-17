# Configurator piese 3D — configurare per piesă (canturi, pazii, piese libere)

Data: 2026-07-17 · Decizii Andrew: cant per muchie per bucată individuală, pe
toate piesele corpului; model hibrid sloturi + piese libere; capac plin /
pazii / absent (pazii = 2 traverse orizontale, lățime configurabilă); UI =
bottom sheet permanent în editorul corpului, tras în sus devine layout „trei
zone" (Piese | 3D | Configurare); dimensiuni afișate cu derivare + override
manual; motorul rămâne sursa adevărului; fără migrare (suntem în development).
Branch: `feat/configurator-piese`.

Origine: discuția cu business ownerul (`intrebari.md` r.15–16, 21, 34, 92–93,
99) — ex. blat/fund aplicat cu ABS 2mm cere ABS 0.4 pe laterală ca îmbinarea
să se pupe; corpurile sub blat nu au capac, ci pazii de 80–100mm.

## Principiu

- **Motorul rămâne sursa adevărului.** Dimensiunile pieselor se derivă din
  formulele existente; configuratorul scrie doar abateri semantice în inputul
  corpului (`CabinetInput.pieces`) și totul se re-expandează. Cutlist,
  nesting, costing, feronerie consumă în continuare ieșirea motorului.
- **Se salvează doar ce s-a atins** (tiparul `HardwareAdjustments`): override
  per bucată, cheiat pe identitate stabilă; cheile dispărute se ignoră.
- **UI-ul e configurator-centric**: orice click în 3D sau în listă editează
  inputul și scena se re-randează live.

## Model de date (`lib/engine/types.ts`)

```ts
/** Laturi semantice; fiecare piesă folosește exact 4 dintre ele, după
 *  orientare: laterală = fata/spate/sus/jos; blat/fund/poliță/pazie =
 *  fata/spate/stanga/dreapta; front/spate corp = sus/jos/stanga/dreapta. */
export type EdgeSide = 'fata' | 'spate' | 'sus' | 'jos' | 'stanga' | 'dreapta';

/** Cheie stabilă de bucată: 'laterala:0', 'laterala:1', 'blat-corp',
 *  'fund-corp', 'pazie-fata', 'pazie-spate', 'polita:2', 'spate',
 *  'front:0', 'sertar:1:laterala', 'libera:<id>' … */
export type PieceKey = string;

export interface PieceOverride {
  edges?: Partial<Record<EdgeSide, string | null>>; // id EdgeBand; null = fără cant
  materialId?: string;
  lengthMm?: number;  // override manual; lipsă = auto
  widthMm?: number;
  removed?: boolean;  // piesa nu se generează (și nu intră în cutlist)
}

export interface FreePiece {
  id: string;          // generat la adăugare
  name: string;
  lengthMm: number;    // fixe — nu se recalculează la redimensionarea corpului
  widthMm: number;
  qty: number;
  materialId: string;
  edges?: Partial<Record<EdgeSide, string | null>>;
}

export interface PiecesConfig {
  top?: { variant: 'PLIN' | 'PAZII' | 'ABSENT'; pazieWidthMm?: number }; // default PLIN; pazie default 100mm (ConstructionConstants.pazieDefaultWidthMm)
  overrides?: Record<PieceKey, PieceOverride>;
  free?: FreePiece[];
}

// CabinetInput += pieces?: PiecesConfig
```

`PartEdges` (l1/l2/w1/w2) dispare din `Part` și e înlocuit cu muchii semantice
+ maparea la laturile de debitare, calculată de motor per piesă (fără fallback
— inputurile din development se regenerează):

```ts
export interface PieceInstance {          // înlocuiește Part la nivel de expand
  key: PieceKey;
  cabinetLabel: string;
  name: string;                           // 'Laterală stânga', 'Pazie față' …
  lengthMm: number; widthMm: number;      // după override, dacă există
  materialId: string;
  edges: Partial<Record<EdgeSide, string>>; // doar muchiile cu cant
  edgeAxis: Partial<Record<EdgeSide, 'L' | 'W'>>; // cele 4 laturi aplicabile piesei → latura de debitare
  manual?: { lengthMm?: boolean; widthMm?: boolean; edges?: EdgeSide[]; material?: boolean };
  calc?: { length?: DimCalc; width?: DimCalc };
  placement: PiecePlacement;
  free?: boolean;
}

export interface PiecePlacement {         // mm, originea = colțul din față-stânga-jos al corpului
  x: number; y: number; z: number;        // poziția colțului piesei
  w: number; h: number; d: number;        // gabaritul 3D (grosimea = thicknessMm material)
}
```

## Motor

- `expandCarcass` (+ fronts/drawers/blind panel) emit **bucăți individuale**:
  `Laterală stânga` și `Laterală dreapta` separat (nu qty 2), fiecare poliță cu
  indexul ei. Cheile sunt deterministe și stabile la regenerare.
- **Slot capac:** `PLIN` = comportamentul actual; `PAZII` = 2 piese
  (`pazie-fata`, `pazie-spate`), orizontale, lungime = lățimea interioară
  (sau W la montaj aplicat), lățime = `pazieWidthMm`; `ABSENT` = nimic.
  Fundul, lateralele, spatele, polițele rămân sloturi cu prezență implicită,
  eliminabile prin `removed`.
- **Aplicarea override-urilor** după generare, într-un pas separat
  (`lib/engine/pieces.ts`): canturi, material, dimensiuni, removed; piesele
  libere se adaugă la final. Override pe cheie inexistentă = ignorat.
- **Plasare 3D** (`lib/engine/placement.ts`): poziții derivate din aceleași
  formule (laterale la extreme, blat/fund sus/jos după INCADRAT/APLICAT,
  polițe distribuite pe înălțime, spate în spate, fronturi în față cu
  rosturile lor, pazii sub planul capacului). Piesele libere se listează, dar
  nu se randează în 3D (nu au poziție semantică) — apar doar în listă.
- **Canturi default** (neatinse de override): exact regulile de azi — muchia
  frontală a carcasei cu `carcassFrontEdgeId`, perimetrul fronturilor PAL cu
  `frontPerimeterId` — exprimate acum pe muchii semantice.
- **Cutlist/nesting/costing neschimbate:** un adaptor regrupează
  `PieceInstance[]` identice (aceleași dimensiuni/material/canturi) în rânduri
  cu qty; metrajul de cant se calculează din muchiile semantice via `edgeAxis`.
- `ConstructionConstants += pazieDefaultWidthMm` (default 100).

## UI — bottom sheet permanent (`components/configurator/`)

- **Peek** (mereu vizibil jos în `CabinetEditorForm`): mini-preview 3D static
  + rezumat („8 piese · 2 cu override"); tras în sus (sau click) → full-screen.
- **Full = trei zone:**
  - *Stânga — lista pieselor:* toate bucățile cu nume, L×l, indicator de
    override; rând „+ piesă liberă"; selecție sincronizată cu 3D-ul.
  - *Centru — viewport 3D:* react-three-fiber + drei (`OrbitControls`), piese
    ca boxuri cu material-culoare simplă, hover highlight, click = selecție,
    piesa selectată evidențiată + **cote de dimensiuni** randate pe ea.
  - *Dreapta — panoul piesei:* material (select), canturile celor 4 muchii
    (select cant / „fără"), dimensiuni cu formula desfăcută (termenii din
    `calc`) + override manual cu marcaj „manual" și „revino la auto",
    **sugestii** (chips): „ABS 0.4 peste tot", „2mm pe muchia vizibilă",
    „fără cant", „elimină piesa"; la capac: comutatorul plin/pazii/absent +
    lățime pazie; la piese libere: toate câmpurile editabile + ștergere.
- Dependințe noi: `three`, `@react-three/fiber`, `@react-three/drei` —
  încărcate cu `next/dynamic` (client-only) ca să nu umfle restul paginilor.
- Tabelul „Piese" existent din editor rămâne momentan (sursă comună de date);
  decidem la final dacă îl scoatem.

## Cazuri acoperite din intrebari.md

- r.15–16: laterale cu ABS 2mm pe muchia vizibilă, 0.4 pe rest — override cant.
- r.92: corp sub blat fără capac, pazii 80/100mm — slot capac `PAZII`.
- r.93: la corpuri mici paziile rămân orizontale (defaultul nostru).
- r.99: cuptor — capac `ABSENT`/`PAZII` + piese libere pentru susținere.
- r.34: poliță sticlă — material override + dimensiune manuală (−2mm/parte).
- r.21: retragere poliță variabilă — override de lățime pe poliță (soluția
  completă cu default configurabil rămâne backlog).

## Ce nu se schimbă / nu e în scop

- Nesting, costing, feronerie, ofertare — neatinse (primesc aceleași date).
- Restul itemelor din `intrebari.md` (ansambluri, șuruburi Ericsson, fibra
  plăcii, fronturi false etc.) — backlog separat.
- Fără migrare de DB sau fallback la formatul vechi de edges — development.

## Fazare și testare

1. **Faza 1 — motor:** tipuri, bucăți individuale + chei, override-uri, pazii,
   piese libere, placement; adaptorul pentru cutlist. Testele de engine
   existente se adaptează (nu se scriu teste noi — directiva 2026-07-14).
2. **Faza 2 — UI:** bottom sheet, viewport 3D, panou, sugestii.
   Gate per fază: `tsc + build + smoke` (corp de bază: capac→pazii, ABS 2mm pe
   laterală vizibilă + 0.4 rest, poliță sticlă cu −2mm manual, piesă liberă;
   verificat că cutlist-ul și totalurile reflectă modificările).

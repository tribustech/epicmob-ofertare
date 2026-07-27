// Unități: dimensiuni în mm, arii în m², cant în ml, bani în RON.

export type MaterialKind = 'PAL' | 'MDF_VOPSIT' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT' | 'PFL';

export type PricingMode =
  | { mode: 'PER_SHEET'; pricePerSheet: number }
  | { mode: 'PER_SQM'; pricePerSqm: number };

export interface BoardMaterial {
  id: string;
  name: string;
  kind: MaterialKind;
  thicknessMm: number;
  sheetLengthMm: number;
  sheetWidthMm: number;
  pricing: PricingMode;
}

export interface EdgeBand {
  id: string;
  name: string;
  thicknessMm: number;
  pricePerMl: number;
}

export type HardwareCategory =
  | 'BALAMA'
  | 'SERTAR'
  | 'MANER'
  | 'PICIOR'
  | 'SINA_SUSPENDARE'
  | 'SUPORT_POLITA'
  | 'CLEMA_SOCLU'
  | 'PISTON_AVENTOS'
  | 'HOLTSURUB'
  | 'ACCESORIU';

export interface HardwareItem {
  id: string;
  name: string;
  category: HardwareCategory;
  pricePerUnit: number;
  nominalLengthMm?: number;
  loadClassKg?: number;
  boxHeightMm?: number;
}

export interface ConstructionConstants {
  frontGapMm: number;              // rost între fronturi
  outerGapMm: number;              // rost la marginea corpului (per latură)
  shelfSetbackMm: number;          // retragere poliță față de front
  backRebateMm: number;            // reducere spate în falț (per axă)
  boardDensityKgPerSqmPerMm: number; // greutate placă per m² per mm grosime
  slideClearanceMm: number;        // spațiu între glisieră și spatele corpului
  slideNominalsMm: number[];       // lungimi nominale glisiere disponibile
  palBoxSlideAllowanceMm: number;  // spațiu total lateral cutie sertar PAL (2×13)
  palBoxHeightDeductMm: number;    // înălțime cutie = front − această valoare
  palBoxMinHeightMm: number;       // înălțime minimă cutie
  legsPerCabinet: number;          // picioare per corp cu picioare
  screwAllowanceMm: number;        // rezervă șurub (holtșurub) la corpurile cu spate PFL — se scade din adâncime
  shelfSpanWarnMm: number;         // avertizare poliță peste această deschidere
  doorMaxWidthMm: number;          // avertizare ușă peste această lățime
  blindPanelDefaultWidthMm: number; // lățime implicită panou orb la corpurile de colț
  tandemboxFrontClearanceMm: number; // rezervă: laterala Tandembox ≤ front − această valoare
  golaFrontDeductMm: number;         // GOLA: scurtarea fronturilor (profilul ocupă din înălțime)
  frontExtensionDefaultMm: number;   // „fără mâner": prelungirea implicită a frontului
  pazieDefaultWidthMm: number;       // lățimea implicită a paziilor (capac tip pazii)
  // corpuri „sub blat": adâncime EXTERIOARĂ corp = adâncime blat − luft sub blat − ușă
  // (spatele PFL + holtșurubul se scad separat de motor din laterale — nu se dublează aici)
  subBlatClearanceMm: number;        // luft sub blat (consola frontală a blatului)
  subBlatDoorMm: number;             // ușă (frontul din față)
}

export type CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT' | 'BLAT';

export type PanelMount = 'INCADRAT' | 'APLICAT';

export type HandleType = 'APLICAT' | 'BUTON' | 'INGROPAT' | 'PROFIL_J' | 'GOLA' | 'PUSH' | 'FARA';
export interface HandleConfig {
  type: HandleType;
  itemId?: string;           // produs MANER (aplicat/buton/îngropat) sau ACCESORIU (push)
  frontExtensionMm?: number; // doar FARA: prelungirea frontului (uși)
}

export type DrawerSystem = 'PAL_BOX' | 'TANDEMBOX';

export interface DrawerOptions {
  count: number;
  frontHeightsMm?: number[];       // dacă lipsește: împărțire egală
  system: DrawerSystem;
  bottomMaterialId?: string;       // fund sertar (doar PAL_BOX; TANDEMBOX e complet)
}

export interface CabinetInput {
  label: string;                   // ex. "B1"
  type: CabinetType;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  mount?: { top?: PanelMount; bottom?: PanelMount }; // lipsă = încadrat (comportamentul istoric)
  /** doar type === 'BAZA' în ansamblu cu blat: corp „sub blat" — editorul derivă înălțimea/adâncimea
   *  din parametrii de blat ai ansamblului. Marker pentru UI; dimensiunile efective rămân în height/depth. */
  subBlat?: boolean;
  shelves: number;
  /** materialul polițelor (lipsă = materialul carcasei) și axa decorului
   *  ('LR' stânga–dreapta = istoric; 'FB' față–spate = piesa rotită la debitare);
   *  decorAxis e prezent doar când direcția decorului contează */
  shelf?: { materialId?: string; decorAxis?: 'LR' | 'FB' };
  doors: number;                   // 0 = fără uși; exclusiv cu drawers
  drawers?: DrawerOptions;         // sertare pe orice tip de corp; exclusiv cu doors
  carcassMaterialId: string;
  frontKind?: 'PAL' | 'MDF_MELAMINAT' | 'MDF_INFOLIAT' | 'MDF_VOPSIT'; // lipsă = PAL (comportament istoric)
  frontMaterialId: string | null;  // null = corp fără fronturi
  mdfFront?: {                      // doar frontKind === 'MDF_VOPSIT'
    supplierId: string; modelId: string;
    finish: 'MAT' | 'LUCIOS'; faces: number;
    ralCode: string; colorCategory: 'NORMALA' | 'VIE' | 'METALIZAT';
  };
  back: { enabled: boolean; materialId?: string; mount: 'FALT' | 'APLICAT' };
  edgeBands: {
    carcassFrontEdgeId: string;    // cant muchii frontale carcasă (uzual ABS 0.4)
    frontPerimeterId: string | null; // cant fronturi PAL (uzual ABS 1); MDF vopsit = fără
  };
  /** fronturi false verticale (piese fixe, fără feronerie): la ras cu marginea corpului,
   *  −frontGapMm/2 spre frontul vecin. Setabile doar la corpuri cu uși. */
  falseFronts?: { stangaMm?: number; dreaptaMm?: number };
  /** LEGACY (pre-fronturi-false): panoul orb de COLȚ — citit doar ca fallback
   *  pentru inputJson-uri nemigrate; se mapează pe falseFronts.stangaMm. */
  blindPanelWidthMm?: number;
  /** uși pe corp suspendat: ridicabilă = set Aventos în loc de balamale; lipsă = balamale */
  doorOpening?: 'BALAMALE' | 'RIDICABILA';
  hardwareSel?: {
    /** câmpuri LEGACY (pre-feronerie v4) — migrate în HardwareAdjustments.slots; motorul
     *  le mai citește doar ca fallback pentru inputJson-uri nemigrate */
    hingeId?: string;
    hingeCount?: number;
    slideId?: string;
    tandemboxHeightMm?: number; // TANDEMBOX: înălțimea lateralei alese (M/K/C/D) — rămâne configurație
    handleCount?: number;
  };
  handle?: HandleConfig;        // rezolvat (excepția corpului sau moștenirea proiectului); lipsă = APLICAT + produs implicit
  /** doar type === 'BLAT': materialul de blat + nr. manual de plăci (când adâncimea > lățimea plăcii).
   *  Un blat nu folosește câmpurile de carcasă/fronturi/feronerie — widthMm = lungime, depthMm = adâncime. */
  blat?: { materialId: string; manualPieces?: number };
  /** configurarea pieselor (configurator 3D): slot capac, override-uri per bucată, piese libere */
  pieces?: PiecesConfig;
}

export interface PartEdges {
  l1?: string; // cant pe prima latură lungă (id EdgeBand)
  l2?: string;
  w1?: string; // cant pe prima latură scurtă
  w2?: string;
}

/** Laturi semantice; fiecare piesă folosește exact 4, după orientare:
 *  laterală = fata/spate/sus/jos; blat/fund/poliță/pazie = fata/spate/stanga/dreapta;
 *  front/spate corp = sus/jos/stanga/dreapta. */
export type EdgeSide = 'fata' | 'spate' | 'sus' | 'jos' | 'stanga' | 'dreapta';

export const EDGE_SIDES: EdgeSide[] = ['fata', 'spate', 'sus', 'jos', 'stanga', 'dreapta'];

export const EDGE_SIDE_LABELS: Record<EdgeSide, string> = {
  fata: 'Față', spate: 'Spate', sus: 'Sus', jos: 'Jos', stanga: 'Stânga', dreapta: 'Dreapta',
};

/** Cheie stabilă de bucată: 'laterala:0', 'blat-corp', 'pazie-fata', 'polita:2',
 *  'usa:0', 'front-sertar:1', 'fals:stanga' | 'fals:dreapta', 'sertar:0:laterala:1', 'libera:<id>'. */
export type PieceKey = string;

export interface PieceOverride {
  edges?: Partial<Record<EdgeSide, string | null>>; // id EdgeBand; null = fără cant
  materialId?: string;
  lengthMm?: number;   // override manual; lipsă = auto
  widthMm?: number;
  removed?: boolean;   // piesa nu se generează (nici în cutlist)
}

export interface FreePiece {
  id: string;          // generat în UI la adăugare (crypto.randomUUID)
  name: string;
  lengthMm: number;    // fixe — nu se recalculează la redimensionarea corpului
  widthMm: number;
  qty: number;
  materialId: string;
  edges?: Partial<Record<EdgeSide, string | null>>;
}

export interface PiecesConfig {
  /** slot capac; default PLIN. Pazii = 2 traverse orizontale față+spate,
   *  lățime default cc.pazieDefaultWidthMm. */
  top?: { variant: 'PLIN' | 'PAZII' | 'ABSENT'; pazieWidthMm?: number };
  overrides?: Record<PieceKey, PieceOverride>;
  free?: FreePiece[];
}

/** mm; x: 0→W stânga→dreapta, y: 0→înălțimea carcasei jos→sus (0 = baza carcasei,
 *  sub picior nu se randează), z: 0→D spate→față (fronturile ies la z=D). */
export interface PiecePlacement {
  x: number; y: number; z: number;
  w: number; h: number; d: number;
}

export interface PieceInstance {
  key: PieceKey;
  cabinetLabel: string;
  name: string;   // numele canonic de debitare ('Laterală', 'Ușă') — filtrat de FRONT_PART_NAMES
  label: string;  // eticheta de afișare ('Laterală stânga', 'Ușă 1')
  lengthMm: number;
  widthMm: number;
  materialId: string;
  edges: Partial<Record<EdgeSide, string>>;          // doar muchiile cu cant
  edgeAxis: Partial<Record<EdgeSide, 'L' | 'W'>>;    // cele 4 laturi aplicabile → latura de debitare
  manual?: { lengthMm?: boolean; widthMm?: boolean; material?: boolean; edges?: EdgeSide[] };
  calc?: { length?: DimCalc; width?: DimCalc };
  placement?: PiecePlacement; // lipsă la piese libere și BLAT — nu se randează în 3D
  free?: boolean;
}

/** Un termen dintr-o formulă de dimensiune; valueMm semnat (negativ = scăzut). */
export interface DimTerm {
  label: string;
  valueMm: number;
}

/** Derivarea unei dimensiuni: rezultatul și termenii din care provine (pentru afișare la click). */
export interface DimCalc {
  label: string;       // 'Înălțime' | 'Lățime' | 'Adâncime' | 'Lățime interioară' …
  resultMm: number;
  terms: DimTerm[];
}

export interface Part {
  cabinetLabel: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  materialId: string;
  edges: PartEdges;
  /** derivarea dimensiunilor (opțional; completat doar pentru piesele de carcasă) */
  calc?: { length?: DimCalc; width?: DimCalc };
}

export interface FrontInfo {
  kind: 'USA' | 'SERTAR';
  widthMm: number;
  heightMm: number;
}

/** Identitatea stabilă a unui rând auto de feronerie — cheia override-urilor per rând. */
export type HardwareSlot =
  | 'balamale'
  | 'maner'
  | 'sertare'
  | 'picioare'
  | 'suspendare'
  | 'suporti-polita'
  | 'cleme-soclu'
  | 'holtsurub'
  | 'aventos';

export interface HardwareSuggestion {
  slot: HardwareSlot;
  category: HardwareCategory;
  name: string;
  qty: number;
  nominalLengthMm?: number;
  preferredId?: string;  // produs ales explicit pe corp — are prioritate la rezolvare
  boxHeightMm?: number;  // set Tandembox: potrivire pe înălțimea lateralei
  requiresBox?: boolean; // set Tandembox: nu se rezolvă pe glisiere simple
}

/** Abaterile utilizatorului de la sugestiile automate — doar ce s-a atins. */
export interface HardwareAdjustments {
  slots?: Partial<Record<HardwareSlot, { itemId?: string; qty?: number }>>;
  extra?: HardwareLine[]; // produse adăugate manual, peste rândurile auto
}

/** Un rând auto rezolvat, cu tot ce trebuie afișat/editat în tabelul de feronerie. */
export interface ResolvedSlot {
  slot: HardwareSlot;
  category: HardwareCategory;
  name: string;      // eticheta sugestiei (ex. „Balama + plăcuță (2 uși)")
  autoQty: number;   // cantitatea calculată automat
  qty: number;       // cantitatea finală (override sau auto)
  itemId: string | null; // produsul final; null = nerezolvat
  itemAdjusted: boolean;
  qtyAdjusted: boolean;
}

export interface Warning {
  code: string;
  message: string;
  cabinetLabel?: string;
}

export interface Catalogs {
  materials: BoardMaterial[];
  edgeBands: EdgeBand[];
}

export interface ExpandedCabinet {
  input: CabinetInput;
  pieces: PieceInstance[];
  parts: Part[];
  hardware: HardwareSuggestion[];
  warnings: Warning[];
}

export interface HardwareDefaults {
  hingeId: string;
  slideIdsByNominal: Record<number, string>;
  legId: string | null;
  railId: string | null;
  shelfSupportId: string | null;
  plinthClipId: string | null;
  aventosId: string | null;
  holtsurubId: string | null;
}

export interface HardwareLine {
  hardwareId: string;
  qty: number;
}

/** Potrivirea alege cel mai mic maxThicknessMm ≥ grosimea plăcii; lista nu trebuie să fie pre-sortată. */
export interface CuttingRate {
  maxThicknessMm: number;
  pricePerSheet: number;
}

export interface FreeLine {
  name: string;
  amount: number;
}

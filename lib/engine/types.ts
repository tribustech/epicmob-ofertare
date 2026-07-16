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
  blindPanelWidthMm?: number;      // doar COLT; implicit cc.blindPanelDefaultWidthMm
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
}

export interface PartEdges {
  l1?: string; // cant pe prima latură lungă (id EdgeBand)
  l2?: string;
  w1?: string; // cant pe prima latură scurtă
  w2?: string;
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

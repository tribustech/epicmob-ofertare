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
  shelfSpanWarnMm: number;         // avertizare poliță peste această deschidere
  doorMaxWidthMm: number;          // avertizare ușă peste această lățime
  blindPanelDefaultWidthMm: number; // lățime implicită panou orb la corpurile de colț
  tandemboxFrontClearanceMm: number; // rezervă: laterala Tandembox ≤ front − această valoare
  golaFrontDeductMm: number;         // GOLA: scurtarea fronturilor (profilul ocupă din înălțime)
  frontExtensionDefaultMm: number;   // „fără mâner": prelungirea implicită a frontului
}

export type CabinetType = 'BAZA' | 'SUSPENDAT' | 'INALT' | 'COLT';

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
  doors: number;                   // 0 = fără uși; exclusiv cu drawers
  drawers?: DrawerOptions;         // sertare pe orice tip de corp; exclusiv cu doors
  carcassMaterialId: string;
  frontMaterialId: string | null;  // null = corp fără fronturi
  back: { enabled: boolean; materialId?: string; mount: 'FALT' | 'APLICAT' };
  edgeBands: {
    carcassFrontEdgeId: string;    // cant muchii frontale carcasă (uzual ABS 0.4)
    frontPerimeterId: string | null; // cant fronturi PAL (uzual ABS 1); MDF vopsit = fără
  };
  blindPanelWidthMm?: number;      // doar COLT; implicit cc.blindPanelDefaultWidthMm
  hardwareSel?: {
    hingeId?: string;           // uși: model balama; lipsă = default global
    slideId?: string;           // PAL_BOX: model glisiere Tandem; lipsă = cel mai ieftin la nominală
    tandemboxHeightMm?: number; // TANDEMBOX: înălțimea lateralei alese (M/K/C/D)
  };
  handle?: HandleConfig;        // rezolvat (excepția corpului sau moștenirea proiectului); lipsă = APLICAT + produs implicit
}

export interface PartEdges {
  l1?: string; // cant pe prima latură lungă (id EdgeBand)
  l2?: string;
  w1?: string; // cant pe prima latură scurtă
  w2?: string;
}

export interface Part {
  cabinetLabel: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
  materialId: string;
  edges: PartEdges;
}

export interface FrontInfo {
  kind: 'USA' | 'SERTAR';
  widthMm: number;
  heightMm: number;
}

export interface HardwareSuggestion {
  category: HardwareCategory;
  name: string;
  qty: number;
  nominalLengthMm?: number;
  preferredId?: string;  // produs ales explicit pe corp — are prioritate la rezolvare
  boxHeightMm?: number;  // set Tandembox: potrivire pe înălțimea lateralei
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
  handleId: string | null;
  legId: string | null;
  railId: string | null;
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

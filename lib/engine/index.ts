import { DEFAULT_CONSTRUCTION } from './constants';
import { computeCosts, type CostCatalogs, type CostResult } from './costing';
import { resolveSuggestions } from './hardware';
import type { NestParams } from './nesting';
import { expandCabinet } from './templates';
import type {
  CabinetInput, ConstructionConstants, ExpandedCabinet, FreeLine,
  HardwareDefaults, HardwareLine, HardwareSuggestion, Part, Warning,
} from './types';

export interface ProjectInput {
  cabinets: CabinetInput[];
  freeLines: FreeLine[];
  laborPct: number;
  nesting: NestParams;
  extraHardware?: FreeLine[];
}

export interface ProjectCatalogs extends CostCatalogs {
  hardwareDefaults: HardwareDefaults;
}

export interface ProjectResult {
  cabinets: ExpandedCabinet[];
  parts: Part[];
  hardwareLines: HardwareLine[];
  unresolvedHardware: HardwareSuggestion[];
  costs: CostResult;
  warnings: Warning[];
}

export function computeProject(
  project: ProjectInput,
  catalogs: ProjectCatalogs,
  cc: ConstructionConstants = DEFAULT_CONSTRUCTION,
): ProjectResult {
  const cabinets = project.cabinets.map((c) => expandCabinet(c, catalogs, cc));
  const parts = cabinets.flatMap((c) => c.parts);
  const suggestions = cabinets.flatMap((c) => c.hardware);
  const { lines, unresolved } = resolveSuggestions(suggestions, null, catalogs.hardwareDefaults, catalogs.hardware);

  const costs = computeCosts({
    parts,
    hardwareLines: lines,
    cabinets: project.cabinets,
    freeLines: project.freeLines,
    laborPct: project.laborPct,
    nesting: project.nesting,
    catalogs,
    extraHardware: project.extraHardware,
  });

  return {
    cabinets,
    parts,
    hardwareLines: lines,
    unresolvedHardware: unresolved,
    costs,
    warnings: cabinets.flatMap((c) => c.warnings),
  };
}

// API public al motorului — consumat de aplicația web (Planul 2)
export { DEFAULT_CONSTRUCTION } from './constants';
export { expandCabinet } from './templates';
export { computeBlat, type BlatResult } from './blat';
export { computeMaterialNeeds, type BoardNeed, type EdgingNeed } from './needs';
export {
  computeCosts, type CostCatalogs, type CostBreakdown, type CostResult,
  type FrontSupplier, type FrontModel, type FrontPrice,
  FRONT_PART_NAMES, HANDLE_FRONT_PART_NAMES, FRONT_THICKNESS_MM,
} from './costing';
export { cutListCsv, aggregateHardware, type CutListFile, type HardwareSummaryRow } from './cutlist';
export { suggestHardware, resolveSuggestions, resolveSlots } from './hardware';
export { suggestHingeCount, doorWeightKg } from './hinges';
export { pickSlideNominal } from './drawers';
export { nestParts, DEFAULT_NEST_PARAMS } from './nesting';
export type { NestParams, NestPiece, PlacedPiece, SheetLayout, NestResult } from './nesting';
export * from './types';

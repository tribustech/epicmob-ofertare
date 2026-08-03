export type HoneycombAxis = 'H' | 'V';

export interface HoneycombLeaf {
  id: string;
  kind: 'leaf';
}

export interface HoneycombSplit {
  id: string;
  kind: 'split';
  axis: HoneycombAxis;
  firstSizeMm: number;
  materialId?: string;
  sourceId: string;
  first: HoneycombNode;
  second: HoneycombNode;
}

export type HoneycombNode = HoneycombLeaf | HoneycombSplit;

export interface HoneycombSplitInput {
  id: string;
  axis: HoneycombAxis;
  firstSizeMm: number;
  firstId: string;
  secondId: string;
  materialId?: string;
}

export interface HoneycombRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HoneycombDivider extends HoneycombRect {
  id: string;
  axis: HoneycombAxis;
  materialId?: string;
}

export interface HoneycombLeafRect extends HoneycombRect {
  id: string;
}

export interface HoneycombLayout {
  dividers: HoneycombDivider[];
  leaves: HoneycombLeafRect[];
}

export const createHoneycombRoot = (): HoneycombLeaf => ({ id: 'root', kind: 'leaf' });

function mapNode(node: HoneycombNode, id: string, replace: (node: HoneycombNode) => HoneycombNode): [HoneycombNode, boolean] {
  if (node.id === id) return [replace(node), true];
  if (node.kind === 'leaf') return [node, false];

  const [first, foundFirst] = mapNode(node.first, id, replace);
  if (foundFirst) return [{ ...node, first }, true];
  const [second, foundSecond] = mapNode(node.second, id, replace);
  return foundSecond ? [{ ...node, second }, true] : [node, false];
}

export function splitHoneycombLeaf(root: HoneycombNode, leafId: string, split: HoneycombSplitInput): HoneycombNode {
  const [next, found] = mapNode(root, leafId, (node) => {
    if (node.kind !== 'leaf') throw new Error('Doar un compartiment liber poate fi împărțit.');
    return {
      id: split.id,
      kind: 'split',
      axis: split.axis,
      firstSizeMm: split.firstSizeMm,
      materialId: split.materialId,
      sourceId: node.id,
      first: { id: split.firstId, kind: 'leaf' },
      second: { id: split.secondId, kind: 'leaf' },
    };
  });
  if (!found) throw new Error(`Compartimentul ${leafId} nu există.`);
  return next;
}

function layoutInto(
  node: HoneycombNode,
  rect: HoneycombRect,
  thicknessFor: (split: HoneycombSplit) => number,
  result: HoneycombLayout,
  splitRects?: Map<string, HoneycombRect>,
): void {
  if (node.kind === 'leaf') {
    result.leaves.push({ id: node.id, ...rect });
    return;
  }

  splitRects?.set(node.id, rect);
  const thickness = thicknessFor(node);
  const total = node.axis === 'V' ? rect.width : rect.height;
  const secondSize = total - node.firstSizeMm - thickness;
  if (node.firstSizeMm <= 0 || secondSize <= 0) {
    throw new Error('Împărțirea ar crea un compartiment cu dimensiune zero sau negativă.');
  }

  if (node.axis === 'V') {
    result.dividers.push({
      id: node.id, axis: node.axis, materialId: node.materialId,
      x: rect.x + node.firstSizeMm, y: rect.y,
      width: thickness, height: rect.height,
    });
    layoutInto(node.first, { ...rect, width: node.firstSizeMm }, thicknessFor, result, splitRects);
    layoutInto(node.second, {
      x: rect.x + node.firstSizeMm + thickness, y: rect.y,
      width: secondSize, height: rect.height,
    }, thicknessFor, result, splitRects);
  } else {
    result.dividers.push({
      id: node.id, axis: node.axis, materialId: node.materialId,
      x: rect.x, y: rect.y + node.firstSizeMm,
      width: rect.width, height: thickness,
    });
    layoutInto(node.first, { ...rect, height: node.firstSizeMm }, thicknessFor, result, splitRects);
    layoutInto(node.second, {
      x: rect.x, y: rect.y + node.firstSizeMm + thickness,
      width: rect.width, height: secondSize,
    }, thicknessFor, result, splitRects);
  }
}

export function layoutHoneycomb(
  root: HoneycombNode,
  bounds: HoneycombRect,
  thicknessFor: (split: HoneycombSplit) => number,
): HoneycombLayout {
  const result: HoneycombLayout = { dividers: [], leaves: [] };
  layoutInto(root, bounds, thicknessFor, result);
  return result;
}

export function resizeHoneycombSplit(
  root: HoneycombNode,
  splitId: string,
  firstSizeMm: number,
  bounds: HoneycombRect,
  thicknessFor: (split: HoneycombSplit) => number,
): HoneycombNode {
  const originalLayout = layoutHoneycomb(root, bounds, thicknessFor);
  const originalPositions = new Map(originalLayout.dividers.map((divider) => [
    divider.id,
    divider.axis === 'V' ? divider.x : divider.y,
  ]));
  const splitRects = new Map<string, HoneycombRect>();
  layoutInto(root, bounds, thicknessFor, { dividers: [], leaves: [] }, splitRects);
  const rect = splitRects.get(splitId);
  if (!rect) throw new Error(`Delimitarea ${splitId} nu există.`);

  const [next, found] = mapNode(root, splitId, (node) => {
    if (node.kind !== 'split') throw new Error('Elementul selectat nu este o delimitare.');
    const total = node.axis === 'V' ? rect.width : rect.height;
    if (firstSizeMm <= 0 || total - firstSizeMm - thicknessFor(node) <= 0) {
      throw new Error('Dimensiunea ar crea un compartiment cu dimensiune zero sau negativă.');
    }
    return { ...node, firstSizeMm };
  });
  if (!found) throw new Error(`Delimitarea ${splitId} nu există.`);

  const preserveOtherPositions = (node: HoneycombNode, rect: HoneycombRect): HoneycombNode => {
    if (node.kind === 'leaf') return node;
    const thickness = thicknessFor(node);
    const origin = node.axis === 'V' ? rect.x : rect.y;
    const desiredPosition = node.id === splitId
      ? origin + node.firstSizeMm
      : (originalPositions.get(node.id) ?? origin + node.firstSizeMm);
    const adjustedFirstSize = desiredPosition - origin;
    const total = node.axis === 'V' ? rect.width : rect.height;
    const secondSize = total - adjustedFirstSize - thickness;
    if (adjustedFirstSize <= 0 || secondSize <= 0) {
      throw new Error('Mutarea ar suprapune o altă delimitare sau ar crea un compartiment invalid.');
    }

    const firstRect: HoneycombRect = node.axis === 'V'
      ? { ...rect, width: adjustedFirstSize }
      : { ...rect, height: adjustedFirstSize };
    const secondRect: HoneycombRect = node.axis === 'V'
      ? {
          x: rect.x + adjustedFirstSize + thickness, y: rect.y,
          width: secondSize, height: rect.height,
        }
      : {
          x: rect.x, y: rect.y + adjustedFirstSize + thickness,
          width: rect.width, height: secondSize,
        };
    return {
      ...node,
      firstSizeMm: adjustedFirstSize,
      first: preserveOtherPositions(node.first, firstRect),
      second: preserveOtherPositions(node.second, secondRect),
    };
  };

  return preserveOtherPositions(next, bounds);
}

export function removeHoneycombSplit(root: HoneycombNode, splitId: string): HoneycombNode {
  const [next, found] = mapNode(root, splitId, (node) => {
    if (node.kind !== 'split') throw new Error('Elementul selectat nu este o delimitare.');
    if (node.first.kind !== 'leaf' || node.second.kind !== 'leaf') {
      throw new Error('Elimină mai întâi subdiviziunile din interior.');
    }
    return { id: node.sourceId, kind: 'leaf' };
  });
  if (!found) throw new Error(`Delimitarea ${splitId} nu există.`);
  return next;
}

export function equalHorizontalHoneycomb(
  shelfCount: number,
  usableHeightMm: number,
  thicknessMm: number,
): HoneycombNode {
  if (!Number.isInteger(shelfCount) || shelfCount < 0) throw new Error('Numărul de polițe trebuie să fie pozitiv.');
  if (shelfCount === 0) return createHoneycombRoot();
  const gap = (usableHeightMm - shelfCount * thicknessMm) / (shelfCount + 1);
  if (gap <= 0) throw new Error('Nu există suficient spațiu pentru aceste polițe.');

  let root: HoneycombNode = createHoneycombRoot();
  let targetId = 'root';
  for (let index = 0; index < shelfCount; index += 1) {
    const secondId = index === shelfCount - 1 ? `compartment-${index + 1}` : `remaining-${index + 1}`;
    root = splitHoneycombLeaf(root, targetId, {
      id: `shelf-${index + 1}`,
      axis: 'H',
      firstSizeMm: gap,
      firstId: `compartment-${index}`,
      secondId,
    });
    targetId = secondId;
  }
  return root;
}

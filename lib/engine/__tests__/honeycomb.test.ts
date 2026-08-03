import { describe, expect, it } from 'vitest';
import {
  createHoneycombRoot,
  equalHorizontalHoneycomb,
  layoutHoneycomb,
  removeHoneycombSplit,
  resizeHoneycombSplit,
  splitHoneycombLeaf,
} from '../honeycomb';

describe('honeycomb compartments', () => {
  it('splits a selected leaf and preserves stable compartment ids', () => {
    const root = splitHoneycombLeaf(createHoneycombRoot(), 'root', {
      id: 'vertical-1', axis: 'V', firstSizeMm: 280,
      firstId: 'left', secondId: 'right',
    });

    expect(root).toMatchObject({
      id: 'vertical-1', axis: 'V', firstSizeMm: 280,
      first: { id: 'left', kind: 'leaf' },
      second: { id: 'right', kind: 'leaf' },
    });
  });

  it('lays out local shelves and full-height separators with their real thickness', () => {
    let root = splitHoneycombLeaf(createHoneycombRoot(), 'root', {
      id: 'vertical-1', axis: 'V', firstSizeMm: 280,
      firstId: 'left', secondId: 'right',
    });
    root = splitHoneycombLeaf(root, 'right', {
      id: 'shelf-1', axis: 'H', firstSizeMm: 300,
      firstId: 'right-bottom', secondId: 'right-top', materialId: 'glass',
    });

    const result = layoutHoneycomb(root, { x: 18, y: 18, width: 564, height: 684 }, (split) =>
      split.materialId === 'glass' ? 8 : 18,
    );

    expect(result.dividers).toEqual([
      expect.objectContaining({ id: 'vertical-1', axis: 'V', x: 298, y: 18, width: 18, height: 684 }),
      expect.objectContaining({ id: 'shelf-1', axis: 'H', x: 316, y: 318, width: 266, height: 8 }),
    ]);
    expect(result.leaves).toContainEqual(expect.objectContaining({ id: 'right-top', height: 376 }));
  });

  it('rejects a resize that would create a zero or negative compartment', () => {
    const root = splitHoneycombLeaf(createHoneycombRoot(), 'root', {
      id: 'vertical-1', axis: 'V', firstSizeMm: 280,
      firstId: 'left', secondId: 'right',
    });

    expect(() => resizeHoneycombSplit(root, 'vertical-1', 590, {
      x: 0, y: 0, width: 600, height: 700,
    }, () => 18)).toThrow(/compartiment/i);
  });

  it('only removes a split when both child compartments are leaves', () => {
    let root = splitHoneycombLeaf(createHoneycombRoot(), 'root', {
      id: 'vertical-1', axis: 'V', firstSizeMm: 280,
      firstId: 'left', secondId: 'right',
    });
    root = splitHoneycombLeaf(root, 'right', {
      id: 'shelf-1', axis: 'H', firstSizeMm: 300,
      firstId: 'right-bottom', secondId: 'right-top',
    });

    expect(() => removeHoneycombSplit(root, 'vertical-1')).toThrow(/subdiviziuni/i);
    expect(removeHoneycombSplit(root, 'shelf-1')).toMatchObject({ id: 'vertical-1', second: { id: 'right' } });
  });

  it('converts simple shelves to equally spaced fixed compartments', () => {
    const root = equalHorizontalHoneycomb(2, 684, 18);
    const result = layoutHoneycomb(root, { x: 0, y: 0, width: 564, height: 684 }, () => 18);

    expect(result.dividers.map((divider) => divider.y)).toEqual([216, 450]);
    expect(result.leaves.map((leaf) => leaf.height)).toEqual([216, 216, 216]);
  });

  it('moves only the selected lower shelf and keeps the upper shelf fixed', () => {
    const bounds = { x: 0, y: 0, width: 564, height: 684 };
    const root = equalHorizontalHoneycomb(2, bounds.height, 18);
    const moved = resizeHoneycombSplit(root, 'shelf-1', 150, bounds, () => 18);
    const result = layoutHoneycomb(moved, bounds, () => 18);

    expect(result.dividers.map((divider) => divider.y)).toEqual([150, 450]);
  });
});

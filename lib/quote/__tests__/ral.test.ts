import { describe, it, expect } from 'vitest';
import { findRal, isRalBlack, ralIsVivid } from '../../ral';

describe('RAL loader', () => {
  it('findRal("RAL 7016") returnează Anthracite grey', () => {
    expect(findRal('RAL 7016')?.name_en).toBe('Anthracite grey');
  });
  it('tolerează codul fără prefix ("7016")', () => {
    expect(findRal('7016')?.code).toBe('RAL 7016');
  });
  it('isRalBlack("RAL 9005") === true', () => {
    expect(isRalBlack('RAL 9005')).toBe(true);
  });
  it('isRalBlack("RAL 7016") === false', () => {
    expect(isRalBlack('RAL 7016')).toBe(false);
  });
  it('ralIsVivid("RAL 3000") === true', () => {
    expect(ralIsVivid('RAL 3000')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { planClientChange } from '../project-client';

const existing = [{ id: 'c1', name: 'Ion Popescu' }, { id: 'c2', name: 'Maria  Ionescu' }];

describe('planClientChange', () => {
  it('gol / neschimbat → none', () => {
    expect(planClientChange('', 'c1', existing)).toEqual({ kind: 'none' });
    expect(planClientChange('  ion popescu ', 'c1', existing)).toEqual({ kind: 'none' });
  });
  it('nume existent (case/spații ignorate) → move', () => {
    expect(planClientChange('maria ionescu', 'c1', existing)).toEqual({ kind: 'move', clientId: 'c2' });
  });
  it('nume nou cu client curent → rename', () => {
    expect(planClientChange('Fam. Georgescu', 'c1', existing)).toEqual({ kind: 'rename', clientId: 'c1', name: 'Fam. Georgescu' });
  });
  it('nume nou fără client curent → create', () => {
    expect(planClientChange('Fam. Georgescu', null, existing)).toEqual({ kind: 'create', name: 'Fam. Georgescu' });
  });
});

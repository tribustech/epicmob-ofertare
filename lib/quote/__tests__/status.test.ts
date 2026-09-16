import { describe, expect, it } from 'vitest';
import {
  QUOTE_STATUSES, QUOTE_STATUS_LABELS, followUpQuestion, isFollowUpStatus, isFrozenStatus, isWaitingStatus, selectableStatuses,
} from '../status';

describe('stările ofertei', () => {
  it('ciclul complet, în ordine', () => {
    expect(QUOTE_STATUSES).toEqual(['DE_MASURAT', 'DE_FACUT', 'CIORNA', 'TRIMISA', 'IN_NEGOCIERE', 'AMANATA', 'ACCEPTATA', 'RESPINSA']);
  });
  it('fiecare stare are etichetă în română', () => {
    for (const s of QUOTE_STATUSES) expect(QUOTE_STATUS_LABELS[s].length).toBeGreaterThan(0);
  });
});

describe('isFrozenStatus', () => {
  it('prețul e înghețat din momentul trimiterii', () => {
    expect(isFrozenStatus('TRIMISA')).toBe(true);
    expect(isFrozenStatus('IN_NEGOCIERE')).toBe(true);
    expect(isFrozenStatus('AMANATA')).toBe(true);
    expect(isFrozenStatus('ACCEPTATA')).toBe(true);
  });
  it('înainte de trimitere și după respingere prețul e viu', () => {
    expect(isFrozenStatus('DE_MASURAT')).toBe(false);
    expect(isFrozenStatus('DE_FACUT')).toBe(false);
    expect(isFrozenStatus('CIORNA')).toBe(false);
    expect(isFrozenStatus('RESPINSA')).toBe(false);
  });
});

describe('isWaitingStatus', () => {
  it('doar stările în care aștepți răspuns de la client', () => {
    expect(QUOTE_STATUSES.filter(isWaitingStatus)).toEqual(['TRIMISA', 'IN_NEGOCIERE', 'AMANATA']);
  });
});

describe('selectableStatuses', () => {
  it('acceptarea nu se face din selector', () => {
    expect(selectableStatuses('CIORNA')).not.toContain('ACCEPTATA');
    expect(selectableStatuses('CIORNA')).toEqual(['DE_MASURAT', 'DE_FACUT', 'CIORNA', 'TRIMISA', 'IN_NEGOCIERE', 'AMANATA', 'RESPINSA']);
  });
  it('o ofertă acceptată rămâne blocată pe acceptată', () => {
    expect(selectableStatuses('ACCEPTATA')).toEqual(['ACCEPTATA']);
  });
});

describe('isFollowUpStatus și followUpQuestion', () => {
  it('stările cu dată de urmărit: măsurătoarea plus ofertele la client', () => {
    expect(QUOTE_STATUSES.filter(isFollowUpStatus)).toEqual(['DE_MASURAT', 'TRIMISA', 'IN_NEGOCIERE', 'AMANATA']);
  });
  it('întrebarea diferă după stare', () => {
    expect(followUpQuestion('DE_MASURAT')).toBe('Când mergi la măsurat?');
    expect(followUpQuestion('TRIMISA')).toBe('Când revii la client?');
  });
});

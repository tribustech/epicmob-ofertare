import { describe, expect, it } from 'vitest';
import { CLIENTS_STAGES, LEAD_ACTIVE_STAGES, NEXT_ACTION_STAGES } from '../client-stages';

describe('împărțirea între Leaduri și Clienți', () => {
  it('leadurile calificate rămân în Leaduri până acceptă o ofertă', () => {
    expect(LEAD_ACTIVE_STAGES).toEqual(['LEAD', 'CALIFICAT']);
  });
  it('la Clienți ajunge doar cine a acceptat', () => {
    expect(CLIENTS_STAGES).toEqual(['CLIENT']);
  });
  it('nicio etapă nu apare în ambele liste', () => {
    expect(CLIENTS_STAGES.filter((s) => (LEAD_ACTIVE_STAGES as string[]).includes(s))).toEqual([]);
  });
  it('„de contactat" acoperă și leadurile, și clienții calificați', () => {
    expect(NEXT_ACTION_STAGES).toEqual(['LEAD', 'CALIFICAT', 'CLIENT']);
  });
});

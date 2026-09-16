import { describe, expect, it } from 'vitest';
import { CLIENTS_STAGES, LEAD_ACTIVE_STAGES, NEXT_ACTION_STAGES } from '../client-stages';

describe('împărțirea între Leaduri și Clienți', () => {
  it('lista de leaduri conține doar leaduri necalificate', () => {
    expect(LEAD_ACTIVE_STAGES).toEqual(['LEAD']);
  });
  it('un client calificat apare la Clienți', () => {
    expect(CLIENTS_STAGES).toEqual(['CALIFICAT', 'CLIENT']);
  });
  it('nicio etapă nu apare în ambele liste', () => {
    expect(CLIENTS_STAGES.filter((s) => (LEAD_ACTIVE_STAGES as string[]).includes(s))).toEqual([]);
  });
  it('„de contactat" acoperă și leadurile, și clienții calificați', () => {
    expect(NEXT_ACTION_STAGES).toEqual(['LEAD', 'CALIFICAT', 'CLIENT']);
  });
});

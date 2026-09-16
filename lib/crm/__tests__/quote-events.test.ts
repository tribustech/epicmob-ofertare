import { describe, expect, it } from 'vitest';
import { eventText } from '../event-text';

describe('eventText pentru oferte', () => {
  it('QUOTE_STATUS arată trecerea, cu etichete în română', () => {
    expect(eventText('QUOTE_STATUS', { version: 2, from: 'TRIMISA', to: 'IN_NEGOCIERE' }))
      .toEqual({ label: 'a schimbat starea ofertei', detail: 'v2 · Trimisă → În negociere' });
  });
  it('QUOTE_FOLLOWUP cu dată și notă', () => {
    expect(eventText('QUOTE_FOLLOWUP', { version: 1, at: '2026-09-25', note: 'sună după concediu' }))
      .toEqual({ label: 'a stabilit când revine la client', detail: 'v1 · 25.09.2026 · sună după concediu' });
  });
  it('QUOTE_FOLLOWUP fără dată = ștergere', () => {
    expect(eventText('QUOTE_FOLLOWUP', { version: 1, at: null }).label).toBe('a șters data de revenire');
  });
});

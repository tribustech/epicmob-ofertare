import { describe, expect, it } from 'vitest';
import { clientDeleteBlocker } from '../client-delete';

describe('clientDeleteBlocker', () => {
  it('client curat: se poate șterge', () => {
    expect(clientDeleteBlocker({ name: 'Ion', projects: 0, documents: 0 })).toBeNull();
  });
  it('cu proiecte: refuz, cu numărul lor', () => {
    expect(clientDeleteBlocker({ name: 'Ion', projects: 1, documents: 0 }))
      .toBe('Ion are 1 proiect. Șterge întâi proiectul sau marchează clientul Pierdut.');
    expect(clientDeleteBlocker({ name: 'Ion', projects: 3, documents: 0 }))
      .toBe('Ion are 3 proiecte. Șterge întâi proiectele sau marchează clientul Pierdut.');
  });
  it('cu facturi: refuz, ca să nu rupem istoricul de bani', () => {
    expect(clientDeleteBlocker({ name: 'Ion', projects: 0, documents: 2 }))
      .toBe('Ion are 2 documente în Finanțe. Marchează clientul Pierdut în loc să-l ștergi.');
  });
  it('proiectele au prioritate în mesaj', () => {
    expect(clientDeleteBlocker({ name: 'Ion', projects: 1, documents: 1 })).toContain('proiect');
  });
});

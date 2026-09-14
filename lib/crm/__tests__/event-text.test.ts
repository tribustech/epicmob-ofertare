import { describe, expect, it } from 'vitest';
import { eventText } from '../event-text';

describe('eventText', () => {
  it('PROJECT_CLIENT_CHANGED arată clientul vechi → nou', () => {
    const r = eventText('PROJECT_CLIENT_CHANGED', { fromName: 'Ion', toName: 'Maria' });
    expect(r.label).toBe('a mutat proiectul la alt client');
    expect(r.detail).toBe('Ion → Maria');
  });
  it('CLIENT_UPDATED cu nume → redenumire', () => {
    expect(eventText('CLIENT_UPDATED', { name: 'Maria', from: 'Client nou' })).toEqual({ label: 'a redenumit clientul', detail: 'Client nou → Maria' });
    expect(eventText('CLIENT_UPDATED', {})).toEqual({ label: 'a editat datele de contact', detail: null });
  });
  it('PROJECT_CLIENT_CHANGED fără client vechi', () => {
    expect(eventText('PROJECT_CLIENT_CHANGED', { fromName: null, toName: 'Maria' }).detail).toBe('fără client → Maria');
  });
  it('CALENDAR_EVENT: titlu · dată · oră', () => {
    expect(eventText('CALENDAR_EVENT', { title: 'Montaj Popescu', date: '2026-09-14', time: '09:00' }))
      .toEqual({ label: 'a programat un eveniment', detail: 'Montaj Popescu · 14.09.2026 · 09:00' });
    expect(eventText('CALENDAR_EVENT', { title: 'Concediu', date: '2026-09-20', time: null }).detail).toBe('Concediu · 20.09.2026');
  });
});

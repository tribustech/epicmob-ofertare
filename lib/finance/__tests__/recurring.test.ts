import { describe, expect, it } from 'vitest';
import { dueDateFor, periodKeysDue } from '../recurring';

describe('recurring', () => {
  const today = new Date(2026, 8, 10); // 10 sept 2026

  it('lunar: toate lunile de la start până la luna curentă', () => {
    expect(periodKeysDue({ frequency: 'LUNAR', dayOfMonth: 5, startsAt: new Date(2026, 5, 1), endsAt: null }, today))
      .toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
  });

  it('trimestrial și anual sar corect; endsAt oprește', () => {
    expect(periodKeysDue({ frequency: 'TRIMESTRIAL', dayOfMonth: 1, startsAt: new Date(2026, 0, 15), endsAt: null }, today))
      .toEqual(['2026-01', '2026-04', '2026-07']);
    expect(periodKeysDue({ frequency: 'ANUAL', dayOfMonth: 1, startsAt: new Date(2024, 2, 1), endsAt: null }, today))
      .toEqual(['2024-03', '2025-03', '2026-03']);
    expect(periodKeysDue({ frequency: 'LUNAR', dayOfMonth: 1, startsAt: new Date(2026, 6, 1), endsAt: new Date(2026, 7, 31) }, today))
      .toEqual(['2026-07', '2026-08']);
  });

  it('start în viitor → nimic', () => {
    expect(periodKeysDue({ frequency: 'LUNAR', dayOfMonth: 1, startsAt: new Date(2026, 10, 1), endsAt: null }, today)).toEqual([]);
  });

  it('dueDateFor limitează ziua la ultima zi a lunii', () => {
    expect(dueDateFor('2026-02', 31).getDate()).toBe(28);
    expect(dueDateFor('2026-09', 5).getDate()).toBe(5);
  });
});

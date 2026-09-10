import { describe, expect, it } from 'vitest';
import { deactivateError } from '../user-rules';

describe('deactivateError', () => {
  it('nu te poți dezactiva pe tine', () => {
    expect(deactivateError({ targetId: 'a', currentUserId: 'a', activeCount: 3, targetActive: true })).toMatch(/pe tine/);
  });
  it('nu poți dezactiva ultimul activ', () => {
    expect(deactivateError({ targetId: 'b', currentUserId: 'a', activeCount: 1, targetActive: true })).toMatch(/ultimul/);
  });
  it('ok altfel; un user deja inactiv nu e verificat', () => {
    expect(deactivateError({ targetId: 'b', currentUserId: 'a', activeCount: 2, targetActive: true })).toBeNull();
    expect(deactivateError({ targetId: 'a', currentUserId: 'a', activeCount: 1, targetActive: false })).toBeNull();
  });
});

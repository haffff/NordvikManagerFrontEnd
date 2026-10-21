import { describe, it, expect } from 'vitest';
import { canEditGame, PERM } from './permissionBits';

// Who counts as a GM: the owner, or a co-GM with Edit on the game.
describe('canEditGame', () => {
  it('is true for the owner and for Edit on the game', () => {
    expect(canEditGame(true, PERM.NONE)).toBe(true);
    expect(canEditGame(false, PERM.SEE | PERM.EDIT)).toBe(true);
  });

  it('is false for a reader, and for "not set"', () => {
    expect(canEditGame(false, PERM.SEE)).toBe(false);
    expect(canEditGame(false, undefined)).toBe(false);
    expect(canEditGame(false, PERM.NOT_SET)).toBe(false);
  });
});

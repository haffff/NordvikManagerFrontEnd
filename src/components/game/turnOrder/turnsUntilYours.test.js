import { describe, it, expect } from 'vitest';
import { turnsUntilYours } from './turnsUntilYours';

const order = (currentEntryId, mine, ids = ['a', 'b', 'c', 'd']) => ({
  currentEntryId,
  currentHidden: false,
  entries: ids.map((id) => ({ id, controlled: mine.includes(id) })),
});

describe('turnsUntilYours', () => {
  it('is 0 on your turn', () => {
    expect(turnsUntilYours(order('b', ['b']))).toBe(0);
  });

  it('counts the turns before yours', () => {
    expect(turnsUntilYours(order('a', ['b']))).toBe(1);
    expect(turnsUntilYours(order('a', ['d']))).toBe(3);
  });

  it('wraps around into the next round', () => {
    expect(turnsUntilYours(order('c', ['a']))).toBe(2);
  });

  it('uses your nearest token when you have several', () => {
    expect(turnsUntilYours(order('a', ['d', 'c']))).toBe(2);
  });

  it("is unknown when you have no token in the order, it's not running, or the current turn is hidden from you", () => {
    expect(turnsUntilYours(order('a', []))).toBeNull();
    expect(turnsUntilYours(order(null, ['b']))).toBeNull();
    expect(turnsUntilYours({ ...order(null, ['b']), currentHidden: true })).toBeNull();
    expect(turnsUntilYours(null)).toBeNull();
  });
});

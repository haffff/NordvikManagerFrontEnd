import { describe, it, expect } from 'vitest';
import { turnsUntilYours } from './turnsUntilYours';

const order = (currentEntryId, mine, ids = ['a', 'b', 'c', 'd']) => ({
  currentEntryId,
  currentHidden: false,
  entries: ids.map((id) => ({ id, controlled: mine.includes(id) })),
});

describe('turnsUntilYours', () => {
  // Order a, b, c, d; the current turn and the entries you control.
  it.each([
    ['is 0 on your turn', 'b', ['b'], 0],
    ['counts the turns before yours', 'a', ['b'], 1],
    ['counts the turns before yours', 'a', ['d'], 3],
    ['wraps around into the next round', 'c', ['a'], 2],
    ['uses your nearest token when you have several', 'a', ['d', 'c'], 2],
    ['is unknown when you have no token in the order', 'a', [], null],
    ["is unknown when it's not running", null, ['b'], null],
  ])('%s (current %s, yours %j)', (_name, current, mine, expected) => {
    expect(turnsUntilYours(order(current, mine))).toBe(expected);
  });

  it('is unknown when the current turn is hidden from you, or there is no order', () => {
    expect(turnsUntilYours({ ...order(null, ['b']), currentHidden: true })).toBeNull();
    expect(turnsUntilYours(null)).toBeNull();
  });

});

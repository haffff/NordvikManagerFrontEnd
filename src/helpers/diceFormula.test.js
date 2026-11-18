import { describe, it, expect } from 'vitest';
import {
  emptyDiceState,
  buildDiceFormula,
  describeAvailability,
  describeFormula,
  toChatCommand,
} from './diceFormula';

const state = (overrides = {}) => {
  const base = emptyDiceState();
  return { ...base, ...overrides, pool: { ...base.pool, ...(overrides.pool ?? {}) } };
};

describe('buildDiceFormula', () => {
  it.each([
    ['returns null for an empty pool', {}, null],
    ['returns null for an empty pool', { modifier: 3 }, null],
    ['builds a single die type', { pool: { 20: 1 } }, '1d20'],
    ['builds a single die type', { pool: { 6: 3 } }, '3d6'],
    ['writes mixed pools in die order', { pool: { 20: 1, 6: 2, 100: 1 } }, '2d6+1d20+1d100'],
    ['adds the modifier with its sign and omits zero', { pool: { 20: 1 }, modifier: 5 }, '1d20+5'],
    ['adds the modifier with its sign and omits zero', { pool: { 20: 1 }, modifier: -2 }, '1d20-2'],
    ['adds the modifier with its sign and omits zero', { pool: { 20: 1 }, modifier: 0 }, '1d20'],
    ['writes fudge dice as dF', { pool: { F: 4 } }, '4dF'],
    ['turns a single d20 into 2d20kh1 / 2d20kl1 for advantage / disadvantage', { pool: { 20: 1 }, modifier: 5, advantage: 'adv' }, '2d20kh1+5'],
    ['turns a single d20 into 2d20kh1 / 2d20kl1 for advantage / disadvantage', { pool: { 20: 1 }, advantage: 'dis' }, '2d20kl1'],
    ['turns a single d20 into 2d20kh1 / 2d20kl1 for advantage / disadvantage', { pool: { 20: 1, 6: 1 }, advantage: 'adv' }, '1d6+2d20kh1'],
    ['ignores advantage unless the pool has exactly one d20', { pool: { 20: 2 }, advantage: 'adv' }, '2d20'],
    ['ignores advantage unless the pool has exactly one d20', { pool: { 6: 1 }, advantage: 'adv' }, '1d6'],
    ['applies keep/drop to a single die type', { pool: { 6: 4 }, keepDrop: { kind: 'dl', count: 1 } }, '4d6dl1'],
    ['applies keep/drop to a single die type', { pool: { 6: 4 }, keepDrop: { kind: 'kh', count: 3 } }, '4d6kh3'],
    ['clamps the keep/drop count to 1..dice-1', { pool: { 6: 4 }, keepDrop: { kind: 'kh', count: 9 } }, '4d6kh3'],
    ['clamps the keep/drop count to 1..dice-1', { pool: { 6: 4 }, keepDrop: { kind: 'dl', count: 0 } }, '4d6dl1'],
    ['ignores keep/drop for mixed pools', { pool: { 6: 2, 8: 2 }, keepDrop: { kind: 'kh', count: 1 } }, '2d6+2d8'],
    ['ignores keep/drop for single dice', { pool: { 6: 1 }, keepDrop: { kind: 'kh', count: 1 } }, '1d6'],
    ['ignores keep/drop together with advantage', { pool: { 20: 1 }, advantage: 'adv', keepDrop: { kind: 'kh', count: 1 } }, '2d20kh1'],
    ['adds ! to every non-fudge term when exploding', { pool: { 6: 3 }, exploding: true }, '3d6!'],
    ['adds ! to every non-fudge term when exploding', { pool: { 6: 1, F: 2 }, exploding: true }, '1d6!+2dF'],
    ['appends count successes / failures after the other modifiers', { pool: { 10: 10 }, exploding: true, successes: { mode: 'cs', cmp: '>', target: 7 } }, '10d10!cs>7'],
    ['appends count successes / failures after the other modifiers', { pool: { 10: 5 }, successes: { mode: 'cf', cmp: '=', target: 1 } }, '5d10cf=1'],
    ['ignores count successes for mixed pools', { pool: { 6: 2, 10: 2 }, successes: { mode: 'cs', cmp: '>', target: 4 } }, '2d6+2d10'],
  ])('%s: %o → %s', (_rule, overrides, expected) => {
    expect(buildDiceFormula(state(overrides))).toBe(expected);
  });

  it('never contains whitespace (chat splits /r on spaces)', () => {
    const formula = buildDiceFormula(state({ pool: { 10: 6 }, modifier: -1, exploding: true, keepDrop: { kind: 'kh', count: 3 }, successes: { mode: 'cs', cmp: '>', target: 7 } }));
    expect(formula).toBe('6d10!kh3cs>7-1');
    expect(formula).not.toMatch(/\s/);
  });
});

describe('describeAvailability', () => {
  it('enables advantage only with exactly one d20', () => {
    expect(describeAvailability(state({ pool: { 20: 1 } })).advantage.enabled).toBe(true);
    const twoD20 = describeAvailability(state({ pool: { 20: 2 } })).advantage;
    expect(twoD20.enabled).toBe(false);
    expect(twoD20.reason).toMatch(/one d20/i);
  });

  it('explains why keep/drop and count successes are unavailable for mixed pools', () => {
    const availability = describeAvailability(state({ pool: { 6: 2, 8: 1 } }));
    expect(availability.keepDrop.enabled).toBe(false);
    expect(availability.keepDrop.reason).toMatch(/one type of die/i);
    expect(availability.successes.enabled).toBe(false);
    expect(availability.successes.reason).toMatch(/one type of die/i);
  });

  it('requires at least two dice for keep/drop and no advantage', () => {
    expect(describeAvailability(state({ pool: { 6: 1 } })).keepDrop.reason).toMatch(/at least 2/i);
    expect(describeAvailability(state({ pool: { 20: 1 }, advantage: 'adv' })).keepDrop.enabled).toBe(false);
    expect(describeAvailability(state({ pool: { 6: 4 } })).keepDrop.enabled).toBe(true);
  });
});

describe('describeFormula', () => {
  it('summarises the roll in plain language', () => {
    expect(describeFormula(state({ pool: { 20: 1 }, modifier: 5, advantage: 'adv' }))).toBe('Roll 1d20 with advantage, add 5');
    expect(describeFormula(state({ pool: { 6: 4 }, keepDrop: { kind: 'dl', count: 1 } }))).toBe('Roll 4d6, drop the lowest 1');
    expect(describeFormula(state({ pool: { 10: 10 }, exploding: true, successes: { mode: 'cs', cmp: '>', target: 7 } })))
      .toBe('Roll 10d10, exploding, count successes above 7');
    expect(describeFormula(state())).toBe('Pick some dice');
  });
});

describe('toChatCommand', () => {
  it('prefixes the formula with /r', () => {
    expect(toChatCommand('2d20kh1+5')).toBe('/r 2d20kh1+5');
  });

  it('uses /gr for a roll only the GM sees', () => {
    expect(toChatCommand('1d20+5', { gmOnly: true })).toBe('/gr 1d20+5');
  });
});

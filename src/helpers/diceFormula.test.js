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
  it('returns null for an empty pool', () => {
    expect(buildDiceFormula(state())).toBeNull();
    expect(buildDiceFormula(state({ modifier: 3 }))).toBeNull();
  });

  it('builds a single die type', () => {
    expect(buildDiceFormula(state({ pool: { 20: 1 } }))).toBe('1d20');
    expect(buildDiceFormula(state({ pool: { 6: 3 } }))).toBe('3d6');
  });

  it('writes mixed pools in die order', () => {
    expect(buildDiceFormula(state({ pool: { 20: 1, 6: 2, 100: 1 } }))).toBe('2d6+1d20+1d100');
  });

  it('adds the modifier with its sign and omits zero', () => {
    expect(buildDiceFormula(state({ pool: { 20: 1 }, modifier: 5 }))).toBe('1d20+5');
    expect(buildDiceFormula(state({ pool: { 20: 1 }, modifier: -2 }))).toBe('1d20-2');
    expect(buildDiceFormula(state({ pool: { 20: 1 }, modifier: 0 }))).toBe('1d20');
  });

  it('writes fudge dice as dF', () => {
    expect(buildDiceFormula(state({ pool: { F: 4 } }))).toBe('4dF');
  });

  it('turns a single d20 into 2d20kh1 / 2d20kl1 for advantage / disadvantage', () => {
    expect(buildDiceFormula(state({ pool: { 20: 1 }, modifier: 5, advantage: 'adv' }))).toBe('2d20kh1+5');
    expect(buildDiceFormula(state({ pool: { 20: 1 }, advantage: 'dis' }))).toBe('2d20kl1');
    expect(buildDiceFormula(state({ pool: { 20: 1, 6: 1 }, advantage: 'adv' }))).toBe('1d6+2d20kh1');
  });

  it('ignores advantage unless the pool has exactly one d20', () => {
    expect(buildDiceFormula(state({ pool: { 20: 2 }, advantage: 'adv' }))).toBe('2d20');
    expect(buildDiceFormula(state({ pool: { 6: 1 }, advantage: 'adv' }))).toBe('1d6');
  });

  it('applies keep/drop to a single die type', () => {
    expect(buildDiceFormula(state({ pool: { 6: 4 }, keepDrop: { kind: 'dl', count: 1 } }))).toBe('4d6dl1');
    expect(buildDiceFormula(state({ pool: { 6: 4 }, keepDrop: { kind: 'kh', count: 3 } }))).toBe('4d6kh3');
  });

  it('clamps the keep/drop count to 1..dice-1', () => {
    expect(buildDiceFormula(state({ pool: { 6: 4 }, keepDrop: { kind: 'kh', count: 9 } }))).toBe('4d6kh3');
    expect(buildDiceFormula(state({ pool: { 6: 4 }, keepDrop: { kind: 'dl', count: 0 } }))).toBe('4d6dl1');
  });

  it('ignores keep/drop for mixed pools, single dice, and together with advantage', () => {
    expect(buildDiceFormula(state({ pool: { 6: 2, 8: 2 }, keepDrop: { kind: 'kh', count: 1 } }))).toBe('2d6+2d8');
    expect(buildDiceFormula(state({ pool: { 6: 1 }, keepDrop: { kind: 'kh', count: 1 } }))).toBe('1d6');
    expect(buildDiceFormula(state({ pool: { 20: 1 }, advantage: 'adv', keepDrop: { kind: 'kh', count: 1 } }))).toBe('2d20kh1');
  });

  it('adds ! to every non-fudge term when exploding', () => {
    expect(buildDiceFormula(state({ pool: { 6: 3 }, exploding: true }))).toBe('3d6!');
    expect(buildDiceFormula(state({ pool: { 6: 1, F: 2 }, exploding: true }))).toBe('1d6!+2dF');
  });

  it('appends count successes / failures after the other modifiers', () => {
    expect(buildDiceFormula(state({ pool: { 10: 10 }, exploding: true, successes: { mode: 'cs', cmp: '>', target: 7 } })))
      .toBe('10d10!cs>7');
    expect(buildDiceFormula(state({ pool: { 10: 5 }, successes: { mode: 'cf', cmp: '=', target: 1 } })))
      .toBe('5d10cf=1');
  });

  it('ignores count successes for mixed pools', () => {
    expect(buildDiceFormula(state({ pool: { 6: 2, 10: 2 }, successes: { mode: 'cs', cmp: '>', target: 4 } })))
      .toBe('2d6+2d10');
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
});

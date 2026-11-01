import { describe, it, expect, vi } from 'vitest';

vi.mock('mathjs', async (importOriginal) => {
  const mathjs = await importOriginal();
  return { ...mathjs, create: vi.fn(mathjs.create) };
});

import { create } from 'mathjs';
import { evaluate } from './TokenExpressionEvaluator';

const props = (entries) => new Map(Object.entries(entries));

describe('TokenExpressionEvaluator Math rule', () => {
  it('evaluates an operation on the value', () => {
    expect(evaluate('Math(%hp%, value * 2)', props({ hp: '7' }), 'number')).toBe(14);
  });

  it('handles the dnd5e token bars form (a comparison on the value)', () => {
    expect(evaluate('Math(0%bar2_max%, value > 0)', props({ bar2_max: '12' }), 'bool')).toBe(true);
    expect(evaluate('Math(0%bar2_max%, value > 0)', props({}), 'bool')).toBe(false);
  });

  it('reads %prop% inside the operation as a number, not as expression text', () => {
    expect(evaluate('Math(%hp%, value / %max%)', props({ hp: '5', max: '10' }), 'number')).toBe(0.5);
  });

  it('never evaluates a property value as math — a hostile value cannot freeze the client', () => {
    const started = performance.now();

    const result = evaluate('Math(1, value + %hp%)', props({ hp: 'ones(5000,5000)' }), 'number');

    expect(Number.isNaN(result)).toBe(true);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('keeps the disabled functions disabled', () => {
    expect(evaluate('Math(1, evaluate("2+2"))', props({}), 'number')).toBeUndefined();
    expect(evaluate('Math(1, import({}, {}))', props({}), 'number')).toBeUndefined();
  });

  it('builds the math instance once, not per evaluation', () => {
    const before = create.mock.calls.length;
    evaluate('Math(1, value + 1)', props({}), 'number');
    evaluate('Math(2, value + 1)', props({}), 'number');
    expect(create.mock.calls.length - before).toBe(0);
  });
});

describe('TokenExpressionEvaluator Enum rule', () => {
  it('maps a value through the object', () => {
    expect(evaluate('Enum(%faction%, {"ally":"green","enemy":"red"})', props({ faction: 'enemy' }), 'string')).toBe('red');
  });

  it('without a default, a value it has no entry for gives nothing (the part keeps what it had)', () => {
    expect(evaluate('Enum(%faction%, {"ally":"green"})', props({ faction: 'neutral' }), 'string')).toBeUndefined();
  });

  it('an optional third argument is used for any other value, or none', () => {
    const expression = 'Enum(%faction%, {"ally":"green"}, transparent)';
    expect(evaluate(expression, props({ faction: 'neutral' }), 'string')).toBe('transparent');
    expect(evaluate(expression, props({}), 'string')).toBe('transparent');
    expect(evaluate(expression, props({ faction: 'ally' }), 'string')).toBe('green');
  });
});

describe('TokenExpressionEvaluator FromToEnum rule', () => {
  const ranges = JSON.stringify([
    { min: 0, max: 25, enumValue: 'red' },
    { min: 25, max: 50, enumValue: 'yellow' },
    { min: 50, max: 9999, enumValue: 'green' },
  ]);
  const expression = `FromToEnum(%hp%, 0, %maxhp%, 0, 100, grey, ${ranges})`;
  const at = (hp) => evaluate(expression, props({ hp: String(hp), maxhp: '20' }), 'string');

  it('a value at the very bottom of the first range is in it (HP 0 is red, not the default)', () => {
    expect(at(0)).toBe('red');
  });

  it('a value on an inner boundary stays in the lower range; above max is the last', () => {
    expect([at(5), at(6), at(10), at(11), at(30)]).toEqual(['red', 'yellow', 'yellow', 'green', 'green']);
  });

  it('below every range is the default', () => {
    expect(at(-2)).toBe('grey');
  });
});

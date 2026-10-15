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

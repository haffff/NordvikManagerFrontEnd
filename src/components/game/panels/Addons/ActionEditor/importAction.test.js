import { describe, it, expect } from 'vitest';
import { parseActionJson } from './importAction';

const KNOWN = ['RollDice', 'If', 'SendChat', 'Find'];

// An action pasted as JSON: an exported one, an addon action file, or what an AI assistant wrote.
describe('parseActionJson', () => {
  it('reads an addon action file', () => {
    const r = parseActionJson(JSON.stringify({
      $schema: 'x', name: 'roll_check', hook: 0, gmPermission: 31, description: 'Rolls',
      content: [{ Type: 'RollDice', Data: { DiceString: '1d20' } }],
    }), KNOWN);

    expect(r.error).toBeUndefined();
    expect(r.action).toEqual({
      prefix: '', name: 'roll_check', hook: 0, description: 'Rolls',
      content: [{ Type: 'RollDice', Data: { DiceString: '1d20' } }],
    });
  });

  it('takes the text inside a ```json fence', () => {
    const r = parseActionJson('Here it is:\n```json\n{ "name": "a", "prefix": "me", "content": [] }\n```\nEnjoy.', KNOWN);
    expect(r.action).toMatchObject({ prefix: 'me', name: 'a', content: [] });
  });

  it('reads content written as a JSON string (as the server stores it)', () => {
    const r = parseActionJson(JSON.stringify({ name: 'a', content: '[{"Type":"SendChat","Data":{}}]' }), KNOWN);
    expect(r.action.content).toEqual([{ Type: 'SendChat', Data: {} }]);
  });

  it('takes a bare list of steps', () => {
    const r = parseActionJson('[{ "Type": "SendChat", "Data": { "Message": "hi" } }]', KNOWN);
    expect(r.action).toMatchObject({ name: '', content: [{ Type: 'SendChat' }] });
  });

  it('reads a hook given as text', () => {
    expect(parseActionJson('{ "name": "a", "hook": "5", "content": [] }', KNOWN).action.hook).toBe(5);
  });

  it('names step types that do not exist, inside blocks too', () => {
    const r = parseActionJson(JSON.stringify({
      name: 'a',
      content: [
        { Type: 'If', Data: { Condition: 'true', Then: [{ Type: 'DealDamage', Data: {} }] } },
        { Type: 'GetData', Data: {} },
      ],
    }), KNOWN);
    expect(r.error).toMatch(/DealDamage/);
    expect(r.error).toMatch(/GetData/);
  });

  it('skips the step type check without a list of steps', () => {
    expect(parseActionJson('{ "name": "a", "content": [{ "Type": "Anything" }] }').error).toBeUndefined();
  });

  it('says what is wrong with text that is not an action', () => {
    expect(parseActionJson('not json', KNOWN).error).toMatch(/JSON/);
    expect(parseActionJson('{ "name": "a" }', KNOWN).error).toMatch(/content/);
    expect(parseActionJson('{ "name": "a", "content": [{ "Data": {} }] }', KNOWN).error).toMatch(/Type/);
  });
});

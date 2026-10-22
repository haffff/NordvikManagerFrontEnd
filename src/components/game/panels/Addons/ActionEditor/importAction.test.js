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
    expect(r.actions).toEqual([{
      prefix: '', name: 'roll_check', hook: 0, description: 'Rolls',
      content: [{ Type: 'RollDice', Data: { DiceString: '1d20' } }],
    }]);
  });

  it('takes the text inside a ```json fence', () => {
    const r = parseActionJson('Here it is:\n```json\n{ "name": "a", "prefix": "me", "content": [] }\n```\nEnjoy.', KNOWN);
    expect(r.actions[0]).toMatchObject({ prefix: 'me', name: 'a', content: [] });
  });

  it('reads content written as a JSON string (as the server stores it)', () => {
    const r = parseActionJson(JSON.stringify({ name: 'a', content: '[{"Type":"SendChat","Data":{}}]' }), KNOWN);
    expect(r.actions[0].content).toEqual([{ Type: 'SendChat', Data: {} }]);
  });

  it('takes a bare list of steps', () => {
    const r = parseActionJson('[{ "Type": "SendChat", "Data": { "Message": "hi" } }]', KNOWN);
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0]).toMatchObject({ name: '', content: [{ Type: 'SendChat' }] });
  });

  // Assistants often answer with every action in one list.
  it('takes a list of actions', () => {
    const r = parseActionJson(JSON.stringify([
      { prefix: 'p', name: 'save', content: [{ Type: 'RollDice', Data: {} }] },
      { prefix: 'p', name: 'cast', hook: 0, content: [{ Type: 'SendChat', Data: {} }] },
    ]), KNOWN);

    expect(r.error).toBeUndefined();
    expect(r.actions.map((a) => a.name)).toEqual(['save', 'cast']);
  });

  it('says which action in a list is wrong', () => {
    const r = parseActionJson(JSON.stringify([
      { name: 'save', content: [{ Type: 'RollDice', Data: {} }] },
      { name: 'cast', content: [{ Type: 'DealDamage', Data: {} }] },
    ]), KNOWN);
    expect(r.error).toMatch(/cast/);
    expect(r.error).toMatch(/DealDamage/);
  });

  it('takes every ```json block of a whole reply', () => {
    const reply = [
      'First:', '```json', '{ "name": "a", "content": [] }', '```',
      'Then:', '```json', '{ "name": "b", "content": [] }', '```',
    ].join('\n');
    const r = parseActionJson(reply, KNOWN);
    expect(r.actions.map((x) => x.name)).toEqual(['a', 'b']);
  });

  it('reads a hook given as text', () => {
    expect(parseActionJson('{ "name": "a", "hook": "5", "content": [] }', KNOWN).actions[0].hook).toBe(5);
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

import { describe, it, expect } from 'vitest';
import { getChatSuggestions } from './chatAutocomplete';

// Autofill for chat commands ("/"), and for player names after "/w ".
const players = [
  { id: 'me', name: 'Alice' },
  { id: 'b', name: 'Bob' },
  { id: 'ob', name: 'Old Bob' },
  { id: 'gm', name: 'Dungeon Master' },
];
const suggest = (text) => getChatSuggestions(text, { players, meId: 'me' });
const labels = (text) => suggest(text).map((s) => s.label);

describe('getChatSuggestions', () => {
  it('lists every chat command for a bare "/"', () => {
    expect(labels('/')).toEqual(['/r', '/gr', '/w', '/gm', '/help', '/c']);
    expect(suggest('/')[0].description).toBeTruthy();
  });

  it.each([
    ['narrows the commands as you type', '/g', ['/gr', '/gm']],
    ['narrows the commands as you type, any case', '/W', ['/w']],
    ['suggests players after "/w ", not yourself', '/w ', ['Bob', 'Old Bob', 'Dungeon Master']],
    ['filters players by the start of their name', '/w b', ['Bob']],
    ['filters players by the start of their name, any case', '/w old', ['Old Bob']],
    ['stops suggesting once the name is written out', '/w Bob hello', []],
    ['stops suggesting once the name is written out, with a space after', '/w Old Bob ', []],
    ['suggests nothing for plain text', 'hello', []],
    ['suggests nothing for a written-out command', '/gr 1d20', []],
  ])('%s: "%s"', (_name, text, expected) => {
    expect(labels(text)).toEqual(expected);
  });

  it('inserts the command and a space', () => {
    expect(suggest('/gr')[0].insert).toBe('/gr ');
  });

  it('inserts the whisper with the name and a space', () => {
    expect(suggest('/w ol')[0].insert).toBe('/w Old Bob ');
  });

  it('leaves "/c " to the client command list', () => {
    expect(suggest('/c Game.')).toBeNull();
  });

});

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

  it('narrows the commands as you type', () => {
    expect(labels('/g')).toEqual(['/gr', '/gm']);
    expect(labels('/W')).toEqual(['/w']);
  });

  it('inserts the command and a space', () => {
    expect(suggest('/gr')[0].insert).toBe('/gr ');
  });

  it('suggests players after "/w ", not yourself', () => {
    expect(labels('/w ')).toEqual(['Bob', 'Old Bob', 'Dungeon Master']);
  });

  it('filters players by the start of their name, any case', () => {
    expect(labels('/w b')).toEqual(['Bob']);
    expect(labels('/w old')).toEqual(['Old Bob']);
  });

  it('inserts the whisper with the name and a space', () => {
    expect(suggest('/w ol')[0].insert).toBe('/w Old Bob ');
  });

  it('stops suggesting once the name is written out', () => {
    expect(suggest('/w Bob hello')).toEqual([]);
    expect(suggest('/w Old Bob ')).toEqual([]);
  });

  it('leaves "/c " to the client command list', () => {
    expect(suggest('/c Game.')).toBeNull();
  });

  it('suggests nothing for plain text or a written-out command', () => {
    expect(suggest('hello')).toEqual([]);
    expect(suggest('/gr 1d20')).toEqual([]);
  });
});

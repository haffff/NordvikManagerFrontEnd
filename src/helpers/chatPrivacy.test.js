import { describe, it, expect } from 'vitest';
import { describePrivacy } from './chatPrivacy';

// The label over a whisper or GM roll (/w, /gm, /gr) — the server sets recipientId.
const gm = { id: 'gm', name: 'Dungeon Master' };
const alice = { id: 'alice', name: 'Alice' };
const bob = { id: 'bob', name: 'Bob' };
const players = [gm, alice, bob];
const roll = JSON.stringify({ type: 'Roll', title: 'Roll' });

const label = (item, meId) => describePrivacy(item, { players, meId, gmId: 'gm' })?.label;

describe('describePrivacy', () => {
  it('leaves public messages alone', () => {
    expect(describePrivacy({ playerId: 'alice', data: 'hi' }, { players, meId: 'bob', gmId: 'gm' })).toBeNull();
  });

  it.each([
    ['calls a roll sent to the GM a GM roll (sender)', { playerId: 'alice', recipientId: 'gm', data: roll }, 'alice', 'GM roll'],
    ['calls a roll sent to the GM a GM roll (GM)', { playerId: 'alice', recipientId: 'gm', data: roll }, 'gm', 'GM roll'],
    ['tells the sender who they whispered to', { playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'alice', 'Whisper to Bob'],
    ['calls a message to the GM a whisper to the GM', { playerId: 'alice', recipientId: 'gm', data: 'psst' }, 'alice', 'Whisper to the GM'],
    ['tells the recipient who whispered', { playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'bob', 'Whisper from Alice'],
    ['shows the GM both sides of a whisper between players', { playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'gm', 'Alice → Bob'],
    ['copes with a player who has left', { playerId: 'alice', recipientId: 'gone', data: 'psst' }, 'alice', 'Whisper to [Unknown]'],
  ])('%s', (_name, item, meId, expected) => {
    expect(label(item, meId)).toBe(expected);
  });

});

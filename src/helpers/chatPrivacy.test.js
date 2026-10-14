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

  it('calls a roll sent to the GM a GM roll', () => {
    expect(label({ playerId: 'alice', recipientId: 'gm', data: roll }, 'alice')).toBe('GM roll');
    expect(label({ playerId: 'alice', recipientId: 'gm', data: roll }, 'gm')).toBe('GM roll');
  });

  it('tells the sender who they whispered to', () => {
    expect(label({ playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'alice')).toBe('Whisper to Bob');
  });

  it('calls a message to the GM a whisper to the GM', () => {
    expect(label({ playerId: 'alice', recipientId: 'gm', data: 'psst' }, 'alice')).toBe('Whisper to the GM');
  });

  it('tells the recipient who whispered', () => {
    expect(label({ playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'bob')).toBe('Whisper from Alice');
  });

  it('shows the GM both sides of a whisper between players', () => {
    expect(label({ playerId: 'alice', recipientId: 'bob', data: 'psst' }, 'gm')).toBe('Alice → Bob');
  });

  it('copes with a player who has left', () => {
    expect(label({ playerId: 'alice', recipientId: 'gone', data: 'psst' }, 'alice')).toBe('Whisper to [Unknown]');
  });
});

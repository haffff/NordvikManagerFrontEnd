import { describe, it, expect, vi } from 'vitest';

// ChatPanel.js pulls in the WebRTC transport singletons at import time — mock them
// so importing the module for its stampKey/stampKeys helpers doesn't try to open a
// real connection (same concern CardAPI.test.js mocks this same module for).
vi.mock('../../../helpers/transport', () => ({
  ActiveWebHelper: { getAsync: vi.fn() },
  ActiveTransportManager: { Subscribe: vi.fn(), Unsubscribe: vi.fn(), Send: vi.fn() },
}));

import { stampKey, stampKeys } from './ChatPanel';

// Regression coverage for the chat-message-key bug: items.map((item, i) => <ChatBubble
// key={i} .../>) used to key bubbles by array position. Since live messages are
// *prepended* (setItems(prev => [event, ...prev])), every existing message's index
// shifts on every new incoming message, so React reassigned each ChatBubble instance
// (and its internal state — e.g. a roll's clicked "Roll Damage" button) onto a
// different logical message. stampKey/stampKeys give each item a position-independent
// identity, assigned once, at the moment it enters state.
describe('ChatPanel stampKey/stampKeys', () => {
  it('preserves all existing fields on the item', () => {
    const item = { data: { title: 'Roll' }, foo: 'bar' };
    const stamped = stampKey(item);

    expect(stamped.data).toBe(item.data);
    expect(stamped.foo).toBe('bar');
  });

  it('uses item.id as the stable key when present (history-loaded messages)', () => {
    const stamped = stampKey({ id: 'abc-123' });
    expect(stamped._reactKey).toBe('abc-123');
  });

  it('falls back to item.Id when lowercase id is absent (REST/WS casing not guaranteed)', () => {
    const stamped = stampKey({ Id: 'xyz-789' });
    expect(stamped._reactKey).toBe('xyz-789');
  });

  it('generates a key when neither id nor Id is present (live chat_push messages)', () => {
    const stamped = stampKey({ data: 'hello' });
    expect(stamped._reactKey).toBeTruthy();
  });

  it('gives two id-less items in the same batch different keys', () => {
    // This is the crux of the bug: two roll messages with no server id must not
    // collapse onto the same identity just because they arrive in the same tick.
    const [a, b] = stampKeys([{ data: 'roll A' }, { data: 'roll B' }]);
    expect(a._reactKey).not.toBe(b._reactKey);
  });

  it('stampKeys defaults to an empty array for null/undefined input', () => {
    expect(stampKeys(null)).toEqual([]);
    expect(stampKeys(undefined)).toEqual([]);
  });

  it("an item's key stays the same object identity across being moved to a new array position", () => {
    // Simulates a new live message being prepended in front of an older one — the
    // older item's _reactKey must travel with it, not be reassigned based on index.
    const older = stampKey({ id: 'older-msg' });
    const withNewOnTop = [stampKey({ data: 'new' }), older];

    expect(withNewOnTop[1]._reactKey).toBe('older-msg');
  });
});

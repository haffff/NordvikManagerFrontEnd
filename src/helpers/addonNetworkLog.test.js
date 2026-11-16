import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordBlocked, getBlocked, subscribeBlocked, resetBlocked } from './addonNetworkLog';

// What addon code tried to reach and wasn't allowed to, this session: one entry per
// who + where + why, counting repeats.
describe('addonNetworkLog', () => {
  beforeEach(() => resetBlocked());

  it('keeps one entry per who, where and why, counting repeats; only the first is new', () => {
    const card = { source: 'card', card: 'Sheet', origin: 'https://evil.example.com', directive: 'connect-src' };

    expect(recordBlocked(card)).toBe(true);
    expect(recordBlocked(card)).toBe(false);
    expect(recordBlocked({ ...card, directive: 'img-src' })).toBe(true);
    expect(recordBlocked({ ...card, card: 'Other' })).toBe(true);

    const [first] = getBlocked();
    expect(first).toMatchObject({ ...card, count: 2 });
    expect(first.firstSeen).toBeLessThanOrEqual(first.lastSeen);
    expect(getBlocked()).toHaveLength(3);
  });

  it('tells subscribers about every new entry until they unsubscribe', () => {
    const seen = vi.fn();
    const off = subscribeBlocked(seen);
    const action = { source: 'action', addon: 'trilium', action: 'Import', origin: 'https://notes.example.com', reason: 'no-outside-connections' };

    recordBlocked(action);
    recordBlocked(action);
    off();
    recordBlocked({ ...action, origin: 'https://b.example.com' });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith(expect.objectContaining(action));
  });

  it('filters by addon', () => {
    recordBlocked({ source: 'card', addon: 'dnd5e', origin: 'https://a.example.com', directive: 'connect-src' });
    recordBlocked({ source: 'card', addon: 'poll', origin: 'https://a.example.com', directive: 'connect-src' });

    expect(getBlocked('poll').map((e) => e.addon)).toEqual(['poll']);
  });
});

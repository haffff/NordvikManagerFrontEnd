import { describe, it, expect, beforeEach, vi } from 'vitest';
import LayoutPersistence from './LayoutPersistence';

const G = 'game-1';
const P = 'player-1';
const KEY = `nm_layout_${G}_${P}`;

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('LayoutPersistence', () => {
  it('round-trips a clone object', () => {
    LayoutPersistence.save(G, P, { rootPanel: 1, _contents: [{ contentId: 0 }] });
    expect(LayoutPersistence.load(G, P)).toEqual({ rootPanel: 1, _contents: [{ contentId: 0 }] });
  });

  it('wraps the payload with schema / savedAt', () => {
    LayoutPersistence.save(G, P, { a: 1 });
    const raw = JSON.parse(localStorage.getItem(KEY));
    expect(raw.schema).toBe(LayoutPersistence.SCHEMA);
    expect(typeof raw.savedAt).toBe('number');
    expect(raw.layout).toEqual({ a: 1 });
  });

  it('load returns null and clears the key on a schema mismatch', () => {
    localStorage.setItem(KEY, JSON.stringify({ schema: 999, layout: { a: 1 } }));
    expect(LayoutPersistence.load(G, P)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('load returns null and clears the key on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(LayoutPersistence.load(G, P)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('load returns null when nothing is stored', () => {
    expect(LayoutPersistence.load(G, P)).toBeNull();
  });

  it('save swallows a quota / unavailable error', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    expect(() => LayoutPersistence.save(G, P, { a: 1 })).not.toThrow();
  });

  it('is a no-op with missing ids or clone', () => {
    LayoutPersistence.save(null, P, { a: 1 });
    LayoutPersistence.save(G, null, { a: 1 });
    LayoutPersistence.save(G, P, null);
    expect(localStorage.length).toBe(0);
    expect(LayoutPersistence.load(null, P)).toBeNull();
  });

  it('clear removes the key', () => {
    LayoutPersistence.save(G, P, { a: 1 });
    LayoutPersistence.clear(G, P);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

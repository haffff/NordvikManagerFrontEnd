import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import ResourceCache from './ResourceCache';
import { getCacheLimitMB, setCacheLimitMB, DEFAULT_CACHE_LIMIT_MB } from './cacheSettings';

const MB = 1024 * 1024;
const bytes = (n, fill = 1) => new Uint8Array(n).fill(fill).buffer;
const entry = (n, version = 'v1', fill = 1) => ({ data: bytes(n, fill), mimeType: 'audio/mpeg', version });

describe('cacheSettings', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to 500 MB', () => {
    expect(DEFAULT_CACHE_LIMIT_MB).toBe(500);
    expect(getCacheLimitMB()).toBe(500);
  });

  it('remembers the chosen size; 0 means off', () => {
    setCacheLimitMB(1024);
    expect(getCacheLimitMB()).toBe(1024);
    setCacheLimitMB(0);
    expect(getCacheLimitMB()).toBe(0);
  });

  it('ignores a broken stored value', () => {
    localStorage.setItem('nordvik.resourceCacheLimitMB', 'lots');
    expect(getCacheLimitMB()).toBe(500);
  });
});

describe('ResourceCache', () => {
  beforeEach(async () => {
    localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    await ResourceCache._resetForTests();
  });

  afterEach(async () => {
    await ResourceCache._resetForTests();
  });

  it('stores bytes with their version and gives them back', async () => {
    expect(await ResourceCache.put('g:a', entry(10, 'v7', 5))).toBe(true);

    const got = await ResourceCache.get('g:a');

    expect(got.version).toBe('v7');
    expect(got.mimeType).toBe('audio/mpeg');
    expect(new Uint8Array(got.data)).toEqual(new Uint8Array(10).fill(5));
    expect(await ResourceCache.usage()).toBe(10);
  });

  it('a missing key is null', async () => {
    expect(await ResourceCache.get('g:nothing')).toBeNull();
  });

  it('size 0 (off) stores nothing', async () => {
    setCacheLimitMB(0);

    expect(await ResourceCache.put('g:a', entry(10))).toBe(false);
    expect(await ResourceCache.get('g:a')).toBeNull();
  });

  it('replacing an entry keeps one copy', async () => {
    await ResourceCache.put('g:a', entry(10, 'v1'));
    await ResourceCache.put('g:a', entry(20, 'v2'));

    expect((await ResourceCache.get('g:a')).version).toBe('v2');
    expect(await ResourceCache.usage()).toBe(20);
  });

  it('over the limit, drops the least recently used first', async () => {
    setCacheLimitMB(3);
    await ResourceCache.put('g:a', entry(MB));
    await ResourceCache.put('g:b', entry(MB));
    await ResourceCache.put('g:c', entry(MB));
    await ResourceCache.get('g:a'); // a used again: b is now the oldest

    await ResourceCache.put('g:d', entry(MB));

    expect(await ResourceCache.get('g:b')).toBeNull();
    for (const key of ['g:a', 'g:c', 'g:d']) expect(await ResourceCache.get(key)).not.toBeNull();
    expect(await ResourceCache.usage()).toBe(3 * MB);
  });

  it('a file bigger than the whole limit is not stored, and an old copy of it is dropped', async () => {
    setCacheLimitMB(1);
    await ResourceCache.put('g:a', entry(10, 'v1'));

    expect(await ResourceCache.put('g:a', entry(2 * MB, 'v2'))).toBe(false);

    expect(await ResourceCache.get('g:a')).toBeNull();
  });

  it('lowering the size evicts down to it straight away', async () => {
    setCacheLimitMB(10);
    for (const key of ['g:a', 'g:b', 'g:c', 'g:d']) await ResourceCache.put(key, entry(MB));

    await ResourceCache.setLimitMB(2);

    expect(getCacheLimitMB()).toBe(2);
    expect(await ResourceCache.usage()).toBe(2 * MB);
    expect(await ResourceCache.get('g:d')).not.toBeNull(); // newest kept
  });

  it('clear empties it', async () => {
    await ResourceCache.put('g:a', entry(10));

    await ResourceCache.clear();

    expect(await ResourceCache.usage()).toBe(0);
    expect(await ResourceCache.get('g:a')).toBeNull();
  });

  it('without IndexedDB (private window, blocked storage) it never hits and never throws', async () => {
    globalThis.indexedDB = undefined;
    await ResourceCache._resetForTests();

    expect(await ResourceCache.put('g:a', entry(10))).toBe(false);
    expect(await ResourceCache.get('g:a')).toBeNull();
    expect(await ResourceCache.usage()).toBe(0);
    await ResourceCache.clear();
  });
});

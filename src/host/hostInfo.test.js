import { describe, it, expect, vi } from 'vitest';
import { isAvailable, loadHostInfo, resetHostInfo } from './hostInfo';

const browser = {
  kind: 'browser',
  unavailable: [
    { path: 'api/Backup', reason: 'Backs up the whole GM server.' },
    { path: 'api/ServerSettings', reason: 'The GM server settings file.' },
    { path: 'api/Materials/LinkResource', reason: 'Links a file on the disk.' },
  ],
  limitations: [],
};

describe('isAvailable', () => {
  it('is false for a listed controller and anything under it, any case', () => {
    expect(isAvailable(browser, 'api/Backup')).toBe(false);
    expect(isAvailable(browser, 'api/backup/list')).toBe(false);
    expect(isAvailable(browser, 'api/Materials/LinkResource')).toBe(false);
  });

  it('is true for the rest, and not fooled by a shared prefix', () => {
    expect(isAvailable(browser, 'api/Materials/Resource')).toBe(true);
    expect(isAvailable(browser, 'api/BackupCodes')).toBe(true);
  });

  it('is true for everything on a GM server, and while the info is unknown', () => {
    expect(isAvailable({ kind: 'server', unavailable: [] }, 'api/Backup')).toBe(true);
    expect(isAvailable(null, 'api/Backup')).toBe(true);
  });
});

describe('loadHostInfo', () => {
  it('asks once', async () => {
    resetHostInfo();
    const get = vi.fn(async () => browser);

    expect(await loadHostInfo(get)).toBe(browser);
    expect(await loadHostInfo(get)).toBe(browser);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('host/info');
  });

  it('is null for a backend without it (older GM servers), and asks again later', async () => {
    resetHostInfo();
    const get = vi.fn(async () => undefined);

    expect(await loadHostInfo(get)).toBeNull();
    await loadHostInfo(get);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('hasLimitation', () => {
  it('finds a limitation by id; none on a GM server or while unknown', async () => {
    const { hasLimitation } = await import('./hostInfo');
    const info = { kind: 'browser', limitations: [{ id: 'no-thumbnails', title: 'No thumbnails' }] };

    expect(hasLimitation(info, 'no-thumbnails')).toBe(true);
    expect(hasLimitation(info, 'tab-open')).toBe(false);
    expect(hasLimitation({ kind: 'server', limitations: [] }, 'no-thumbnails')).toBe(false);
    expect(hasLimitation(null, 'no-thumbnails')).toBe(false);
  });
});

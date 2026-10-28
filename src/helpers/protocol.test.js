import { vi, describe, it, expect, afterEach } from 'vitest';
import { PROTOCOL_VERSION, clientPathForProtocol, clientExistsForProtocol } from './protocol';
import protocolJson from '../protocol.json';

describe('protocol helper', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PROTOCOL_VERSION comes from protocol.json (CI compares that file with the backend)', () => {
    expect(PROTOCOL_VERSION).toBe(protocolJson.protocol);
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
  });

  it('clientPathForProtocol points at the frozen build folder for that protocol', () => {
    expect(clientPathForProtocol(3)).toBe('/client/p3/');
  });

  it('clientExistsForProtocol asks for the folder index.html with HEAD and reports ok', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(clientExistsForProtocol(2)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/client/p2/index.html', expect.objectContaining({ method: 'HEAD' }));
  });

  it('clientExistsForProtocol is false on 404 or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 404 })));
    await expect(clientExistsForProtocol(2)).resolves.toBe(false);

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(clientExistsForProtocol(2)).resolves.toBe(false);
  });
});

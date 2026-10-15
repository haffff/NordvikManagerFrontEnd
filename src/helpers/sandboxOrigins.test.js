import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./transport', () => ({ ActiveWebHelper: { getAsync: vi.fn() } }));

import { ActiveWebHelper } from './transport';
import { DEFAULT_SANDBOX_ORIGINS, validOrigins, loadSandboxOrigins, resetSandboxOrigins } from './sandboxOrigins';

// The GM's Security:SandboxAllowedOrigins (backend appsettings): the hosts addon cards and
// Html chat messages may load from. Player pages come from the Central Server, so the
// client enforces the list itself.

describe('validOrigins', () => {
  it('keeps https origins and drops anything that could break out of a policy', () => {
    expect(validOrigins([
      'https://cdn.example.com',
      ' https://*.example.org:8443 ',
      'http://plain.example.com',
      "'unsafe-eval'",
      'https://a.com; script-src *',
      'https://a.com" onload="x',
      'https://a.com/path',
      '*',
      42,
    ])).toEqual(['https://cdn.example.com', 'https://*.example.org:8443']);
  });

  it('falls back to the defaults when there is no list', () => {
    expect(validOrigins(undefined)).toEqual(DEFAULT_SANDBOX_ORIGINS);
    expect(validOrigins({ origins: 'x' })).toEqual(DEFAULT_SANDBOX_ORIGINS);
  });

  it('keeps an empty list empty: the GM allowed no hosts', () => {
    expect(validOrigins([])).toEqual([]);
  });
});

describe('loadSandboxOrigins', () => {
  beforeEach(() => {
    resetSandboxOrigins();
    ActiveWebHelper.getAsync.mockReset();
  });

  it('asks the backend once and validates what comes back', async () => {
    ActiveWebHelper.getAsync.mockResolvedValue({ origins: ['https://cdn.example.com', 'http://bad.example.com'] });

    expect(await loadSandboxOrigins()).toEqual(['https://cdn.example.com']);
    expect(await loadSandboxOrigins()).toEqual(['https://cdn.example.com']);
    expect(ActiveWebHelper.getAsync).toHaveBeenCalledTimes(1);
    expect(ActiveWebHelper.getAsync).toHaveBeenCalledWith('security/sandboxorigins');
  });

  it('uses the defaults when the backend has no answer, and asks again next time', async () => {
    ActiveWebHelper.getAsync.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('closed'));

    expect(await loadSandboxOrigins()).toEqual(DEFAULT_SANDBOX_ORIGINS);
    expect(await loadSandboxOrigins()).toEqual(DEFAULT_SANDBOX_ORIGINS);
    expect(ActiveWebHelper.getAsync).toHaveBeenCalledTimes(2);
  });
});

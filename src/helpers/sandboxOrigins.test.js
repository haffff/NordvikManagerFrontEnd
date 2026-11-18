import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./transport', () => ({ ActiveWebHelper: { getAsync: vi.fn() } }));

import { ActiveWebHelper } from './transport';
import { DEFAULT_SANDBOX_ORIGINS, validOrigins, loadSandboxOrigins, resetSandboxOrigins, cardOrigins } from './sandboxOrigins';

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

// A card runs its addon's code: when the addon says where it connects, the card may reach
// only those of its hosts the GM allows; otherwise the GM's list as it is.
describe('cardOrigins', () => {
  const gm = ['https://api.example.com', 'https://*.cdn.example.com', 'https://fonts.gstatic.com'];

  it("keeps the addon's declared hosts that the GM allows, wildcards included", () => {
    const network = { hosts: ['https://api.example.com', 'https://img.cdn.example.com', 'https://evil.example.com', 'wss://live.example.com'] };
    expect(cardOrigins(gm, { addonKey: 'notes', addonNetwork: network })).toEqual(['https://api.example.com', 'https://img.cdn.example.com']);
  });

  it('an addon declaring nowhere gets nothing outside', () => {
    expect(cardOrigins(gm, { addonKey: 'poll', addonNetwork: { hosts: [] } })).toEqual([]);
  });

  it("the GM's list for an addon that doesn't say, one the user points somewhere, or a card of no addon", () => {
    expect(cardOrigins(gm, { addonKey: 'old', addonNetwork: null })).toEqual(gm);
    expect(cardOrigins(gm, { addonKey: 'notes', addonNetwork: { hosts: [], userHosts: 'Your server' } })).toEqual(gm);
    expect(cardOrigins(gm, {})).toEqual(gm);
    expect(cardOrigins(gm, null)).toEqual(gm);
  });
});

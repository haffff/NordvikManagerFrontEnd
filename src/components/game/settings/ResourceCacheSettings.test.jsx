import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../../helpers/ResourceCache', () => ({
  default: { usage: vi.fn(), setLimitMB: vi.fn(), clear: vi.fn() },
}));

import ResourceCache from '../../../helpers/ResourceCache';
import { ResourceCacheSettings } from './ResourceCacheSettings';

const MB = 1024 * 1024;

// The player chooses how much of this browser's storage the resource cache may use.
describe('ResourceCacheSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    ResourceCache.usage.mockResolvedValue(12 * MB);
    ResourceCache.setLimitMB.mockImplementation(async (mb) => localStorage.setItem('nordvik.resourceCacheLimitMB', String(mb)));
    ResourceCache.clear.mockResolvedValue();
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: vi.fn().mockResolvedValue({ quota: 10_000 * MB, usage: 12 * MB }) },
    });
  });

  const sizeSelect = () => screen.getByRole('combobox', { name: /cache size/i });

  it('shows what is used of the chosen size', async () => {
    renderWithProviders(<ResourceCacheSettings />);

    expect(await screen.findByText('Using 12 MB of 500 MB')).toBeTruthy();
  });

  it('choosing a size saves it', async () => {
    renderWithProviders(<ResourceCacheSettings />);
    await screen.findByText(/Using/);

    await userEvent.selectOptions(sizeSelect(), '1024');

    expect(ResourceCache.setLimitMB).toHaveBeenCalledWith(1024);
    expect(await screen.findByText('Using 12 MB of 1 GB')).toBeTruthy();
  });

  it('Off turns it off', async () => {
    renderWithProviders(<ResourceCacheSettings />);
    await screen.findByText(/Using/);

    await userEvent.selectOptions(sizeSelect(), '0');

    expect(ResourceCache.setLimitMB).toHaveBeenCalledWith(0);
    expect(await screen.findByText(/^Off — nothing is kept/)).toBeTruthy();
  });

  it('sizes the browser has no room for are disabled', async () => {
    navigator.storage.estimate.mockResolvedValue({ quota: 700 * MB, usage: 12 * MB });
    renderWithProviders(<ResourceCacheSettings />);

    await waitFor(() => expect(screen.getByRole('option', { name: '1 GB' }).disabled).toBe(true));
    expect(screen.getByRole('option', { name: '500 MB' }).disabled).toBe(false);
  });

  it('a custom size can be entered', async () => {
    renderWithProviders(<ResourceCacheSettings />);
    await screen.findByText(/Using/);

    await userEvent.selectOptions(sizeSelect(), 'custom');
    const input = screen.getByRole('spinbutton', { name: /custom size/i });
    await userEvent.clear(input);
    await userEvent.type(input, '300');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(ResourceCache.setLimitMB).toHaveBeenCalledWith(300);
  });

  it('Clear cache empties it', async () => {
    renderWithProviders(<ResourceCacheSettings />);
    await screen.findByText(/Using 12 MB/);
    ResourceCache.usage.mockResolvedValue(0);

    await userEvent.click(screen.getByRole('button', { name: 'Clear cache' }));

    expect(ResourceCache.clear).toHaveBeenCalled();
    expect(await screen.findByText('Using 0 MB of 500 MB')).toBeTruthy();
  });
});

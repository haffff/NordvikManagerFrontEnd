import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../setupTests';

vi.mock('../../../helpers/WebHelper', () => ({
  default: {
    getAsync: vi.fn(),
    postAsync: vi.fn(),
    putAsync: vi.fn(),
  },
}));
vi.mock('../../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import WebHelper from '../../../helpers/WebHelper';
import { toaster } from '../../ui/toaster';
import { UpdateSection } from './UpdateSection';

const offer = {
  version: '0.3.0',
  releasePage: 'https://github.com/haffff/NordvikManager/releases/tag/v0.3.0',
  size: 70 * 1024 * 1024,
  prerelease: false,
  publishedAt: '2026-10-27T10:00:00Z',
};

const status = (overrides = {}) => ({
  currentVersion: '0.2.0',
  supported: true,
  unsupportedReason: null,
  channel: 'Stable',
  noticesOff: false,
  backupsSupported: true,
  underServiceManager: false,
  available: offer,
  lastChecked: '2026-10-27T09:00:00Z',
  checkError: null,
  step: 'Idle',
  downloadedBytes: 0,
  error: null,
  lastResult: null,
  ...overrides,
});

const ok = (body) => ({ ok: true, json: async () => body });

describe('UpdateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    WebHelper.getAsync.mockResolvedValue(status());
  });

  it('shows the installed version and the update on offer', async () => {
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText(/NordvikManager 0\.3\.0 is available/)).toBeTruthy();
    expect(screen.getByText(/0\.2\.0/)).toBeTruthy();
    expect(screen.getByRole('link', { name: "What's new" }).getAttribute('href')).toBe(offer.releasePage);
    expect(WebHelper.getAsync).toHaveBeenCalledWith('update');
  });

  it('installs only after a second, confirming click', async () => {
    WebHelper.postAsync.mockResolvedValue(ok(status({ step: 'Downloading' })));
    renderWithProviders(<UpdateSection />);

    fireEvent.click(await screen.findByRole('button', { name: /Update to 0\.3\.0/ }));
    expect(WebHelper.postAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Back up, update and restart/ }));

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('update/install', { withoutBackup: false }));
    expect(await screen.findByText(/Downloading/)).toBeTruthy();
  });

  it('asks a server that cannot back itself up to confirm a manual backup first', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ backupsSupported: false }));
    WebHelper.postAsync.mockResolvedValue(ok(status({ step: 'Downloading' })));
    renderWithProviders(<UpdateSection />);

    fireEvent.click(await screen.findByRole('button', { name: /Update to 0\.3\.0/ }));
    const confirm = screen.getByRole('button', { name: /Update and restart/ });
    expect(confirm.disabled).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: /I backed up the database myself/ }));
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('update/install', { withoutBackup: true }));
  });

  it('explains instead of installing when the server runs as a service', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ underServiceManager: true }));
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText(/--update/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Update to/ })).toBeNull();
  });

  it('says why a server from source cannot update itself', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ supported: false, unsupportedReason: 'Updates are off in Development.', available: null }));
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText('Updates are off in Development.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check now' })).toBeNull();
  });

  it('checks again on request', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ available: null }));
    WebHelper.postAsync.mockResolvedValue(ok(status()));
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText(/latest version/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));

    await waitFor(() => expect(WebHelper.postAsync).toHaveBeenCalledWith('update/check', {}));
    expect(await screen.findByText(/NordvikManager 0\.3\.0 is available/)).toBeTruthy();
  });

  it('saves the dev build and notice switches together', async () => {
    WebHelper.putAsync.mockResolvedValue(ok(status({ channel: 'Dev' })));
    renderWithProviders(<UpdateSection />);

    fireEvent.click(await screen.findByText(/Offer dev builds/));

    await waitFor(() => expect(WebHelper.putAsync).toHaveBeenCalledWith('update/settings', { channel: 'dev', noticesOff: false }));
  });

  it('shows how the last update went', async () => {
    WebHelper.getAsync.mockResolvedValue(status({
      available: null,
      lastResult: { fromVersion: '0.2.0', toVersion: '0.3.0', succeeded: false, message: 'Port 8213 is already in use.' },
    }));
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText(/The update to 0\.3\.0 didn't work, so 0\.2\.0 is back/)).toBeTruthy();
    expect(screen.getByText(/Port 8213 is already in use\./)).toBeTruthy();
  });

  it('shows the error of a failed install', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ step: 'Failed', error: 'The download is damaged.' }));
    renderWithProviders(<UpdateSection />);

    expect(await screen.findByText('The download is damaged.')).toBeTruthy();
  });

  it('toasts when the server refuses to install', async () => {
    WebHelper.postAsync.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'An update is already being installed.' }) });
    renderWithProviders(<UpdateSection />);

    fireEvent.click(await screen.findByRole('button', { name: /Update to 0\.3\.0/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back up, update and restart/ }));

    await waitFor(() => expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ description: 'An update is already being installed.' })));
  });
});

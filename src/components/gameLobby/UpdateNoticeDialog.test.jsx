import { vi, describe, it, expect, beforeEach } from 'vitest';
import { waitFor, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../setupTests';

vi.mock('../../helpers/WebHelper', () => ({
  default: {
    getAsync: vi.fn(),
    putAsync: vi.fn(),
  },
}));

import WebHelper from '../../helpers/WebHelper';
import { UpdateNoticeDialog } from './UpdateNoticeDialog';

const status = (overrides = {}) => ({
  currentVersion: '0.2.0',
  channel: 'Stable',
  noticesOff: false,
  available: { version: '0.3.0', releasePage: 'https://github.com/haffff/NordvikManager/releases/tag/v0.3.0' },
  ...overrides,
});

describe('UpdateNoticeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    WebHelper.getAsync.mockResolvedValue(status());
  });

  it('tells the local admin about a new version', async () => {
    renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);

    expect(await screen.findByText(/NordvikManager 0\.3\.0 is available/)).toBeTruthy();
    expect(WebHelper.getAsync).toHaveBeenCalledWith('update');
  });

  it('asks nothing of other users', async () => {
    renderWithProviders(<UpdateNoticeDialog enabled={false} onOpenSettings={() => {}} />);

    await new Promise((r) => setTimeout(r, 0));
    expect(WebHelper.getAsync).not.toHaveBeenCalled();
  });

  it('stays quiet when notices are off or there is nothing new', async () => {
    WebHelper.getAsync.mockResolvedValue(status({ noticesOff: true }));
    const { unmount } = renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalled());
    expect(screen.queryByText(/is available/)).toBeNull();
    unmount();

    WebHelper.getAsync.mockResolvedValue(status({ available: null }));
    renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/is available/)).toBeNull();
  });

  it('opens Application Settings to install it', async () => {
    const onOpenSettings = vi.fn();
    renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={onOpenSettings} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Install…' }));

    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('turns notices off for good', async () => {
    WebHelper.putAsync.mockResolvedValue({ ok: true, json: async () => status({ noticesOff: true }) });
    renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: "Don't show update notices" }));

    await waitFor(() => expect(WebHelper.putAsync).toHaveBeenCalledWith('update/settings', { channel: 'stable', noticesOff: true }));
  });

  it('asks only once per browser session for a version', async () => {
    const { unmount } = renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
    unmount();

    renderWithProviders(<UpdateNoticeDialog enabled onOpenSettings={() => {}} />);
    await waitFor(() => expect(WebHelper.getAsync).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/is available/)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostIntroDialog, INTRO_DISMISSED, CARD_IDS } from './HostIntroDialog';
import { HostButton } from './HostButton';
import { setHostUi, resetHostUi } from './hostUi';

const limitation = (id, title) => ({ id, title, detail: `${title}: the details.` });
const info = {
  kind: 'browser',
  limitations: [
    limitation('tab-open', 'Keep this tab open'),
    limitation('browser-storage', 'Games are kept in this browser'),
    limitation('one-tab', 'One tab hosts at a time'),
    limitation('upload-restarts', 'An upload cut off by a reload starts over'),
    limitation('addon-registry', "Addons come from Central's registry"),
    limitation('no-thumbnails', 'No thumbnails'),
    limitation('login-after-reload', 'Log in again after a reload'),
    limitation('upload-limits', 'Fixed upload limits'),
  ],
  unavailable: [{ path: 'api/Backup', reason: 'Backs up the whole GM server.' }],
};

const show = (ui) => render(<Provider>{ui}</Provider>);

describe('HostIntroDialog', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* none */ }
    resetHostUi();
  });

  it('opens on its own once the host says what it is: a warning, six cards, the rest below', async () => {
    show(<HostIntroDialog info={info} central="https://central.example" />);

    expect(await screen.findByText(/hosting from your browser/i)).toBeTruthy();
    const cards = screen.getAllByTestId('host-intro-card');
    expect(cards).toHaveLength(6);
    expect(cards.map((c) => c.dataset.id)).toEqual(CARD_IDS);
    // the two that aren't cards, and what only a GM server does, are further down
    expect(screen.getByText('Fixed upload limits')).toBeTruthy();
    expect(screen.getByText('An upload cut off by a reload starts over')).toBeTruthy();
    expect(screen.getByText('Backs up the whole GM server.')).toBeTruthy();
  });

  it('"Continue with browser version" closes it, and it comes back next time', async () => {
    const { unmount } = show(<HostIntroDialog info={info} central="https://central.example" />);
    fireEvent.click(await screen.findByRole('button', { name: /continue with browser version/i }));
    await waitFor(() => expect(screen.queryByText(/hosting from your browser/i)).toBeNull());
    unmount();

    show(<HostIntroDialog info={info} central="https://central.example" />);
    expect(await screen.findByText(/hosting from your browser/i)).toBeTruthy();
  });

  it('"Don\'t remind me again" closes it for good', async () => {
    const { unmount } = show(<HostIntroDialog info={info} central="https://central.example" />);
    fireEvent.click(await screen.findByRole('button', { name: /don't remind me again/i }));
    expect(localStorage.getItem(INTRO_DISMISSED)).toBe('1');
    unmount();

    show(<HostIntroDialog info={info} central="https://central.example" />);
    await act(async () => {});
    expect(screen.queryByText(/hosting from your browser/i)).toBeNull();
  });

  it('"I will download local server" opens the download page', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    show(<HostIntroDialog info={info} central="https://central.example" />);

    fireEvent.click(await screen.findByRole('button', { name: /download local server/i }));
    expect(open).toHaveBeenCalledWith('https://central.example/#download', '_blank', 'noopener');
    open.mockRestore();
  });

  it('opens again from the drawer even after "Don\'t remind me again"', async () => {
    localStorage.setItem(INTRO_DISMISSED, '1');
    show(<HostIntroDialog info={info} central="https://central.example" />);
    act(() => setHostUi({ introOpen: true }));

    expect(await screen.findByText(/hosting from your browser/i)).toBeTruthy();
  });

  it('waits for the host info (it answers once the GM logged in)', async () => {
    show(<HostIntroDialog info={null} central="https://central.example" />);
    await act(async () => {});
    expect(screen.queryByText(/hosting from your browser/i)).toBeNull();
  });
});

describe('HostButton', () => {
  beforeEach(() => resetHostUi());

  it('is a toolbar button: square corners, a label, opening the drawer', () => {
    show(<HostButton />);
    const button = screen.getByRole('button', { name: /game host/i });
    expect(button.textContent).toMatch(/host/i);

    fireEvent.click(button);
    expect(screen.queryByTestId('host-badge-warning')).toBeNull();
  });

  it('carries the storage warning and the new errors', () => {
    show(<HostButton />);
    act(() => setHostUi({ persisted: false, unread: 3 }));

    expect(screen.getByRole('button', { name: /game host/i }).getAttribute('aria-label')).toMatch(/storage isn't persistent, 3 new errors/);
    expect(screen.getByTestId('host-badge-warning')).toBeTruthy();
    expect(screen.getByTestId('host-badge-errors').textContent).toBe('3');
  });
});

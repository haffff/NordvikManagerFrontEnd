import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { HostIntroDialog, INTRO_DISMISSED, CARD_IDS } from './HostIntroDialog';
import { HostButton } from './HostButton';
import { setHostUi, resetHostUi } from './hostUi';

const limitation = (id, title) => ({ id, title, detail: `${title}: the details.` });
// As the browser host lists them (BrowserHostDescription), most important first.
const info = {
  kind: 'browser',
  limitations: [
    limitation('tab-open', 'Keep this tab open'),
    limitation('browser-storage', 'Your games can be lost'),
    limitation('outside-connections', 'No connections to other services'),
    limitation('upload-limits', 'Upload limits are fixed'),
    limitation('no-thumbnails', 'Images load slower for players'),
    limitation('one-tab', 'Host from one tab only'),
    limitation('upload-restarts', 'Interrupted uploads start over'),
    limitation('login-after-reload', 'Log in again after a reload'),
    limitation('addon-registry', "Addons come from Central's registry"),
  ],
  unavailable: [
    { path: 'api/Backup', reason: 'Backs up the whole GM server.' },
    { path: 'api/Materials/LinkResource', reason: 'Links a file on the disk.' },
    { path: 'api/Materials/LinkDirectory', reason: 'Links a folder on the disk.' },
    { path: 'api/Meta', reason: "Central's details, fetched through the GM server." },
    { path: 'api/ServerSettings', reason: 'The settings file.' },
    { path: 'api/Update', reason: 'Updates the program.' },
  ],
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
    expect(cards.map((c) => c.dataset.id)).toEqual(['tab-open', 'browser-storage', 'outside-connections', 'upload-limits', 'no-thumbnails', 'one-tab']);
    expect(CARD_IDS).toHaveLength(6);
    // further down: what isn't a card
    expect(screen.getByText('Interrupted uploads start over')).toBeTruthy();
  });

  it("leaves out what a GM needn't know before playing", async () => {
    show(<HostIntroDialog info={info} central="https://central.example" />);
    await screen.findByText(/hosting from your browser/i);

    expect(screen.queryByText('Log in again after a reload')).toBeNull();
    expect(screen.queryByText("Addons come from Central's registry")).toBeNull();
  });

  it('says what the local server has, as features (not the routes behind them)', async () => {
    show(<HostIntroDialog info={info} central="https://central.example" />);
    await screen.findByText(/hosting from your browser/i);

    expect(screen.getByText(/features of the local server/i)).toBeTruthy();
    const features = screen.getAllByTestId('local-server-feature').map((f) => f.dataset.id);
    expect(features).toEqual(['backups', 'disk-files', 'settings', 'updates']);
    expect(screen.queryByText(/Central's details/)).toBeNull(); // nothing a GM does
    expect(screen.queryByText('Links a folder on the disk.')).toBeNull(); // grouped into one feature
  });

  it('only lists local server features the browser host lacks', async () => {
    show(<HostIntroDialog info={{ ...info, unavailable: [{ path: 'api/Update', reason: 'Updates.' }] }} central="https://central.example" />);
    await screen.findByText(/hosting from your browser/i);

    expect(screen.getAllByTestId('local-server-feature').map((f) => f.dataset.id)).toEqual(['updates']);
  });

  it('the storage card says whether persistent storage is on', async () => {
    show(<HostIntroDialog info={info} central="https://central.example" />);
    act(() => setHostUi({ persisted: false }));
    expect(await screen.findByText(/persistent storage is off/i)).toBeTruthy();

    act(() => setHostUi({ persisted: true }));
    expect(await screen.findByText(/persistent storage is on/i)).toBeTruthy();
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

  it('links to the user guide page about the browser version', async () => {
    show(<HostIntroDialog info={info} central="https://central.example/" />);

    const link = await screen.findByRole('link', { name: /read more/i });
    expect(link.getAttribute('href')).toBe('https://central.example/user-guide/getting-started-gm/browser-version/');
    expect(link.getAttribute('target')).toBe('_blank');
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

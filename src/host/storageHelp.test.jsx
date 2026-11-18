import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from '../components/ui/provider';
import { createInstallPrompt } from './installPrompt';
import { askOnFirstClick, formatBytes } from './storageHelp';
import { StorageBanner } from './StorageBanner';
import { HostDrawer } from './HostDrawer';
import { setHostUi } from './hostUi';

// The page's install offer, as the banner sees it (createInstallPrompt itself stays real).
const installMock = vi.hoisted(() => ({ canInstall: false, install: null }));
vi.mock('./installPrompt', async (original) => ({
  ...(await original()),
  useInstallPrompt: () => installMock,
}));

// Chrome's beforeinstallprompt: prompt(), then userChoice says what the user picked.
const installEvent = (outcome) => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  return event;
};

describe('createInstallPrompt', () => {
  it('keeps the browser\'s offer to install, and installs on request', async () => {
    const target = new EventTarget();
    const install = createInstallPrompt(target);
    const changes = vi.fn();
    install.subscribe(changes);
    expect(install.canInstall()).toBe(false);

    const event = installEvent('accepted');
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); // our button, not the browser's mini-infobar
    expect(install.canInstall()).toBe(true);
    expect(changes).toHaveBeenCalled();

    expect(await install.install()).toBe(true);
    expect(event.prompt).toHaveBeenCalled();
    expect(install.canInstall()).toBe(false); // an offer can be used once
  });

  it('says no when the user declines, or when there is no offer', async () => {
    const target = new EventTarget();
    const install = createInstallPrompt(target);
    expect(await install.install()).toBe(false);

    target.dispatchEvent(installEvent('dismissed'));
    expect(await install.install()).toBe(false);
  });

  it('forgets the offer once the app is installed', () => {
    const target = new EventTarget();
    const install = createInstallPrompt(target);
    target.dispatchEvent(installEvent('accepted'));
    target.dispatchEvent(new Event('appinstalled'));

    expect(install.canInstall()).toBe(false);
    expect(install.installed()).toBe(true);
  });
});

describe('askOnFirstClick', () => {
  it('asks once, on the first click (Firefox shows its prompt only for a click)', async () => {
    const target = new EventTarget();
    const ask = vi.fn(async () => true);
    const onAnswer = vi.fn();
    askOnFirstClick(target, ask, onAnswer);

    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('pointerdown'));
    await act(async () => {});

    expect(ask).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it('can be called off before any click', () => {
    const target = new EventTarget();
    const ask = vi.fn(async () => true);
    const stop = askOnFirstClick(target, ask, () => {});
    stop();
    target.dispatchEvent(new Event('pointerdown'));

    expect(ask).not.toHaveBeenCalled();
  });
});

describe('formatBytes', () => {
  it('is short and readable', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(34603013)).toBe('33 MB');
    expect(formatBytes(1.2 * 1024 ** 3)).toBe('1.2 GB');
  });
});

describe('the banner and the drawer', () => {
  beforeEach(() => { try { sessionStorage.clear(); } catch { /* none */ } });

  it('the banner offers to install the app, then asks for storage again', async () => {
    const install = vi.fn(async () => true);
    Object.assign(installMock, { canInstall: true, install });
    const persist = vi.fn(async () => true);
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true });
    const onPersisted = vi.fn();
    render(<Provider><StorageBanner persisted={false} onPersisted={onPersisted} /></Provider>);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /install as app/i })); });

    expect(install).toHaveBeenCalled();
    expect(persist).toHaveBeenCalled();
    expect(onPersisted).toHaveBeenCalledWith(true);
    Object.assign(installMock, { canInstall: false, install: null });
  });

  it('the drawer says how much the games use, of what the browser allows', async () => {
    Object.defineProperty(navigator, 'storage', { value: { estimate: async () => ({ usage: 34603013, quota: 1.2 * 1024 ** 3 }) }, configurable: true });
    render(<Provider><HostDrawer info={null} /></Provider>);

    act(() => setHostUi({ drawerOpen: true }));
    expect(await screen.findByText(/33 MB used of 1\.2 GB/)).toBeTruthy();
  });
});
